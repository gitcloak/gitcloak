# GitCloak Style Guide

A single reference for the visual language that already exists in the app. It
was extracted from the shipped components — the app shell (`app-sidebar.tsx`,
`editor-area.tsx`, `file-tree.tsx`), the notifications (`notice-toast.tsx`,
`loading-overlay.tsx`) and the dialogs (`password-dialog.tsx`,
`input-dialog.tsx`) — and is now expressed as shared tokens so new UI can match
it without guesswork.

The **`Unlock Repository` dialog is the reference implementation** of the
dialog block described below.

The UI is built on **shadcn/ui** (`new-york` style, `src/components/ui/*`,
backed by the unified `radix-ui` package and `lucide-react` icons). Prefer an
existing `@/components/ui` primitive over a new hand-rolled one, and prefer a
`--gc-*` utility over a hex value.

---

## 1. Where the tokens live

All design tokens are defined once in `src/app/globals.css`:

- As CSS custom properties in `:root` (`--gc-*`).
- Mapped into Tailwind's `@theme inline` block, so every token is also a
  utility class (`bg-gc-canvas`, `text-gc-fg-muted`, `rounded-gc-md`, …).
- **Re-declared under `.dark`** with a GitHub-dark palette. `next-themes`
  toggles the `dark` class on `<html>` (`attribute="class"`), so a component
  that only uses `--gc-*` utilities is automatically dark-mode correct.

```tsx
// Always this:
<div className="border border-gc-border bg-gc-canvas text-gc-fg-muted" />

// Never a hard-coded palette value:
<div style={{ backgroundColor: '#f6f8fa' }} />
```

> **Global resets must stay inside `@layer base`.** Anything unlayered in
> `globals.css` outranks the `utilities` layer in the CSS cascade, so a plain
> `* { padding: 0 }` would defeat every `px-*`/`py-*` utility (this is what made
> the dialogs look cramped). The file now only keeps an uncoloured `a { … }`
> rule there; everything else comes from Tailwind Preflight.

---

## 2. Color

| Token | Value | Utility | Use for |
| --- | --- | --- | --- |
| `--gc-surface` | `#ffffff` | `bg-gc-surface` | Cards, panels, dialogs, inputs |
| `--gc-canvas` | `#f6f8fa` | `bg-gc-canvas` | Sidebar, status bars, medallions, hover fills |
| `--gc-canvas-subtle` | `#fafbfc` | `bg-gc-canvas-subtle` | Section headers, dialog footers |
| `--gc-border` | `#e1e4e8` | `border-gc-border` | Default 1px hairline everywhere |
| `--gc-border-strong` | `#d0d7de` | `border-gc-border-strong` | Emphasis borders, badges |
| `--gc-fg` | `#24292e` | `text-gc-fg` | Primary text, titles |
| `--gc-fg-muted` | `#57606a` | `text-gc-fg-muted` | Secondary text, labels, descriptions |
| `--gc-fg-subtle` | `#8b949e` | `text-gc-fg-subtle` | Placeholders, empty states, disabled text |
| `--gc-success` | `#2ea44f` | `bg-gc-success` | Primary/confirm action, unlocked state |
| `--gc-success-hover` | `#2c974b` | `hover:bg-gc-success-hover` | Primary action hover |
| `--gc-success-bg` | `#dafbe1` | `bg-gc-success-bg` | Success badge / notice background |
| `--gc-success-fg` | `#1a7f37` | `text-gc-success-fg` | Success text on success background |
| `--gc-danger` | `#cf222e` | `text-gc-danger` | Errors, lock state, destructive text |
| `--gc-danger-bg` | `#ffebe9` | `bg-gc-danger-bg` | Inline error background |
| `--gc-danger-fg` | `#cf222e` | `text-gc-danger-fg` | Error text on error background |
| `--gc-warning` | `#d4a72c` | `border-gc-warning` | "Not set up" badge border |
| `--gc-warning-bg` | `#fff8c5` | `bg-gc-warning-bg` | "Not set up" badge background |
| `--gc-warning-fg` | `#7d4e00` | `text-gc-warning-fg` | "Not set up" badge text |
| `--gc-accent` | `#0969da` | `text-gc-accent` | Links, focus rings |
| `--gc-brand` | `#667eea` | — | Logo gradient start |
| `--gc-brand-alt` | `#764ba2` | — | Logo gradient end |

Brand gradient (logo / hero heading only):

```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
```

**Rules**

- Green (`--gc-success`) is reserved for the single primary confirmation action
  in a view and for the "unlocked" state. Never use it for a destructive action.
- Red (`--gc-danger`) is for errors and locking only.
- Amber (`--gc-warning*`) is only for the "not set up" repository state.
- Do not hard-code hex values in new code; use the token. Legacy inline
  `#f6f8fa`, `#e1e4e8`, `#24292e`, `#666`, `#999`, `#2ea44f`, `#d73a49` map to
  the tokens above (`#666`/`#999` → `--gc-fg-muted`/`--gc-fg-subtle`,
  `#d73a49` → `--gc-danger`).
- The dark palette is not a mechanical inversion: surfaces get *lighter* as
  they come forward (`--gc-surface` `#0d1117` < `--gc-canvas` `#161b22` <
  `--gc-canvas-subtle` `#21262d`), the opposite of the light theme. Keep that
  ordering when adding a surface.

---

## 3. Typography

Default UI font is Tailwind's sans stack (`ui-sans-serif, system-ui, …`).
Code blocks and inline code use a monospace stack:
`Monaco, Menlo, "Ubuntu Mono", monospace`. The editor itself renders Markdown
live (see `markdown-editor.tsx`), so its prose uses the default sans stack and
only code is monospace.

| Role | Size | Weight | Color | Notes |
| --- | --- | --- | --- | --- |
| Hero / marketing title | `3rem` | bold | brand gradient | landing only |
| View title (dialog title, editor title) | `1rem`–`1.25rem` | 600 | `--gc-fg` | `tracking-tight`, `leading-tight` |
| Body / default | `0.875rem` (14px) | 400 | `--gc-fg` | buttons, inputs, tree nodes |
| Secondary / description | `0.875rem` | 400 | `--gc-fg-muted` | `leading-relaxed` |
| Section label (uppercase) | `0.75rem` (12px) | 600 | `--gc-fg-muted` | `uppercase`, `tracking-wide` |
| Micro / badge | `0.6875rem`–`0.75rem` | 600 | contextual | pills, status |
| Editor body (live Markdown) | `15px` | 400 | `--gc-fg` | `line-height: 1.7`; headings scale from it |
| Monospace / code | `0.9em` of the body | 400 | `--gc-fg` | code blocks, inline code, tables |

**Rules**

- Use **uppercase 12px/600 section labels** for group headings and form field
  labels — this is the shell's signature (`REPOSITORY`, `FILES`, `EDITOR`, and
  now `PASSWORD` in dialogs). Keep letter-spacing subtle (`tracking-wide`).
- Titles are `--gc-fg`; never pure black.
- Never go below `0.6875rem` (11px).

---

## 4. Spacing & layout

The app works on an 8px rhythm (Tailwind's default scale).

| Block | Padding | Notes |
| --- | --- | --- |
| Sidebar / panel section | `1rem` | header, repo selector, account (+ `SidebarContent` scroll) |
| Section header (label bar) | `0.75rem 1rem` | uppercase label + toolbar |
| Dialog header | `px-6 pt-6` (24px) | leave `pr-12` for the close button |
| Dialog body | `px-6 py-5` (24/20px) | field stack, `gap-4` |
| Dialog footer | `px-6 py-4` (24/16px) | actions, `gap-2` |
| Toolbar icon button | `0.375rem 0.5rem` | height `28px` |
| Button | `0.5rem 1rem` | height `36px` (`h-9`) |
| Input | `px-3 py-1` | height `36px` (`h-9`) |
| Tree node | `4px 8px` + `level*12px` indent | 13px text |

Fixed dimensions

- Sidebar width: **`16rem`** (256px), the shadcn `SIDEBAR_WIDTH`; icon rail
  `3rem`. Both are CSS variables (`--sidebar-width`), not literals — don't
  hard-code a width in `AppSidebar`.
- Dialog width: **`26rem`** (`sm:max-w-[26rem]`); full-bleed below `sm`.
- Field stack gap: **`gap-4`** (16px); label→input gap **`6px`**.
- Shell height: `h-svh`.

---

## 5. Borders, radii & elevation

| Token | Value | Utility | Use for |
| --- | --- | --- | --- |
| `--gc-radius-sm` | `4px` | `rounded-gc-sm` | Small chips, tags, toolbar buttons |
| `--gc-radius-md` | `6px` | `rounded-gc-md` | Buttons, inputs, cards, medallions |
| `--gc-radius-lg` | `8px` | `rounded-gc-lg` | Dialogs, toasts |
| `--gc-radius-pill` | `999px` | `rounded-gc-pill` | Status badges |

- Every surface is separated by a **1px `--gc-border` hairline**. Dividers use
  `border-t` / `border-b` with the same token.
- The `--gc-radius-*` tokens mirror the shadcn/Tailwind radius scale, which is
  derived from a single `--radius: 0.5rem` in `:root`:
  `rounded-sm` = 4px, `rounded-md` = 6px, `rounded-lg` = 8px. `rounded-gc-*` are
  aliases for the same values; use whichever reads best. When overriding a
  component that already sets a radius (e.g. `DialogContent`'s `sm:rounded-lg`),
  prefer the plain utility — tailwind-merge recognises it and dedupes the
  conflict.
- Elevation is minimal and neutral:
  - `--gc-shadow-popover` (`0 8px 24px rgba(0,0,0,.12)`) → dialogs.
  - `--gc-shadow-card` (`0 4px 12px rgba(0,0,0,.08)`) → dropdowns/cards.
  - Buttons are **flat** (`shadow-none`).
- The dialog overlay is `bg-black/80`, `z-50`.
- **Centre a dialog with layout, never with a transform.** `DialogContent` is
  centred by a `fixed inset-0 flex items-center justify-center p-4` wrapper in
  `ui/dialog.tsx`; the dialog itself only fades.
  Why: Tailwind v4 compiles `translate-x-[-50%]` to the standalone CSS
  `translate:` property, while `@keyframes enter/exit` animate `transform`.
  Those *compose* instead of replacing each other, so the canonical shadcn
  `left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2` +
  `slide-in-from-left-1/2 slide-in-from-top-[48%]` combination makes the dialog
  fly in from the top-left before snapping to the centre. A flex wrapper cannot
  have that failure mode. Scale/opacity animations (`zoom-in-95`) are fine —
  they scale about the element's own centre.

---

## 6. Component blocks

### 6.1 Section header

A bar with an uppercase 12px label, optionally with right-aligned toolbar
buttons. Background `--gc-canvas-subtle` (or `--gc-surface`), bottom hairline.

```tsx
<div className="flex items-center justify-between border-b border-gc-border bg-gc-canvas-subtle px-4 py-3">
  <span className="text-xs font-semibold uppercase tracking-wide text-gc-fg-muted">
    Files
  </span>
</div>
```

### 6.2 Buttons

| Variant | Appearance | Example |
| --- | --- | --- |
| Primary | `bg-gc-success text-white`, flat, hover `bg-gc-success-hover` | Unlock, Save, Create |
| Secondary / outline | `bg-gc-surface` + 1px `--gc-border`, text `--gc-fg`, hover `bg-gc-canvas` | Cancel |
| Toolbar icon | 28px tall, `rounded-gc-sm`, 1px border, white, hover `bg-gc-canvas` | Refresh, New |
| Destructive text | red text on white (`Lock repository`) | Lock |

All buttons: `h-9` (36px) for forms, `rounded-gc-md`, `font-medium`,
`disabled:opacity-50` + `cursor: not-allowed`, no shadow.

### 6.3 Inputs & password field

`h-9`, `rounded-gc-md`, 1px `--gc-border`, `bg-gc-surface`, text `--gc-fg`,
placeholder `--gc-fg-subtle`, focus ring `--gc-accent`.

The password field (`PasswordInput`) is an input with a ghost eye toggle
anchored to the right edge.

### 6.4 Status badge (pill)

`rounded-gc-pill`, `0.6875rem`/600, 1px border, tinted background.

| State | bg | border | fg |
| --- | --- | --- | --- |
| Locked / checking | `--gc-canvas` | `--gc-border-strong` | `--gc-fg-muted` |
| Unlocked | `--gc-success-bg` | `--gc-success` | `--gc-success-fg` |
| Not set up | `bg-gc-warning-bg` | `--gc-warning` | `--gc-warning-fg` |

### 6.5 Inline alert (form error)

```tsx
<div
  role="alert"
  className="rounded-gc-md border border-gc-danger/30 bg-gc-danger-bg px-3 py-2 text-sm font-medium text-gc-danger-fg"
>
  Incorrect password. Please try again.
</div>
```

### 6.6 Toast notice

Fixed, centered at `top: 1rem`, `z-index: 100`, `rounded-gc-lg`, 1px border,
tinted background, icon + message + dismiss. Auto-dismisses after 5s. Types:
success / error / info (see `notice-toast.tsx`).

### 6.7 Dialog (reference: Unlock Repository)

Structure — header → body → footer inside a single `<form>`, with `gap-0 p-0`
and blocks supplying their own padding:

```tsx
<DialogContent className="gap-0 overflow-hidden rounded-gc-lg border-gc-border p-0 shadow-gc-popover sm:max-w-[26rem]">
  <form className="flex flex-col">
    {/* Header: 36px medallion + title + description */}
    <DialogHeader className="flex-row items-start gap-3 space-y-0 px-6 pt-6 pr-12 text-left">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-gc-md border border-gc-border bg-gc-canvas text-gc-fg-muted">
        <Lock className="size-4" />
      </span>
      <div className="space-y-1.5">
        <DialogTitle className="text-base font-semibold leading-tight tracking-tight text-gc-fg">
          Unlock Repository
        </DialogTitle>
        <DialogDescription className="text-sm leading-relaxed text-gc-fg-muted">
          Enter the password for owner/repo.
        </DialogDescription>
      </div>
    </DialogHeader>

    {/* Body: label + field + optional alert */}
    <div className="grid gap-4 px-6 py-5">
      <div className="grid gap-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wide text-gc-fg-muted">
          Password
        </Label>
        <PasswordInput className="h-9 rounded-gc-md border-gc-border bg-gc-surface" />
      </div>
    </div>

    {/* Footer: tinted bar, secondary + primary */}
    <DialogFooter className="flex-row justify-end gap-2 space-x-0 border-t border-gc-border bg-gc-canvas-subtle px-6 py-4">
      <Button variant="outline" className="h-9 rounded-gc-md border-gc-border bg-gc-surface text-gc-fg shadow-none hover:bg-gc-canvas">
        Cancel
      </Button>
      <Button className="h-9 rounded-gc-md bg-gc-success text-white shadow-none hover:bg-gc-success-hover">
        Unlock
      </Button>
    </DialogFooter>
  </form>
</DialogContent>
```

Rules

- The header medallion is **optional** but recommended for any dialog that has a
  clear emblem (unlock → `Lock`, decrypt → `CircleAlert`, set password →
  `ShieldCheck`, save password → `KeyRound`). It is `36×36`, `rounded-gc-md`,
  on `--gc-canvas` with a `--gc-border` hairline. Icons are `lucide-react`,
  sized with `className="size-4"` (16px) — never a numeric `size` prop.
- Exactly **one** primary (green) action per dialog, placed last/right.
- Cancel is always an outline button and always present for dismissible dialogs.
- Errors render as an inline alert in the body — never `window.alert()`.
- Keep the `data-testid` hooks (`<prefix>-title|description|input|submit|cancel|error`)
  so the Playwright suite can drive the dialog.
- Show a full-screen `LoadingOverlay` (with `role="status"`, `aria-busy`) for
  operations that block the UI (e.g. age KDF), not a spinner inside the button.
- `overflow-hidden` on `DialogContent` clips the tinted footer to the dialog's
  rounded corners.
- The dialog relies on Tailwind's `px-*` / `py-*` utilities for its padding.
  Global resets **must** live in `@layer base` (see §1) — an unlayered
  `* { padding: 0 }` wins over the `utilities` layer and silently flattens every
  dialog.

### 6.8 App shell & responsive layout

The authenticated shell is a single `SidebarProvider`
(`h-svh overflow-hidden`) wrapping `AppSidebar` + a `SidebarInset` that holds
the editor. One component, two layouts:

| Viewport | Sidebar | Reachable via |
| --- | --- | --- |
| `md` and up | Inline column, `collapsible="offcanvas"` | rail click, `⌘/Ctrl+B`, `SidebarTrigger` |
| below `md` | `Sheet` overlay (Radix Dialog) | `SidebarTrigger` only |

Rules

- The shell is exactly viewport height: `h-svh` on the provider and
  `overflow-hidden` on the inset, with the scroll living in the pane that owns
  the content (file tree, editor). Never let the page itself scroll.
- `SidebarTrigger` lives in the **editor header**, so it is present on every
  viewport — that is the only route to the file tree on mobile.
- Give every header/footer row `flex-wrap` and hide secondary labels with
  `hidden sm:inline` rather than shrinking them; the editor header must survive
  a 320px viewport.
- Panels are `min-w-0` whenever they sit in a flex row — without it a long file
  path forces the whole shell wider than the viewport.
- `SidebarProvider` persists its collapsed state in a cookie; do not add local
  state for it.

---

## 7. States & interaction

- **Hover:** backgrounds shift one surface step (`surface → canvas`); borders
  may darken to `--gc-border-strong`; links fade to `opacity: 0.7`.
- **Focus:** `focus-visible:ring-1` using `--gc-accent`. Never remove the ring.
  This is implemented once in `ui/input.tsx` (`focus-visible:border-gc-accent
  focus-visible:ring-1 focus-visible:ring-gc-accent/60`) rather than per-field,
  so a new input cannot forget it.
- **Dismissal:** menus have **no exit animation**. Radix keeps a menu mounted
  until `animationend`, and the still-registered `DismissableLayer` then eats an
  outside pointerdown — including the trigger click that is trying to
  *re-open* the menu. A second click inside the ~150ms exit window silently did
  nothing. Removing the exit animation (in `ui/dropdown-menu.tsx`) closes the
  window; dialogs and sheets keep theirs and are unaffected, because their
  trigger is not also a toggle.
- **Disabled:** `opacity: 0.5` and `cursor: not-allowed`; never hide the control.
- **Loading:** keep the control in place and change its label (`Processing…`,
  `Saving…`); animate icons with the shared `spin` / `pulse` keyframes.
- **Empty:** centered, `--gc-fg-subtle`, short sentence + optional 48px icon.

---

## 8. Accessibility

- Labels are real `<Label>` tied to inputs via `htmlFor`/`id`.
- Alerts use `role="alert"`; toasts and overlays use `role="status"` /
  `aria-busy="true"`.
- Dialogs keep the Radix focus trap; `onOpenAutoFocus` is only overridden to
  focus the first field.
- Color is never the only signal — pair it with an icon and/or text.

---

## 9. Do / Don't

| Do | Don't |
| --- | --- |
| Use `--gc-*` tokens | Hard-code new hex values |
| One green primary action | Multiple competing primary buttons |
| 1px `--gc-border` hairlines | Heavy or colored borders |
| Uppercase 12px section labels | All-caps body text |
| Inline alerts & toasts | `window.alert()` / `confirm()` |
| Flat buttons | Drop shadows on buttons |
| `rounded-gc-md` controls, `rounded-gc-lg` dialogs | Mixed/arbitrary radii |
| Global resets inside `@layer base` | Unlayered `* { padding: 0 }` overrides |
| `bg-gc-*` tokens, dark-mode correct for free | Literal `#fff` / `bg-white` surfaces |
| Layout-centered dialogs (flex wrapper) | Transform-centered dialogs (`translate-*` + `slide-in-*`) |
| `lucide-react` icons via `className="size-4"` | `react-icons` / numeric `size={16}` |
