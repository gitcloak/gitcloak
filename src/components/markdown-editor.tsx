'use client'

import { useEffect, useRef, useState } from 'react'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownKeymap } from '@codemirror/lang-markdown'
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { GFM } from '@lezer/markdown'

import { editorTheme, livePreview, sourceView } from '@/lib/live-preview'
import { formattingKeymap } from '@/lib/live-preview-commands'

interface MarkdownEditorProps {
  /** The Markdown text. Changes from outside the editor replace the document. */
  value: string
  /** Called with the full text after every edit made in the editor. */
  onChange: (value: string) => void
  /**
   * Render Markdown live (the default). When false the editor shows the raw
   * source. The document is the same either way; only the display changes.
   */
  rendered?: boolean
}

/**
 * Markdown editor that renders as you type (Obsidian/Bear-style live preview),
 * or shows the raw source. The document is always the raw Markdown; see
 * `lib/live-preview.ts`.
 */
export function MarkdownEditor({ value, onChange, rendered = true }: MarkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  // The view is created once, from the value present at mount. Later values
  // flow in through the effects below.
  const [initialValue] = useState(value)
  const [initialRendered] = useState(rendered)
  // Swaps the live-preview decorations for the source view without recreating
  // the editor, so the cursor, selection and undo history survive the switch.
  const [displayMode] = useState(() => new Compartment())

  useEffect(() => {
    onChangeRef.current = onChange
  })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const view = new EditorView({
      parent: container,
      state: EditorState.create({
        doc: initialValue,
        extensions: [
          history(),
          // Markdown list and quote continuation runs before the generic keys.
          keymap.of([...markdownKeymap, ...historyKeymap, ...defaultKeymap]),
          formattingKeymap,
          markdown({ extensions: [GFM] }),
          displayMode.of(initialRendered ? livePreview : sourceView),
          editorTheme,
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({
            'aria-label': 'File content',
            'aria-multiline': 'true',
            spellcheck: 'false',
            autocorrect: 'off',
            autocapitalize: 'off',
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString())
            }
          }),
        ],
      }),
    })
    viewRef.current = view
    window.__getEditorValue = () => view.state.doc.toString()

    return () => {
      delete window.__getEditorValue
      view.destroy()
      viewRef.current = null
    }
  }, [initialValue, initialRendered, displayMode])

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: displayMode.reconfigure(rendered ? livePreview : sourceView),
    })
  }, [rendered, displayMode])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } })
    }
  }, [value])

  return (
    // A column flex box so the CodeMirror root fills the width and height.
    // As a plain flex item it would shrink to its content width.
    <div
      ref={containerRef}
      data-testid="editor-input"
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-gc-surface"
    />
  )
}
