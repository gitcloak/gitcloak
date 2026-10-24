"use client"

import * as React from "react"
import { useState } from "react"
import { FaEye, FaEyeSlash } from "react-icons/fa"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  showToggle?: boolean
}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, showToggle = true, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false)

    return (
      <div className="relative">
        <Input
          type={showPassword ? "text" : "password"}
          className={className}
          ref={ref}
          autoComplete="off"
          data-form-type="other"
          {...props}
        />
        {showToggle && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <FaEyeSlash className="h-4 w-4 text-muted-foreground" />
            ) : (
              <FaEye className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        )}
      </div>
    )
  }
)
PasswordInput.displayName = "PasswordInput"

export { PasswordInput }
