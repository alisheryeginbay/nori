import * as React from "react"
import { cn } from "@/lib/utils"

interface PromptTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  onSubmit?: () => void
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
}

export const PromptTextarea = React.forwardRef<HTMLTextAreaElement, PromptTextareaProps>(
  ({ className, onSubmit, onChange, value, ...props }, ref) => {
    const internalRef = React.useRef<HTMLTextAreaElement>(null)
    const textareaRef = (ref as React.RefObject<HTMLTextAreaElement>) || internalRef

    // Auto-resize textarea
    React.useEffect(() => {
      const textarea = textareaRef.current
      if (textarea) {
        textarea.style.height = "auto"
        textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
      }
    }, [value, textareaRef])

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Submit on Enter (without shift), new line on Shift+Enter
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        onSubmit?.()
      }
    }

    return (
      <textarea
        ref={textareaRef}
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        rows={1}
        className={cn(
          "w-full bg-transparent text-base outline-none resize-none",
          "placeholder:text-muted-foreground",
          "disabled:cursor-not-allowed",
          "!transition-none",
          className
        )}
        {...props}
      />
    )
  }
)

PromptTextarea.displayName = "PromptTextarea"
