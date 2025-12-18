"use client"

import * as React from "react"
import { KeyIcon, Loader2Icon, CheckIcon, ExternalLinkIcon } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { updateApiKey } from "@/lib/api"

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  hasApiKey: boolean
  onApiKeyUpdated: (hasKey: boolean) => void
}

export function SettingsDialog({
  open,
  onOpenChange,
  userId,
  hasApiKey,
  onApiKeyUpdated,
}: SettingsDialogProps) {
  const [apiKey, setApiKey] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)

  const handleSave = async () => {
    if (!apiKey.trim()) return

    setIsLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const result = await updateApiKey(userId, apiKey.trim())
      onApiKeyUpdated(result.has_anthropic_key)
      setSuccess(true)
      setApiKey("")
      setTimeout(() => {
        onOpenChange(false)
        setSuccess(false)
      }, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save API key")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyIcon className="size-5" />
            API Settings
          </DialogTitle>
          <DialogDescription>
            Add your Anthropic API key to use Nori. Your key is stored securely and only used for your requests.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <label htmlFor="api-key" className="text-sm font-medium">
              Anthropic API Key
            </label>
            <Input
              id="api-key"
              type="password"
              placeholder={hasApiKey ? "••••••••••••••••" : "sk-ant-..."}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
            <p className="text-xs text-muted-foreground">
              {hasApiKey ? "Enter a new key to replace your existing one." : "Required to chat with your repos."}
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex items-center justify-between">
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
            >
              Get an API key
              <ExternalLinkIcon className="size-3" />
            </a>
            <Button onClick={handleSave} disabled={isLoading || !apiKey.trim()}>
              {isLoading ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : success ? (
                <>
                  <CheckIcon className="size-4" />
                  Saved
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
