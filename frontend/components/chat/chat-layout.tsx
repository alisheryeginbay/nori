"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import { useSignIn } from "@clerk/nextjs"
import { UserMenu, type SerializedUser } from "@/components/user-menu"
import { ChatInput } from "./chat-input"
import { Button } from "@/components/ui/button"
import { SettingsDialog } from "@/components/settings-dialog"
import { IndexingDialog } from "@/components/indexing-dialog"
import { GithubIcon } from "lucide-react"
import {
  getUser,
  getRepoStatus,
  indexRepo,
  createChat,
  type IndexProgress,
} from "@/lib/api"

interface ChatLayoutProps {
  user: SerializedUser | null
}

function parseGitHubUrl(text: string): { owner: string; repo: string } | null {
  const match = text.match(/github\.com\/([^\/\s]+)\/([^\/\s#?]+)/i)
  if (match) {
    return { owner: match[1], repo: match[2].replace(/\.git$/, "") }
  }
  return null
}

export function ChatLayout({ user }: ChatLayoutProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = React.useState(false)
  const [hasApiKey, setHasApiKey] = React.useState<boolean | null>(null)
  const [settingsOpen, setSettingsOpen] = React.useState(false)

  // Indexing state
  const [indexingOpen, setIndexingOpen] = React.useState(false)
  const [indexingRepo, setIndexingRepo] = React.useState<string>("")
  const [indexProgress, setIndexProgress] = React.useState<IndexProgress | null>(null)
  const [indexError, setIndexError] = React.useState<string | null>(null)
  const [indexComplete, setIndexComplete] = React.useState(false)

  const { signIn, isLoaded } = useSignIn()

  // Fetch user's API key status on mount
  React.useEffect(() => {
    if (user) {
      getUser(user.id)
        .then((data) => setHasApiKey(data.has_anthropic_key))
        .catch(() => setHasApiKey(false))
    }
  }, [user])

  const signInWithGitHub = async () => {
    if (!isLoaded || !signIn) return
    await signIn.authenticateWithRedirect({
      strategy: "oauth_github",
      redirectUrl: "/sso-callback",
      redirectUrlComplete: "/",
    })
  }

  const handleSend = async (content: string) => {
    if (!user) {
      signInWithGitHub()
      return
    }

    // Check if user has API key
    if (!hasApiKey) {
      setSettingsOpen(true)
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
      // Check if this repo needs indexing
      const status = await getRepoStatus(parsedRepo.owner, parsedRepo.repo)

      if (!status || status.status !== "ready") {
        // Need to index first
        setIndexingRepo(fullName)
        setIndexProgress(null)
        setIndexError(null)
        setIndexComplete(false)
        setIndexingOpen(true)

        await indexRepo(parsedRepo.owner, parsedRepo.repo, user.id, (progress) => {
          setIndexProgress(progress)
        })
        setIndexComplete(true)
        setIndexingOpen(false)
      }

      // Create chat and redirect
      const chat = await createChat(user.id, fullName)
      router.push(`/chat/${chat.id}`)
    } catch (err) {
      setIndexError(err instanceof Error ? err.message : "Failed to index repo")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="max-w-[1000px] w-full mx-auto flex flex-col h-full border-x">
      <header className="shrink-0 px-8 py-4 border-b">
        <div className="flex items-center justify-between">
          <a href="/" className="text-lg font-semibold hover:opacity-80 transition-opacity flex items-center gap-2">
            <img src="/logo.svg" className="size-4" />
            Nori
          </a>
          {user ? (
            <UserMenu user={user} onOpenSettings={() => setSettingsOpen(true)} />
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={signInWithGitHub}
              disabled={!isLoaded}
            >
              <GithubIcon className="size-4" />
              Sign in with GitHub
            </Button>
          )}
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-8">
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
        <div className="w-full max-w-2xl">
          <ChatInput
            onSend={handleSend}
            disabled={isLoading}
            placeholder="Paste a GitHub URL..."
          />
        </div>
      </div>
      </div>

      {/* Settings Dialog */}
      {user && (
        <SettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          userId={user.id}
          hasApiKey={hasApiKey ?? false}
          onApiKeyUpdated={setHasApiKey}
        />
      )}

      {/* Indexing Dialog */}
      <IndexingDialog
        open={indexingOpen}
        onOpenChange={setIndexingOpen}
        repoName={indexingRepo}
        progress={indexProgress}
        error={indexError}
        isComplete={indexComplete}
      />
    </div>
  )
}
