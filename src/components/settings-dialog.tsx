"use client"

import { Monitor, Moon, Settings, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  autosave: boolean
  onAutosaveChange: (enabled: boolean) => void
}

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const

/** Uppercase section label, matching the style guide's section headers. */
function SectionLabel({ children, id }: { children: string; id?: string }) {
  return (
    <h3
      id={id}
      className="text-xs font-semibold uppercase tracking-wide text-gc-fg-muted"
    >
      {children}
    </h3>
  )
}

/**
 * Application settings. Changes apply immediately, so the only action is
 * "Done". Theme is stored by `next-themes`; autosave is stored by
 * `useAutosave`.
 */
export function SettingsDialog({
  open,
  onOpenChange,
  autosave,
  onAutosaveChange,
}: SettingsDialogProps) {
  const { theme, setTheme } = useTheme()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="gap-0 overflow-hidden rounded-gc-lg border-gc-border p-0 shadow-gc-popover sm:max-w-[26rem]"
        data-testid="settings-dialog"
      >
        <DialogHeader className="flex-row items-start gap-3 space-y-0 px-6 pt-6 pr-12 text-left">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-gc-md border border-gc-border bg-gc-canvas text-gc-fg-muted"
          >
            <Settings className="size-4" />
          </span>
          <div className="space-y-1.5">
            <DialogTitle
              className="text-base font-semibold leading-tight tracking-tight text-gc-fg"
              data-testid="settings-title"
            >
              Settings
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-gc-fg-muted">
              Changes are saved on this device and apply immediately.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="grid gap-6 px-6 py-5">
          {/* Appearance: light, dark or follow the operating system. */}
          <section className="grid gap-2" aria-labelledby="settings-appearance">
            <SectionLabel id="settings-appearance">Appearance</SectionLabel>
            <RadioGroup
              aria-labelledby="settings-appearance"
              data-testid="theme-group"
              value={theme ?? "system"}
              onValueChange={(value) => setTheme(value)}
              className="gap-2"
            >
              {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                <Label
                  key={value}
                  htmlFor={`theme-${value}`}
                  className="flex cursor-pointer items-center gap-3 rounded-gc-md border border-gc-border bg-gc-surface px-3 py-2.5 font-normal transition-colors hover:bg-gc-canvas has-data-[state=checked]:border-gc-accent has-data-[state=checked]:bg-gc-canvas"
                >
                  <RadioGroupItem
                    id={`theme-${value}`}
                    value={value}
                    data-testid={`theme-option-${value}`}
                  />
                  <Icon className="size-4 text-gc-fg-muted" aria-hidden="true" />
                  <span className="text-sm text-gc-fg">{label}</span>
                </Label>
              ))}
            </RadioGroup>
          </section>

          {/* Editor behaviour. */}
          <section className="grid gap-2" aria-labelledby="settings-editor">
            <SectionLabel id="settings-editor">Editor</SectionLabel>
            <div className="flex items-start justify-between gap-4 rounded-gc-md border border-gc-border bg-gc-surface p-3">
              <div className="grid gap-1">
                <Label
                  htmlFor="autosave-toggle"
                  className="text-sm font-medium text-gc-fg"
                >
                  Autosave
                </Label>
                <p
                  id="autosave-description"
                  className="text-xs leading-relaxed text-gc-fg-muted"
                >
                  Save a moment after you stop typing. Needs the repository to be
                  unlocked, so no password prompt appears while you write.
                </p>
              </div>
              <Switch
                id="autosave-toggle"
                data-testid="autosave-toggle"
                checked={autosave}
                onCheckedChange={onAutosaveChange}
                aria-describedby="autosave-description"
                className="mt-0.5"
              />
            </div>
          </section>
        </div>

        <DialogFooter className="flex-row justify-end gap-2 space-x-0 border-t border-gc-border bg-gc-canvas-subtle px-6 py-4">
          <Button
            data-testid="settings-done"
            onClick={() => onOpenChange(false)}
            className="h-9 rounded-gc-md bg-gc-success text-white shadow-none hover:bg-gc-success-hover"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
