"use client"

import * as React from "react"
import { motion, AnimatePresence } from "motion/react"
import { Loader2, GitBranch, FileCode, Sparkles, Database, Check } from "lucide-react"
import type { IndexProgress } from "@/lib/api"

interface IndexingViewProps {
  repoName: string
  progress: IndexProgress | null
  error: string | null
}

const stages = [
  { key: "cloning", label: "Cloning repository", icon: GitBranch },
  { key: "parsing", label: "Parsing files", icon: FileCode },
  { key: "embedding", label: "Creating embeddings", icon: Sparkles },
  { key: "storing", label: "Storing vectors", icon: Database },
] as const

export function IndexingView({ repoName, progress, error }: IndexingViewProps) {
  const [displayedFiles, setDisplayedFiles] = React.useState<string[]>([])
  const currentStageIndex = progress
    ? stages.findIndex(s => s.key === progress.stage)
    : 0

  // Simulate file names scrolling by during parsing/embedding
  React.useEffect(() => {
    if (!progress || (progress.stage !== "parsing" && progress.stage !== "embedding")) {
      return
    }

    const fileExtensions = [".py", ".ts", ".js", ".tsx", ".jsx", ".go", ".rs", ".java", ".rb", ".php"]
    const filePrefixes = ["src/", "lib/", "utils/", "components/", "services/", "models/", "api/", "core/"]
    const fileNames = ["index", "main", "app", "utils", "helpers", "config", "types", "schema", "handler", "service"]

    const interval = setInterval(() => {
      const ext = fileExtensions[Math.floor(Math.random() * fileExtensions.length)]
      const prefix = filePrefixes[Math.floor(Math.random() * filePrefixes.length)]
      const name = fileNames[Math.floor(Math.random() * fileNames.length)]
      const newFile = `${prefix}${name}${ext}`

      setDisplayedFiles(prev => [...prev.slice(-4), newFile])
    }, 200)

    return () => clearInterval(interval)
  }, [progress?.stage])

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

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8"
      >
        {/* Repo name */}
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Indexing Repository</h2>
          <p className="text-muted-foreground font-mono text-sm">{repoName}</p>
        </div>

        {/* Progress stages */}
        <div className="space-y-3">
          {stages.map((stage, index) => {
            const isActive = index === currentStageIndex
            const isComplete = index < currentStageIndex
            const isPending = index > currentStageIndex
            const Icon = stage.icon

            return (
              <motion.div
                key={stage.key}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  isActive
                    ? "bg-primary/10 border border-primary/20"
                    : isComplete
                      ? "bg-muted/50"
                      : "opacity-40"
                }`}
              >
                <div className={`size-8 rounded-full flex items-center justify-center ${
                  isComplete
                    ? "bg-primary text-primary-foreground"
                    : isActive
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}>
                  {isComplete ? (
                    <Check className="size-4" />
                  ) : isActive ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Icon className="size-4" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">{stage.label}</div>
                  {isActive && progress && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {progress.stage === "parsing" && progress.files_found && (
                        <>Found {progress.files_found} files</>
                      )}
                      {progress.stage === "embedding" && progress.chunks && (
                        <>Processing {progress.chunks} chunks ({Math.round(progress.progress)}%)</>
                      )}
                      {progress.stage === "cloning" && <>Downloading...</>}
                      {progress.stage === "storing" && <>Saving to database...</>}
                    </div>
                  )}
                </div>
                {isActive && (
                  <div className="text-xs font-mono text-muted-foreground">
                    {Math.round(progress?.progress || 0)}%
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>

        {/* Scrolling file names */}
        <AnimatePresence mode="popLayout">
          {displayedFiles.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-24 overflow-hidden relative"
            >
              <div className="absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-background to-transparent z-10" />
              <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-background to-transparent z-10" />
              <div className="space-y-1 py-4">
                {displayedFiles.map((file, index) => (
                  <motion.div
                    key={`${file}-${index}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 0.6, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-center text-xs font-mono text-muted-foreground"
                  >
                    {file}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
