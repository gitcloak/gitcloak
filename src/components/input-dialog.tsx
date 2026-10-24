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

interface InputDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  label: string
  placeholder?: string
  defaultValue?: string
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
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="input">{label}</Label>
              <Input
                id="input"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={placeholder}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!value.trim()}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
