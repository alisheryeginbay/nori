"use client"

import * as React from "react"
import { motion, AnimatePresence } from "motion/react"
import { Loader2 } from "lucide-react"
import type { IndexProgress } from "@/lib/api"

interface IndexingViewProps {
  repoName: string
  progress: IndexProgress | null
  error: string | null
}

const stages = {
  cloning: "Downloading repository",
  parsing: "Analyzing code",
  embedding: "Understanding context",
  storing: "Preparing for chat",
} as const

export function IndexingView({ repoName, progress, error }: IndexingViewProps) {
  const currentStage = progress?.stage || "cloning"
  const label = stages[currentStage]

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-destructive text-lg font-medium">Failed to index repository</div>
          <div className="text-muted-foreground text-sm max-w-md">{error}</div>
        </div>
      </div>
    )
  }

  const getSubtext = () => {
    if (!progress) return null
    switch (progress.stage) {
      case "cloning":
        return "This may take a moment..."
      case "parsing":
        return progress.files_found ? `Found ${progress.files_found} files` : null
      case "embedding":
        return progress.chunks ? `Processing ${progress.chunks} sections` : null
      case "storing":
        return "Almost ready..."
      default:
        return null
    }
  }

  const subtext = getSubtext()

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4">
      <div className="text-center space-y-6">
        {/* Repo name */}
        <p className="text-muted-foreground font-mono text-sm">{repoName}</p>

        {/* Current stage - animated */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStage}
            initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
            transition={{ duration: 0.3, ease: [0.215, 0.61, 0.355, 1] }}
            className="flex flex-col items-center gap-4"
          >
            <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Loader2 className="size-5 animate-spin" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">{label}</h2>
              {subtext && (
                <p className="text-sm text-muted-foreground">{subtext}</p>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
