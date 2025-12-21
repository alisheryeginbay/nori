"use client"

import { Clock, GitFork } from "lucide-react"
import { cn } from "@/lib/utils"
import type { RecentRepo } from "@/lib/api"

interface RecentRepoListProps {
  repos: RecentRepo[]
  onSelect: (repoId: string) => void
  className?: string
  isLoading?: boolean
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export function RecentRepoList({
  repos,
  onSelect,
  className,
  isLoading,
}: RecentRepoListProps) {
  if (isLoading) {
    return (
      <div className={cn("grid grid-cols-3 gap-2", className)}>
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-16 bg-muted/50 rounded-xl animate-pulse"
          />
        ))}
      </div>
    )
  }

  if (repos.length === 0) {
    return null
  }

  return (
    <div className={cn("grid grid-cols-3 gap-2", className)}>
      {repos.slice(0, 6).map((repo) => {
        const [, name] = repo.id.split("/")
        return (
          <button
            key={repo.id}
            type="button"
            onClick={() => onSelect(repo.id)}
            className={cn(
              "flex flex-col gap-1 p-3 rounded-xl text-left",
              "bg-card border border-border",
              "hover:border-foreground/20 hover:bg-accent/50",
              "transition-colors duration-200"
            )}
          >
            <div className="flex items-center gap-2">
              <GitFork className="size-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium truncate">{name}</span>
            </div>
            <div className="flex items-center gap-1 mt-auto">
              <Clock className="size-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {formatTimeAgo(repo.last_chatted_at)}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
