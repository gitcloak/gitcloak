/**
 * Globals the client code hangs off `window`.
 *
 * `FileTree` publishes a refresh callback so the editor (and the sidebar) can
 * ask it to re-read the repository after a save or a newly created file has to
 * appear. It takes the stored path of an entry to reveal: the tree opens the
 * folders above it so the entry is visible even when they were all collapsed.
 * Declared here so neither side needs an `as any` cast.
 *
 * `MarkdownEditor` publishes a getter for the raw document text. The rendered
 * editor hides Markdown syntax, so tests read the source through this instead
 * of the DOM.
 */
declare global {
  interface Window {
    __fileTreeRefresh?: (revealPath?: string) => void
    __getEditorValue?: () => string
  }
}

export {}
