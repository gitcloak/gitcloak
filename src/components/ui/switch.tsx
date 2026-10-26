"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-gc-border-strong bg-gc-canvas shadow-none transition-colors outline-none disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-gc-success data-[state=checked]:bg-gc-success",
        // Style guide §7: focus is a 1px `--gc-accent` ring, same as inputs.
        "focus-visible:ring-1 focus-visible:ring-gc-accent/60 focus-visible:ring-offset-1 focus-visible:ring-offset-gc-surface",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-3.5 rounded-full bg-gc-surface shadow-sm transition-transform translate-x-0.5 data-[state=checked]:translate-x-[18px]"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
