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
 *
 * `LandingBackground` publishes a small reader over its particle field so the
 * end-to-end suite can assert the drift, the cursor's push and the theme
 * colour without sampling canvas pixels.
 */
declare global {
  interface Window {
    __fileTreeRefresh?: (revealPath?: string) => void
    __getEditorValue?: () => string
    __landingBackground?: {
      /** Frames the animation loop has drawn (0 when motion is reduced). */
      frames: () => number
      /** Current push velocity per particle, in a stable order. */
      offsets: () => number[]
      /** Largest push velocity across the field. */
      maxOffset: () => number
      pointerActive: () => boolean
      /** The resolved `--gc-accent` the particles are painted with. */
      color: () => string
    }
  }
}

export {}
