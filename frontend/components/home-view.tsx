"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import { ChatInput } from "@/components/chat/chat-input"
import { IndexingView } from "@/components/chat/indexing-view"
import { RecentRepoList } from "@/components/chat/recent-repo-list"
import { useApp } from "@/components/app-shell"
import {
  getRepoStatus,
  indexRepo,
  createChat,
  getRecentRepos,
  type IndexProgress,
  type RecentRepo,
} from "@/lib/api"

function parseGitHubUrl(text: string): { owner: string; repo: string } | null {
  const match = text.match(/github\.com\/([^\/\s]+)\/([^\/\s#?]+)/i)
  if (match) {
    return { owner: match[1], repo: match[2].replace(/\.git$/, "") }
  }
  return null
}

export function HomeView() {
  const router = useRouter()
  const { user, hasApiKey, openSettings } = useApp()
  const [isLoading, setIsLoading] = React.useState(false)

  // Recent repos state
  const [recentRepos, setRecentRepos] = React.useState<RecentRepo[]>([])
  const [isLoadingRecent, setIsLoadingRecent] = React.useState(true)

  // Indexing state
  const [isIndexing, setIsIndexing] = React.useState(false)
  const [indexingRepo, setIndexingRepo] = React.useState<string>("")
  const [indexProgress, setIndexProgress] = React.useState<IndexProgress | null>(null)
  const [indexError, setIndexError] = React.useState<string | null>(null)

  // Fetch recent repos on mount
  React.useEffect(() => {
    if (user) {
      getRecentRepos(user.id)
        .then(setRecentRepos)
        .catch(console.error)
        .finally(() => setIsLoadingRecent(false))
    } else {
      setIsLoadingRecent(false)
    }
  }, [user])

  // Handler for selecting a recent repo
  const handleRecentRepoSelect = async (repoId: string) => {
    if (!user) return

    if (!hasApiKey) {
      openSettings()
      return
    }

    setIsLoading(true)
    try {
      const chat = await createChat(user.id, repoId)
      router.push(`/chat/${chat.id}`)
    } catch (err) {
      console.error("Failed to create chat:", err)
      setIsLoading(false)
    }
  }

  const handleSend = async (content: string) => {
    if (!user) {
      // Sidebar shows sign in button
      return
    }

    // Check if user has API key
    if (!hasApiKey) {
      openSettings()
      return
    }

    // Parse GitHub URL from message
    const parsedRepo = parseGitHubUrl(content)

    if (!parsedRepo) {
      return
    }

    const fullName = `${parsedRepo.owner}/${parsedRepo.repo}`
    setIsLoading(true)

    try {
      // Check if repo needs indexing
      const status = await getRepoStatus(parsedRepo.owner, parsedRepo.repo)

      if (!status || status.status !== "ready") {
        // Show indexing view and start indexing
        setIsIndexing(true)
        setIndexingRepo(fullName)
        setIndexProgress({ stage: "cloning", progress: 0 })
        setIndexError(null)

        await indexRepo(parsedRepo.owner, parsedRepo.repo, user.id, (progress) => {
          setIndexProgress(progress)
        })
      }

      // Create chat and navigate
      const chat = await createChat(user.id, fullName)
      router.push(`/chat/${chat.id}`)
    } catch (err) {
      console.error("Failed:", err)
      setIndexError(err instanceof Error ? err.message : "Something went wrong")
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <AnimatePresence mode="wait">
        {isIndexing ? (
          <motion.div
            key="indexing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex"
          >
            <IndexingView
              repoName={indexingRepo}
              progress={indexProgress}
              error={indexError}
            />
          </motion.div>
        ) : (
          <motion.div
            key="home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center px-8"
          >
            <h1 className="text-2xl font-semibold flex mb-6">
              {"Which codebase shall we explore?".split("").map((char, index) => (
                <motion.span
                  key={index}
                  initial={{
                    opacity: 0,
                    scale: 0.75,
                    filter: "blur(10px)",
                    y: 20,
                  }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    filter: "blur(0px)",
                    y: 0,
                  }}
                  transition={{
                    duration: 0.5,
                    delay: index * 0.05,
                    ease: [0.215, 0.61, 0.355, 1],
                  }}
                  className={char === " " ? "w-[0.3em]" : ""}
                >
                  {char === " " ? "\u00A0" : char}
                </motion.span>
              ))}
            </h1>
            <div className="w-full max-w-2xl space-y-6">
              <ChatInput
                onSend={handleSend}
                disabled={isLoading}
                placeholder="Paste a GitHub URL..."
              />

              {user && (recentRepos.length > 0 || isLoadingRecent) && (
                <div className="space-y-3">
                  <h2 className="text-sm font-medium text-muted-foreground">
                    Continue
                  </h2>
                  <RecentRepoList
                    repos={recentRepos}
                    onSelect={handleRecentRepoSelect}
                    isLoading={isLoadingRecent}
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
