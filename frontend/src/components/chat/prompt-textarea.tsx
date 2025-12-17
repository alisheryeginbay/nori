import * as React from "react"
import { cn } from "@/lib/utils"

interface PromptTextareaProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  onSubmit?: () => void
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export const PromptTextarea = React.forwardRef<HTMLInputElement, PromptTextareaProps>(
  ({ className, onSubmit, onChange, ...props }, ref) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault()
        onSubmit?.()
      }
    }

    return (
      <input
        ref={ref}
        type="text"
        onChange={onChange}
        onKeyDown={handleKeyDown}
        className={cn(
          "w-full bg-transparent text-base outline-none",
          "placeholder:text-muted-foreground",
          "disabled:cursor-not-allowed",
          className
        )}
        {...props}
      />
    )
  }
)

PromptTextarea.displayName = "PromptTextarea"
