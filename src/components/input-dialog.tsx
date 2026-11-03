"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

/** An extra single-choice question asked alongside the name. */
export interface InputDialogChoice {
  /** Heading above the options. */
  label: string
  /** Currently selected option value. */
  value: string
  options: { value: string; label: string; hint?: string; disabled?: boolean }[]
  onChange: (value: string) => void
  /** Prefix for the `data-testid` attributes of the group and its options. */
  testId: string
}

interface InputDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  label: string
  placeholder?: string
  defaultValue?: string
  /** Optional single-choice question, e.g. encrypted or plain. */
  choice?: InputDialogChoice
  onSubmit: (value: string) => void
}

export function InputDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  placeholder,
  defaultValue = "",
  choice,
  onSubmit,
}: InputDialogProps) {
  const [value, setValue] = useState(defaultValue)

  useEffect(() => {
    if (open) {
      setValue(defaultValue)
    }
  }, [open, defaultValue])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (value.trim()) {
      onSubmit(value.trim())
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]" data-testid="new-file-dialog">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle data-testid="new-file-title">{title}</DialogTitle>
            <DialogDescription data-testid="new-file-description">{description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="input">{label}</Label>
              <Input
                id="input"
                data-testid="new-file-input"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={placeholder}
                autoFocus
              />
            </div>
            {choice && (
              <div className="grid gap-2">
                <Label>{choice.label}</Label>
                <RadioGroup
                  data-testid={choice.testId}
                  value={choice.value}
                  onValueChange={choice.onChange}
                >
                  {choice.options.map((option) => (
                    <div key={option.value} className="flex items-start gap-2">
                      <RadioGroupItem
                        id={`${choice.testId}-${option.value}`}
                        data-testid={`${choice.testId}-${option.value}`}
                        value={option.value}
                        disabled={option.disabled}
                        className="mt-0.5"
                      />
                      <div className="grid gap-0.5">
                        <Label
                          htmlFor={`${choice.testId}-${option.value}`}
                          className="text-sm font-normal"
                        >
                          {option.label}
                        </Label>
                        {option.hint && (
                          <span className="text-xs text-muted-foreground">{option.hint}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" data-testid="new-file-submit" disabled={!value.trim()}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
