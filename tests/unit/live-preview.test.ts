import { describe, expect, it } from 'vitest'
import { markdown } from '@codemirror/lang-markdown'
import { EditorSelection, EditorState } from '@codemirror/state'
import { type DecorationSet, WidgetType } from '@codemirror/view'
import { GFM } from '@lezer/markdown'

import {
  BulletWidget,
  CheckboxWidget,
  RuleWidget,
  computeLivePreview,
} from '@/lib/live-preview'
import { toggleMarker } from '@/lib/live-preview-commands'

/**
 * Builds an editor state the way the app does (Markdown with GFM) and puts
 * the cursor at `cursor`, or selects every range given as `[from, to]`.
 */
function makeState(doc: string, cursor: number | Array<[number, number]> = 0): EditorState {
  const selection =
    typeof cursor === 'number'
      ? EditorSelection.cursor(cursor)
      : EditorSelection.create(cursor.map(([from, to]) => EditorSelection.range(from, to)))
  return EditorState.create({
    doc,
    selection,
    // Lets the harness keep several selection ranges. The app keeps the
    // default single selection, so this only matters for the multi-range tests.
    extensions: [EditorState.allowMultipleSelections.of(true), markdown({ extensions: [GFM] })],
  })
}

interface Decoded {
  from: number
  to: number
  /** `line`, `mark`, `hidden` (replaced with nothing) or `widget`. */
  kind: 'line' | 'mark' | 'hidden' | 'widget'
  className?: string
  widget?: WidgetType
}

function decode(set: DecorationSet, end: number): Decoded[] {
  const out: Decoded[] = []
  set.between(0, end, (from, to, value) => {
    const spec = value.spec as { class?: string; widget?: WidgetType }
    if (spec.widget) {
      out.push({ from, to, kind: 'widget', widget: spec.widget })
    } else if (from === to) {
      out.push({ from, to, kind: 'line', className: spec.class })
    } else if (spec.class) {
      out.push({ from, to, kind: 'mark', className: spec.class })
    } else {
      out.push({ from, to, kind: 'hidden' })
    }
  })
  return out
}

function preview(state: EditorState) {
  const result = computeLivePreview(state)
  return {
    all: decode(result.decorations, state.doc.length),
    atomic: decode(result.atomicRanges, state.doc.length),
  }
}

function widgetLabel(widget: WidgetType): string {
  if (widget instanceof BulletWidget) return '•'
  if (widget instanceof RuleWidget) return '<hr>'
  if (widget instanceof CheckboxWidget) return widget.checked ? '[x]' : '[ ]'
  throw new Error('unknown widget')
}

/**
 * The text a reader sees: the document with hidden ranges removed and widgets
 * replaced by a label. Lets tests assert what is rendered in one string.
 */
function visibleText(state: EditorState): string {
  const { all } = preview(state)
  const replaced = all
    .filter((d) => d.kind === 'hidden' || d.kind === 'widget')
    .sort((a, b) => a.from - b.from)
  let out = ''
  let pos = 0
  for (const d of replaced) {
    out += state.doc.sliceString(pos, d.from)
    out += d.kind === 'widget' ? widgetLabel(d.widget as WidgetType) : ''
    pos = d.to
  }
  return out + state.doc.sliceString(pos)
}

function classesOn(state: EditorState, className: string): number[] {
  return preview(state)
    .all.filter((d) => d.kind === 'line' && d.className === className)
    .map((d) => state.doc.lineAt(d.from).number)
}

describe('live preview: headings', () => {
  it('hides the # marker and the space after it while the cursor is elsewhere', () => {
    const doc = '# Title\n\nbody'
    expect(visibleText(makeState(doc, doc.length))).toBe('Title\n\nbody')
  })

  it('shows the # marker when the cursor is on the heading line', () => {
    const doc = '# Title\n\nbody'
    expect(visibleText(makeState(doc, 4))).toBe('# Title\n\nbody')
  })

  it('styles each ATX level with its own line class', () => {
    const doc = '# a\n## b\n### c\n#### d\n##### e\n###### f'
    const state = makeState(doc, doc.length)
    for (let level = 1; level <= 6; level++) {
      expect(classesOn(state, `cm-lp-h${level}`)).toEqual([level])
    }
  })

  it('treats a setext underline as a hidden marker over the heading text', () => {
    const doc = 'Setext\n===\n\nbody'
    const state = makeState(doc, doc.length)
    expect(classesOn(state, 'cm-lp-h1')).toEqual([1])
    expect(visibleText(state)).toBe('Setext\n\n\nbody')
  })

  it('shows the setext underline when the cursor is on it', () => {
    const doc = 'Setext\n===\n\nbody'
    expect(visibleText(makeState(doc, 8))).toBe('Setext\n===\n\nbody')
  })

  it('styles every line of a multi-line setext heading', () => {
    const doc = 'First\nSecond\n------\n\nbody'
    const state = makeState(doc, doc.length)
    expect(classesOn(state, 'cm-lp-h2')).toEqual([1, 2])
  })

  it('does not treat a # in the middle of a line as a heading', () => {
    const doc = 'not # heading'
    const state = makeState(doc, doc.length)
    expect(classesOn(state, 'cm-lp-h1')).toEqual([])
    expect(visibleText(state)).toBe(doc)
  })
})

describe('live preview: inline formatting', () => {
  const doc = 'a **b** *c* ~~d~~ `e`'

  it('hides bold, italic, strikethrough and code markers outside the cursor', () => {
    expect(visibleText(makeState(doc, 0))).toBe('a b c d e')
  })

  it('reveals only the markers of the span the cursor is inside', () => {
    // Cursor inside "b": only the bold markers come back.
    expect(visibleText(makeState(doc, 4))).toBe('a **b** c d e')
  })

  it('reveals markers when the cursor sits on the span edge', () => {
    // Right after the closing `**` of bold (the span ends at offset 7).
    expect(visibleText(makeState(doc, 7))).toBe('a **b** c d e')
  })

  it('applies a class to each formatted span', () => {
    const state = makeState(doc, doc.length)
    const { all } = preview(state)
    const classes = all.filter((d) => d.kind === 'mark').map((d) => d.className)
    expect(classes).toEqual(
      expect.arrayContaining(['cm-lp-strong', 'cm-lp-em', 'cm-lp-strike', 'cm-lp-code'])
    )
  })

  it('supports underscore emphasis', () => {
    const state = makeState('x __bold__ _it_', 0)
    expect(visibleText(state)).toBe('x bold it')
  })

  it('leaves unmatched markers as plain text', () => {
    const state = makeState('a * b and **c', 0)
    expect(visibleText(state)).toBe('a * b and **c')
  })
})

describe('live preview: links and images', () => {
  it('shows only the link text when the cursor is elsewhere', () => {
    const doc = 'see [docs](https://example.com) now'
    expect(visibleText(makeState(doc, 0))).toBe('see docs now')
  })

  it('shows the full link source when the cursor is inside it', () => {
    const doc = 'see [docs](https://example.com) now'
    expect(visibleText(makeState(doc, 6))).toBe('see [docs](https://example.com) now')
  })

  it('renders an image as its alt text and never shows the URL', () => {
    const doc = 'x\n\n![a cat](https://example.com/cat.png)'
    const state = makeState(doc, 0)
    expect(visibleText(state)).toBe('x\n\na cat')
    expect(preview(state).all.some((d) => d.className === 'cm-lp-image')).toBe(true)
  })

  it('marks reference link labels as hidden when the cursor is elsewhere', () => {
    const doc = 'a [text][ref] b\n\n[ref]: https://example.com'
    expect(visibleText(makeState(doc, doc.length))).toBe('a text b\n\n[ref]: https://example.com')
  })

  it('leaves autolinks as written', () => {
    const doc = 'go to <https://example.com>'
    expect(visibleText(makeState(doc, 0))).toBe(doc)
  })
})

describe('live preview: block quotes', () => {
  it('hides the > marker and styles the quoted lines', () => {
    const doc = 'text\n\n> quote\n> more'
    const state = makeState(doc, 0)
    expect(visibleText(state)).toBe('text\n\nquote\nmore')
    expect(classesOn(state, 'cm-lp-quote')).toEqual([3, 4])
  })

  it('reveals the marker only on the line the cursor is on', () => {
    const doc = 'text\n\n> quote\n> more'
    // Cursor on "quote" (line 3).
    expect(visibleText(makeState(doc, 9))).toBe('text\n\n> quote\nmore')
  })
})

describe('live preview: lists and tasks', () => {
  it('draws bullets as widgets except on the cursor line', () => {
    const doc = '- one\n- two'
    expect(visibleText(makeState(doc, 0))).toBe('- one\n• two')
    expect(visibleText(makeState(doc, doc.length))).toBe('• one\n- two')
  })

  it('keeps ordered list markers as written', () => {
    const doc = '1. one\n2. two'
    expect(visibleText(makeState(doc, doc.length))).toBe(doc)
  })

  it('replaces task markers with checkboxes that reflect their state', () => {
    const doc = '- [ ] todo\n- [x] done\n- [X] shouty'
    // The cursor is on the last line, so only that line keeps its source.
    expect(visibleText(makeState(doc, doc.length))).toBe(
      '• [ ] todo\n• [x] done\n- [X] shouty'
    )
  })

  it('reveals a task marker when the cursor is on its line', () => {
    const doc = '- [ ] todo\n- [x] done'
    expect(visibleText(makeState(doc, 2))).toBe('- [ ] todo\n• [x] done')
  })
})

describe('live preview: code blocks', () => {
  const doc = '```js\nconst a = 1\n```\n\ntext'

  it('hides the fences and language label outside the block', () => {
    const state = makeState(doc, doc.length)
    expect(visibleText(state).split('\n')).toEqual(['', 'const a = 1', '', '', 'text'])
  })

  it('collapses the hidden fence lines and styles every code line', () => {
    const state = makeState(doc, doc.length)
    expect(classesOn(state, 'cm-lp-codeblock')).toEqual([1, 2, 3])
    expect(classesOn(state, 'cm-lp-fence-hidden')).toEqual([1, 3])
  })

  it('shows the fences while the cursor is inside the block', () => {
    const state = makeState(doc, 17)
    expect(visibleText(state)).toBe('```js\nconst a = 1\n```\n\ntext')
    expect(classesOn(state, 'cm-lp-fence-hidden')).toEqual([])
  })

  it('does not apply inline code styling to fenced code', () => {
    const state = makeState(doc, doc.length)
    expect(preview(state).all.some((d) => d.className === 'cm-lp-code')).toBe(false)
  })
})

describe('live preview: rules and tables', () => {
  it('replaces a horizontal rule with a rule widget', () => {
    const doc = 'above\n\n---\n\nbelow'
    expect(visibleText(makeState(doc, 0))).toBe('above\n\n<hr>\n\nbelow')
    const widgets = preview(makeState(doc, 0)).all.filter((d) => d.kind === 'widget')
    expect(widgets.map((d) => widgetLabel(d.widget as WidgetType))).toEqual(['<hr>'])
  })

  it('keeps the rule as source when the cursor is on it', () => {
    const doc = 'above\n\n---\n\nbelow'
    // Offset 8 is inside the `---` line.
    const state = makeState(doc, 8)
    expect(preview(state).all.some((d) => d.kind === 'widget')).toBe(false)
  })

  it('leaves tables as source and styles their lines as monospace', () => {
    const doc = '| a | b |\n|---|---|\n| 1 | 2 |'
    const state = makeState(doc, doc.length)
    expect(visibleText(state)).toBe(doc)
    expect(classesOn(state, 'cm-lp-table')).toEqual([1, 2, 3])
  })
})

describe('live preview: selections', () => {
  it('reveals markers in every line a multi-line selection touches', () => {
    const doc = '# One\n\n# Two\n\nbody'
    // Select from the first heading to the second one.
    const state = makeState(doc, [[0, 11]])
    expect(visibleText(state)).toBe('# One\n\n# Two\n\nbody')
  })

  it('handles several cursors, one per block', () => {
    const doc = '# One\n\n# Two\n\nbody'
    const state = makeState(doc, [
      [2, 2],
      [doc.length, doc.length],
    ])
    expect(visibleText(state)).toBe('# One\n\nTwo\n\nbody')
  })

  it('reveals nothing when the selection is outside every span', () => {
    const doc = 'plain **bold** text'
    const state = makeState(doc, doc.length)
    expect(visibleText(state)).toBe('plain bold text')
  })
})

describe('live preview: atomic ranges', () => {
  it('marks exactly the hidden and widget ranges as atomic, not the styled marks', () => {
    const doc = '# Title\n\n**bold** and - item'
    const state = makeState(doc, doc.length)
    const { all, atomic } = preview(state)
    const replaced = all.filter((d) => d.kind === 'hidden' || d.kind === 'widget')
    expect(atomic.map((d) => [d.from, d.to])).toEqual(replaced.map((d) => [d.from, d.to]))
    // The bold text itself is styled, not atomic.
    expect(atomic.some((d) => d.from === 9 && d.to === 16)).toBe(false)
  })

  it('does not change the document', () => {
    const doc = '# A\n\n- [ ] b\n\n```\ncode\n```'
    const state = makeState(doc, 0)
    preview(state)
    expect(state.doc.toString()).toBe(doc)
  })
})

describe('toggleMarker', () => {
  function apply(doc: string, selection: [number, number], marker: string) {
    const state = makeState(doc, [selection])
    const next = state.update(toggleMarker(state, marker)).state
    return {
      doc: next.doc.toString(),
      selection: [next.selection.main.from, next.selection.main.to],
    }
  }

  it('wraps the selection and keeps it selected', () => {
    expect(apply('hello world', [0, 5], '**')).toEqual({
      doc: '**hello** world',
      selection: [2, 7],
    })
  })

  it('unwraps a selection that is already wrapped', () => {
    expect(apply('**hello** world', [2, 7], '**')).toEqual({
      doc: 'hello world',
      selection: [0, 5],
    })
  })

  it('inserts a marker pair with the cursor between them', () => {
    expect(apply('ab', [1, 1], '*')).toEqual({ doc: 'a**b', selection: [2, 2] })
  })

  it('uses single markers for italics', () => {
    expect(apply('say hi', [4, 6], '*')).toEqual({
      doc: 'say *hi*',
      selection: [5, 7],
    })
  })

  it('does not unwrap when the text only matches the marker on one side', () => {
    expect(apply('*hello world', [1, 6], '*')).toEqual({
      doc: '**hello* world',
      selection: [2, 7],
    })
  })

  it('handles selections at the very start and end of the document', () => {
    expect(apply('x', [0, 1], '**')).toEqual({ doc: '**x**', selection: [2, 3] })
  })

  it('toggles every selection in a multi-cursor state', () => {
    const state = makeState('one two', [
      [0, 3],
      [4, 7],
    ])
    const next = state.update(toggleMarker(state, '*')).state
    expect(next.doc.toString()).toBe('*one* *two*')
  })
})
