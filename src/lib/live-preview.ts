import { syntaxTree } from '@codemirror/language'
import type { EditorState, Range, Text } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from '@codemirror/view'

/**
 * Obsidian/Bear-style live preview for Markdown.
 *
 * The document stays plain Markdown, so saving writes exactly what was typed.
 * Decorations only change how that text is shown: markers such as `**`, `#`,
 * `>` or `](url)` are hidden and bullets and checkboxes are drawn as widgets.
 * Everything the cursor or selection touches stays in source form so it can be
 * edited, and it is revealed again as soon as the cursor moves into it.
 *
 * Supported: ATX and setext headings, emphasis, strong, strikethrough, inline
 * code, links, images (shown as their alt text, remote images are never
 * fetched), block quotes, bullet and task lists, fenced code, horizontal rules
 * and GFM tables (styled as monospace source, not converted into a grid).
 */

interface Span {
  from: number
  to: number
}

export interface LivePreview {
  /** Every decoration: line styling, marker styling and replacements. */
  decorations: DecorationSet
  /** Replaced ranges the cursor steps over instead of entering. */
  atomicRanges: DecorationSet
}

/** Nodes whose delimiter markers are hidden while the cursor is outside them. */
const INLINE_CONTAINERS = new Set([
  'Emphasis',
  'StrongEmphasis',
  'Strikethrough',
  'InlineCode',
  'Link',
  'Image',
])

/** Marker nodes that belong to an inline container listed above. */
const INLINE_MARKERS = new Set([
  'EmphasisMark',
  'StrikethroughMark',
  'CodeMark',
  'LinkMark',
  'URL',
  'LinkLabel',
  'LinkTitle',
])

const ATX_HEADING = /^ATXHeading([1-6])$/

const decorationCache = new Map<string, Decoration>()

function cached(key: string, create: () => Decoration): Decoration {
  let decoration = decorationCache.get(key)
  if (!decoration) {
    decoration = create()
    decorationCache.set(key, decoration)
  }
  return decoration
}

const markClass = (className: string) =>
  cached(`mark:${className}`, () => Decoration.mark({ class: className }))

const lineClass = (className: string) =>
  cached(`line:${className}`, () => Decoration.line({ class: className }))

export class BulletWidget extends WidgetType {
  eq(): boolean {
    return true
  }

  toDOM(): HTMLElement {
    const bullet = document.createElement('span')
    bullet.className = 'cm-lp-bullet'
    bullet.textContent = '•'
    return bullet
  }
}

export class RuleWidget extends WidgetType {
  eq(): boolean {
    return true
  }

  toDOM(): HTMLElement {
    const rule = document.createElement('span')
    rule.className = 'cm-lp-hr'
    return rule
  }
}

export class CheckboxWidget extends WidgetType {
  constructor(readonly checked: boolean) {
    super()
  }

  eq(other: CheckboxWidget): boolean {
    return other.checked === this.checked
  }

  toDOM(view: EditorView): HTMLElement {
    const box = document.createElement('input')
    box.type = 'checkbox'
    box.className = 'cm-lp-checkbox'
    box.checked = this.checked
    box.setAttribute('aria-label', this.checked ? 'Completed task' : 'Open task')
    // Flip the `[ ]` / `[x]` marker in the document. The widget is found by
    // its DOM position, so a re-rendered widget never writes to a stale spot.
    box.addEventListener('change', () => {
      const from = view.posAtDOM(box)
      view.dispatch({
        changes: { from, to: from + 3, insert: box.checked ? '[x]' : '[ ]' },
      })
    })
    return box
  }
}

// Declared after the widget classes they instantiate.
const HIDDEN = Decoration.replace({})
const BULLET = Decoration.replace({ widget: new BulletWidget() })
const CHECKED_BOX = Decoration.replace({ widget: new CheckboxWidget(true) })
const UNCHECKED_BOX = Decoration.replace({ widget: new CheckboxWidget(false) })
const RULE = Decoration.replace({ widget: new RuleWidget() })

/** Skips spaces and tabs after `pos`, at most `limit` of them. */
function skipSpaces(doc: Text, pos: number, limit: number): number {
  let end = pos
  while (end < doc.length && end - pos < limit) {
    const char = doc.sliceString(end, end + 1)
    if (char !== ' ' && char !== '\t') break
    end += 1
  }
  return end
}

/**
 * Computes the live-preview decorations for the part of `state` between
 * `from` and `to`. Pure: it reads the document, the syntax tree and the
 * selection, and returns decorations without touching the DOM.
 */
export function computeLivePreview(
  state: EditorState,
  from = 0,
  to = state.doc.length
): LivePreview {
  const { doc } = state
  const selection = state.selection.ranges
  const decorations: Range<Decoration>[] = []
  const atomicRanges: Range<Decoration>[] = []

  // A span is active when the cursor or any selection touches it, edges
  // included, so a cursor placed right after `**bold**` still shows the marks.
  const touches = (span: Span): boolean =>
    selection.some((range) => range.from <= span.to && span.from <= range.to)

  const addLine = (className: string, pos: number) => {
    decorations.push(lineClass(className).range(doc.lineAt(pos).from))
  }

  const addLines = (className: string, span: Span) => {
    const last = doc.lineAt(span.to).number
    for (let n = doc.lineAt(span.from).number; n <= last; n++) {
      addLine(className, doc.line(n).from)
    }
  }

  const addMark = (className: string, span: Span) => {
    if (span.to > span.from) {
      decorations.push(markClass(className).range(span.from, span.to))
    }
  }

  const replace = (span: Span, decoration: Decoration) => {
    if (span.to <= span.from) return
    const range = decoration.range(span.from, span.to)
    decorations.push(range)
    atomicRanges.push(range)
  }

  // A marker is shown (muted) while its container is active and hidden
  // otherwise.
  const marker = (span: Span, active: boolean) => {
    if (active) {
      addMark('cm-lp-mark', span)
    } else {
      replace(span, HIDDEN)
    }
  }

  syntaxTree(state).iterate({
    from,
    to,
    enter: (node) => {
      const parent = node.node.parent
      const span: Span = { from: node.from, to: node.to }
      const atHeading = ATX_HEADING.exec(node.name)
      if (atHeading) {
        addLine(`cm-lp-h${atHeading[1]}`, node.from)
        return
      }

      switch (node.name) {
        case 'SetextHeading1':
        case 'SetextHeading2': {
          // Every line but the underline is heading text.
          const level = node.name.endsWith('1') ? 1 : 2
          const underline = doc.lineAt(node.to).number
          for (let n = doc.lineAt(node.from).number; n < underline; n++) {
            addLine(`cm-lp-h${level}`, doc.line(n).from)
          }
          return
        }

        case 'HeaderMark': {
          // ATX markers take the space after them. A setext underline is the
          // whole line.
          const isSetext = parent?.name.startsWith('SetextHeading') ?? false
          const end = isSetext ? node.to : skipSpaces(doc, node.to, Infinity)
          marker({ from: node.from, to: end }, touches(doc.lineAt(node.from)))
          return
        }

        case 'Blockquote':
          addLines('cm-lp-quote', span)
          return

        case 'QuoteMark': {
          // The `>` and the one space after it.
          const end = skipSpaces(doc, node.to, 1)
          marker({ from: node.from, to: end }, touches(doc.lineAt(node.from)))
          return
        }

        case 'ListMark': {
          const active = touches(doc.lineAt(node.from))
          if (active) {
            addMark('cm-lp-mark', span)
          } else if (/^[-*+]$/.test(doc.sliceString(node.from, node.to))) {
            replace(span, BULLET)
          }
          return
        }

        case 'TaskMarker': {
          if (touches(doc.lineAt(node.from))) {
            addMark('cm-lp-mark', span)
          } else {
            const checked = /x/i.test(doc.sliceString(node.from, node.to))
            replace(span, checked ? CHECKED_BOX : UNCHECKED_BOX)
          }
          return
        }

        case 'HorizontalRule': {
          if (touches(doc.lineAt(node.from))) {
            addMark('cm-lp-mark', span)
          } else {
            replace(span, RULE)
          }
          return
        }

        case 'FencedCode':
          addLines('cm-lp-codeblock', span)
          return

        case 'CodeMark':
          if (parent?.name === 'FencedCode') {
            // The fence lines collapse while the block is not being edited.
            const active = touches(parent)
            marker(span, active)
            if (!active) addLine('cm-lp-fence-hidden', node.from)
            return
          }
          break

        case 'CodeInfo':
          if (parent?.name === 'FencedCode') {
            marker(span, touches(parent))
          }
          return

        case 'Table':
          addLines('cm-lp-table', span)
          return

        case 'Emphasis':
          addMark('cm-lp-em', span)
          return
        case 'StrongEmphasis':
          addMark('cm-lp-strong', span)
          return
        case 'Strikethrough':
          addMark('cm-lp-strike', span)
          return
        case 'InlineCode':
          addMark('cm-lp-code', span)
          return
        case 'Link':
          addMark('cm-lp-link', span)
          return
        case 'Image':
          addMark('cm-lp-image', span)
          return
      }

      if (INLINE_MARKERS.has(node.name) && parent && INLINE_CONTAINERS.has(parent.name)) {
        marker(span, touches(parent))
      }
    },
  })

  return {
    decorations: Decoration.set(decorations, true),
    atomicRanges: Decoration.set(atomicRanges, true),
  }
}

/** Live preview for what is currently on screen. */
function previewInView(view: EditorView): LivePreview {
  return computeLivePreview(view.state, view.viewport.from, view.viewport.to)
}

const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    atomicRanges: DecorationSet

    constructor(view: EditorView) {
      const preview = previewInView(view)
      this.decorations = preview.decorations
      this.atomicRanges = preview.atomicRanges
    }

    update(update: ViewUpdate) {
      // The syntax tree is parsed in the background, so a new tree can arrive
      // without a document change. Recompute when that happens.
      if (
        update.docChanged ||
        update.selectionSet ||
        update.viewportChanged ||
        syntaxTree(update.startState) !== syntaxTree(update.state)
      ) {
        const preview = previewInView(update.view)
        this.decorations = preview.decorations
        this.atomicRanges = preview.atomicRanges
      }
    }
  },
  {
    decorations: (instance) => instance.decorations,
    provide: (plugin) =>
      EditorView.atomicRanges.of((view) => view.plugin(plugin)?.atomicRanges ?? Decoration.none),
  }
)

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

const HEADING_LINES = [1, 2, 3, 4, 5, 6].map((level) => `.cm-line.cm-lp-h${level}`).join(', ')

const livePreviewTheme = EditorView.theme({
  '&': {
    flex: '1 1 auto',
    minHeight: '0',
    minWidth: '0',
    color: 'var(--gc-fg)',
    backgroundColor: 'var(--gc-surface)',
    fontSize: '15px',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'inherit', lineHeight: '1.7' },
  '.cm-content': { padding: '1rem', caretColor: 'var(--gc-fg)' },
  '@media (min-width: 640px)': {
    '.cm-content': { padding: '1.5rem' },
  },
  '.cm-line': { padding: '0' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--gc-fg)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'color-mix(in srgb, var(--gc-accent) 25%, transparent)',
  },

  // Spacing above headings is padding, not margin. CodeMirror measures line
  // heights without margins, so a margin would throw off click positions.
  [HEADING_LINES]: {
    fontWeight: '700',
    lineHeight: '1.3',
    paddingTop: '0.6em',
  },
  '.cm-lp-h1': { fontSize: '1.9em' },
  '.cm-lp-h2': { fontSize: '1.55em' },
  '.cm-lp-h3': { fontSize: '1.3em' },
  '.cm-lp-h4': { fontSize: '1.15em' },
  '.cm-lp-h5': { fontSize: '1em' },
  '.cm-lp-h6': { fontSize: '0.9em', color: 'var(--gc-fg-muted)' },

  '.cm-lp-strong': { fontWeight: '700' },
  '.cm-lp-em': { fontStyle: 'italic' },
  '.cm-lp-strike': { textDecoration: 'line-through', color: 'var(--gc-fg-muted)' },
  '.cm-lp-code': {
    fontFamily: MONO,
    fontSize: '0.9em',
    backgroundColor: 'var(--gc-canvas)',
    borderRadius: 'var(--gc-radius-sm)',
    padding: '0 0.2em',
  },
  '.cm-lp-link': {
    color: 'var(--gc-accent)',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
  },
  '.cm-lp-image': { fontStyle: 'italic', color: 'var(--gc-fg-muted)' },
  '.cm-lp-mark': { color: 'var(--gc-fg-subtle)' },

  '.cm-line.cm-lp-quote': {
    borderLeft: '3px solid var(--gc-border-strong)',
    paddingLeft: '0.9em',
    color: 'var(--gc-fg-muted)',
  },
  '.cm-line.cm-lp-codeblock': {
    fontFamily: MONO,
    fontSize: '0.9em',
    backgroundColor: 'var(--gc-canvas)',
    paddingLeft: '0.75em',
  },
  '.cm-line.cm-lp-fence-hidden': { fontSize: '0.3em', lineHeight: '1' },
  '.cm-line.cm-lp-table': { fontFamily: MONO, fontSize: '0.9em' },

  '.cm-lp-bullet': {
    display: 'inline-block',
    width: '0.8em',
    textAlign: 'center',
    color: 'var(--gc-fg-muted)',
  },
  '.cm-lp-checkbox': {
    margin: '0 0.4em 0 0',
    verticalAlign: 'middle',
    accentColor: 'var(--gc-success)',
    cursor: 'pointer',
  },
  '.cm-lp-hr': {
    display: 'inline-block',
    width: '100%',
    borderTop: '2px solid var(--gc-border)',
    verticalAlign: 'middle',
  },
})

/** Extension bundle: the live-preview decorations and their styling. */
export const livePreview = [livePreviewPlugin, livePreviewTheme]
