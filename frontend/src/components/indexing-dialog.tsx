"use client"

import * as React from "react"
import { Loader2Icon, CheckIcon, XIcon, GitBranchIcon, CodeIcon, DatabaseIcon, SparklesIcon } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { IndexProgress } from "@/lib/api"

interface IndexingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  repoName: string
  progress: IndexProgress | null
  error: string | null
  isComplete: boolean
}

const stages = [
  { key: "cloning", label: "Cloning repository", icon: GitBranchIcon },
  { key: "parsing", label: "Parsing code", icon: CodeIcon },
  { key: "embedding", label: "Creating embeddings", icon: SparklesIcon },
  { key: "storing", label: "Storing in database", icon: DatabaseIcon },
] as const

export function IndexingDialog({
  open,
  onOpenChange,
  repoName,
  progress,
  error,
  isComplete,
}: IndexingDialogProps) {
  const currentStageIndex = progress
    ? stages.findIndex((s) => s.key === progress.stage)
    : -1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={!!error || isComplete}>
        <DialogHeader>
          <DialogTitle>
            {error ? "Indexing Failed" : isComplete ? "Indexing Complete" : "Indexing Repository"}
          </DialogTitle>
          <DialogDescription>
            {error
              ? `Failed to index ${repoName}`
              : isComplete
                ? `${repoName} is ready to chat`
                : `Preparing ${repoName} for chat...`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-4">
          {error ? (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 text-destructive">
              <XIcon className="size-5 shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          ) : (
            stages.map((stage, index) => {
              const Icon = stage.icon
              const isActive = index === currentStageIndex && !isComplete
              const isCompleted = index < currentStageIndex || isComplete
              const isPending = index > currentStageIndex && !isComplete

              return (
                <div
                  key={stage.key}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    isActive
                      ? "bg-primary/10"
                      : isCompleted
                        ? "bg-muted/50"
                        : "opacity-50"
                  }`}
                >
                  <div className={`shrink-0 ${isActive ? "text-primary" : isCompleted ? "text-green-500" : "text-muted-foreground"}`}>
                    {isActive ? (
                      <Loader2Icon className="size-5 animate-spin" />
                    ) : isCompleted ? (
                      <CheckIcon className="size-5" />
                    ) : (
                      <Icon className="size-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${isPending ? "text-muted-foreground" : ""}`}>
                      {stage.label}
                    </p>
                    {isActive && progress && (
                      <p className="text-xs text-muted-foreground">
                        {progress.files_found && `${progress.files_found} files found`}
                        {progress.chunks && `${progress.chunks} code chunks`}
                      </p>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {(error || isComplete) && (
          <div className="flex justify-end pt-2">
            <Button onClick={() => onOpenChange(false)}>
              {error ? "Close" : "Start Chatting"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
