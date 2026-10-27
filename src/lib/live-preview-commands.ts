import { EditorSelection, type EditorState, type TransactionSpec } from '@codemirror/state'
import { type EditorView, keymap } from '@codemirror/view'

/**
 * Wraps each selection in `marker`, or removes the markers when the selection
 * is already wrapped. An empty cursor gets a marker pair with the cursor
 * between them. Pure: returns the transaction instead of dispatching it.
 */
export function toggleMarker(state: EditorState, marker: string): TransactionSpec {
  const { doc } = state
  const size = marker.length

  return state.changeByRange((range) => {
    if (range.empty) {
      return {
        changes: { from: range.from, insert: marker + marker },
        range: EditorSelection.cursor(range.from + size),
      }
    }

    const wrapped =
      range.from >= size &&
      range.to + size <= doc.length &&
      doc.sliceString(range.from - size, range.from) === marker &&
      doc.sliceString(range.to, range.to + size) === marker

    if (wrapped) {
      return {
        changes: [
          { from: range.from - size, to: range.from },
          { from: range.to, to: range.to + size },
        ],
        range: EditorSelection.range(range.from - size, range.to - size),
      }
    }

    return {
      changes: [
        { from: range.from, insert: marker },
        { from: range.to, insert: marker },
      ],
      range: EditorSelection.range(range.from + size, range.to + size),
    }
  })
}

function applyMarker(view: EditorView, marker: string): boolean {
  view.dispatch(toggleMarker(view.state, marker))
  return true
}

/** Mod-b toggles bold and Mod-i toggles italics around the selection. */
export const formattingKeymap = keymap.of([
  { key: 'Mod-b', run: (view) => applyMarker(view, '**') },
  { key: 'Mod-i', run: (view) => applyMarker(view, '*') },
])
