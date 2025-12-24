"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useApp } from "@/components/app-shell"
import { getPublicRepos, createChat, type PublicRepo } from "@/lib/api"

export function ReposView() {
  const router = useRouter()
  const { user, hasApiKey, openSettings } = useApp()
  const [repos, setRepos] = React.useState<PublicRepo[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [loadingRepoId, setLoadingRepoId] = React.useState<string | null>(null)

  React.useEffect(() => {
    getPublicRepos(user?.id)
      .then(setRepos)
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [user?.id])

  const handleRepoClick = async (repoId: string) => {
    if (!user) return

    if (!hasApiKey) {
      openSettings()
      return
    }

    setLoadingRepoId(repoId)
    try {
      const chat = await createChat(user.id, repoId)
      router.push(`/chat/${chat.id}`)
    } catch (err) {
      console.error("Failed to create chat:", err)
      setLoadingRepoId(null)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Unknown"
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return "Today"
    if (diffDays === 1) return "Yesterday"
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  const myRepos = repos.filter((r) => user && r.indexed_by === user.id)
  const otherRepos = repos.filter((r) => !user || r.indexed_by !== user.id)

  const RepoCard = ({ repo }: { repo: PublicRepo }) => (
    <div
      role="button"
      tabIndex={0}
      className={`p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring ${
        loadingRepoId === repo.id ? "opacity-50 pointer-events-none" : ""
      }`}
      onClick={() => handleRepoClick(repo.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          handleRepoClick(repo.id)
        }
      }}
    >
      <p className="font-medium truncate">{repo.id}</p>
      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
        <span>{repo.chunks_count} chunks</span>
        <span>·</span>
        <span>Indexed {formatDate(repo.indexed_at)}</span>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1000px] mx-auto px-8 py-8">
          <h1 className="text-2xl font-semibold mb-6">Public Repos</h1>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-16 bg-muted/50 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : repos.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No repos indexed yet</p>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="mt-4 text-sm text-primary hover:underline cursor-pointer"
              >
                Index a repository
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {user && myRepos.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-sm font-medium text-muted-foreground">
                    My Indexed Repos
                  </h2>
                  <div className="space-y-2">
                    {myRepos.map((repo) => (
                      <RepoCard key={repo.id} repo={repo} />
                    ))}
                  </div>
                </div>
              )}

              {otherRepos.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-sm font-medium text-muted-foreground">
                    {user && myRepos.length > 0 ? "Other Public Repos" : "Public Repos"}
                  </h2>
                  <div className="space-y-2">
                    {otherRepos.map((repo) => (
                      <RepoCard key={repo.id} repo={repo} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
