/**
 * Globals the client code hangs off `window`.
 *
 * `FileTree` publishes a refresh callback so the editor (and the sidebar) can
 * ask it to re-read the repository after a save or a newly created file has to
 * appear. Declared here so neither side needs an `as any` cast.
 *
 * `MarkdownEditor` publishes a getter for the raw document text. The rendered
 * editor hides Markdown syntax, so tests read the source through this instead
 * of the DOM.
 */
declare global {
  interface Window {
    __fileTreeRefresh?: () => void
    __getEditorValue?: () => string
  }
}

export {}
