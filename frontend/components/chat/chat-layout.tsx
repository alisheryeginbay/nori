"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import { useSignIn } from "@clerk/nextjs"
import { UserMenu, type SerializedUser } from "@/components/user-menu"
import { ChatInput } from "./chat-input"
import { IndexingView } from "./indexing-view"
import { Button } from "@/components/ui/button"
import { SettingsDialog } from "@/components/settings-dialog"
import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar"
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
  const [isIndexing, setIsIndexing] = React.useState(false)
  const [indexingRepo, setIndexingRepo] = React.useState<string>("")
  const [indexProgress, setIndexProgress] = React.useState<IndexProgress | null>(null)
  const [indexError, setIndexError] = React.useState<string | null>(null)

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

  // If user is not logged in, show the sign-in layout without sidebar
  if (!user) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <div className="max-w-[1000px] w-full mx-auto flex flex-col h-full border-x">
          <header className="shrink-0 px-8 py-4 border-b">
            <div className="flex items-center justify-between">
              <a href="/" className="text-lg font-semibold hover:opacity-80 transition-opacity flex items-center gap-2">
                <img src="/logo.svg" className="size-4" alt="" />
                Nori
              </a>
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
      </div>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar userId={user.id} />
      <SidebarInset>
        <div className="flex flex-col h-screen bg-background">
          <header className="shrink-0 px-4 py-4 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
              </div>
              <UserMenu user={user} onOpenSettings={() => setSettingsOpen(true)} />
            </div>
          </header>

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
                <div className="w-full max-w-2xl">
                  <ChatInput
                    onSend={handleSend}
                    disabled={isLoading}
                    placeholder="Paste a GitHub URL..."
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Settings Dialog */}
        <SettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          userId={user.id}
          hasApiKey={hasApiKey ?? false}
          onApiKeyUpdated={setHasApiKey}
        />
      </SidebarInset>
    </SidebarProvider>
  )
}
