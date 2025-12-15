import * as React from "react"
import { cn } from "@/lib/utils"

interface PromptTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  onSubmit?: () => void
}

export const PromptTextarea = React.forwardRef<HTMLTextAreaElement, PromptTextareaProps>(
  ({ className, onSubmit, onChange, ...props }, ref) => {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null)
    const combinedRef = useCombinedRef(ref, textareaRef)

    const adjustHeight = () => {
      const textarea = textareaRef.current
      if (textarea) {
        textarea.style.height = "auto"
        textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
      }
    }

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      adjustHeight()
      onChange?.(e)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        onSubmit?.()
      }
    }

    React.useEffect(() => {
      adjustHeight()
    }, [props.value])

    return (
      <textarea
        ref={combinedRef}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        rows={1}
        className={cn(
          "w-full resize-none bg-transparent text-base outline-none",
          "placeholder:text-muted-foreground",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    )
  }
)

PromptTextarea.displayName = "PromptTextarea"

function useCombinedRef<T>(
  ...refs: (React.Ref<T> | undefined)[]
): React.RefCallback<T> {
  return React.useCallback((element: T) => {
    refs.forEach((ref) => {
      if (typeof ref === "function") {
        ref(element)
      } else if (ref && typeof ref === "object") {
        (ref as React.MutableRefObject<T>).current = element
      }
    })
  }, refs)
}
