"use client"

import * as React from "react"
import { motion } from "motion/react"
import { useSignIn } from "@clerk/nextjs"
import { UserMenu, type SerializedUser } from "@/components/user-menu"
import { ChatMessage, type Message } from "./chat-message"
import { ChatInput } from "./chat-input"
import { RepoList } from "./repo-list"
import { Button } from "@/components/ui/button"
import { SettingsDialog } from "@/components/settings-dialog"
import { IndexingDialog } from "@/components/indexing-dialog"
import { GithubIcon } from "lucide-react"
import type { GitHubRepo } from "@/app/api/github/repos/route"
import {
  getUser,
  getRepoStatus,
  indexRepo,
  createChat,
  sendMessage,
  type IndexProgress,
  type Chat,
} from "@/lib/api"

interface ChatLayoutProps {
  user: SerializedUser | null
  repos: GitHubRepo[]
}

function parseGitHubUrl(text: string): { owner: string; repo: string } | null {
  const match = text.match(/github\.com\/([^\/\s]+)\/([^\/\s#?]+)/i)
  if (match) {
    return { owner: match[1], repo: match[2].replace(/\.git$/, "") }
  }
  return null
}

export function ChatLayout({ user, repos }: ChatLayoutProps) {
  const [messages, setMessages] = React.useState<Message[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [selectedRepo, setSelectedRepo] = React.useState<GitHubRepo | null>(null)
  const [hasApiKey, setHasApiKey] = React.useState<boolean | null>(null)
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [currentChat, setCurrentChat] = React.useState<Chat | null>(null)

  // Indexing state
  const [indexingOpen, setIndexingOpen] = React.useState(false)
  const [indexingRepo, setIndexingRepo] = React.useState<string>("")
  const [indexProgress, setIndexProgress] = React.useState<IndexProgress | null>(null)
  const [indexError, setIndexError] = React.useState<string | null>(null)
  const [indexComplete, setIndexComplete] = React.useState(false)

  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const { signIn, isLoaded } = useSignIn()

  const hasMessages = messages.length > 0

  // Fetch user's API key status on mount
  React.useEffect(() => {
    if (user) {
      getUser(user.id)
        .then((data) => setHasApiKey(data.has_anthropic_key))
        .catch(() => setHasApiKey(false))
    }
  }, [user])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  React.useEffect(() => {
    scrollToBottom()
  }, [messages])

  const signInWithGitHub = async () => {
    if (!isLoaded || !signIn) return
    await signIn.authenticateWithRedirect({
      strategy: "oauth_github",
      redirectUrl: "/sso-callback",
      redirectUrlComplete: "/",
    })
  }

  const handleRepoSelect = async (repo: GitHubRepo) => {
    if (!user) {
      signInWithGitHub()
      return
    }

    // Check if user has API key
    if (!hasApiKey) {
      setSettingsOpen(true)
      return
    }

    setSelectedRepo(repo)

    // Check if repo is indexed
    const [owner, repoName] = repo.full_name.split("/")
    const status = await getRepoStatus(owner, repoName)

    if (status?.status === "ready") {
      // Already indexed, create chat
      try {
        const chat = await createChat(user.id, repo.full_name)
        setCurrentChat(chat)
      } catch (err) {
        console.error("Failed to create chat:", err)
      }
    } else {
      // Need to index
      setIndexingRepo(repo.full_name)
      setIndexProgress(null)
      setIndexError(null)
      setIndexComplete(false)
      setIndexingOpen(true)

      try {
        const result = await indexRepo(owner, repoName, user.id, (progress) => {
          setIndexProgress(progress)
        })

        if (result.status === "ready") {
          setIndexComplete(true)
          // Create chat after successful indexing
          const chat = await createChat(user.id, repo.full_name)
          setCurrentChat(chat)
        }
      } catch (err) {
        setIndexError(err instanceof Error ? err.message : "Failed to index repo")
      }
    }
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

    // Parse GitHub URL from message, or use selected repo
    const parsedRepo = parseGitHubUrl(content)
    let targetRepo = selectedRepo

    if (parsedRepo) {
      // User pasted a URL - find or create the repo reference
      const fullName = `${parsedRepo.owner}/${parsedRepo.repo}`
      targetRepo = repos.find((r) => r.full_name === fullName) || {
        id: 0,
        name: parsedRepo.repo,
        full_name: fullName,
        description: null,
        html_url: `https://github.com/${fullName}`,
        language: null,
        stargazers_count: 0,
        updated_at: new Date().toISOString(),
        private: false,
      }

      // Check if this repo needs indexing
      const status = await getRepoStatus(parsedRepo.owner, parsedRepo.repo)
      if (!status || status.status !== "ready") {
        // Need to index first
        setSelectedRepo(targetRepo)
        setIndexingRepo(fullName)
        setIndexProgress(null)
        setIndexError(null)
        setIndexComplete(false)
        setIndexingOpen(true)

        try {
          await indexRepo(parsedRepo.owner, parsedRepo.repo, user.id, (progress) => {
            setIndexProgress(progress)
          })
          setIndexComplete(true)
          const chat = await createChat(user.id, fullName)
          setCurrentChat(chat)
        } catch (err) {
          setIndexError(err instanceof Error ? err.message : "Failed to index repo")
          return
        }
      } else if (!currentChat || currentChat.repo_id !== fullName) {
        // Create new chat for this repo
        const chat = await createChat(user.id, fullName)
        setCurrentChat(chat)
        setSelectedRepo(targetRepo)
      }
    }

    if (!currentChat && !targetRepo) {
      return
    }

    // Create chat if needed
    let chatId = currentChat?.id
    if (!chatId && targetRepo) {
      try {
        const chat = await createChat(user.id, targetRepo.full_name)
        setCurrentChat(chat)
        chatId = chat.id
      } catch (err) {
        console.error("Failed to create chat:", err)
        return
      }
    }

    if (!chatId) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
    }

    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    const assistantId = (Date.now() + 1).toString()
    let assistantMessageAdded = false

    try {
      await sendMessage(chatId, content, user.id, {
        onText: (text) => {
          if (!assistantMessageAdded) {
            setMessages((prev) => [
              ...prev,
              { id: assistantId, role: "assistant" as const, content: text },
            ])
            assistantMessageAdded = true
          } else {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId
                  ? { ...msg, content: msg.content + text }
                  : msg
              )
            )
          }
        },
        onError: (error) => {
          if (!assistantMessageAdded) {
            setMessages((prev) => [
              ...prev,
              { id: assistantId, role: "assistant" as const, content: `Error: ${error}` },
            ])
          } else {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId
                  ? { ...msg, content: msg.content + `\n\nError: ${error}` }
                  : msg
              )
            )
          }
        },
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Something went wrong"
      if (!assistantMessageAdded) {
        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: "assistant" as const, content: errorMessage },
        ])
      } else {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? { ...msg, content: errorMessage }
              : msg
          )
        )
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="shrink-0 px-4 py-3">
        <div className="max-w-[1000px] mx-auto flex items-center justify-between">
          <a href="/" className="text-lg font-semibold hover:opacity-80 transition-opacity">
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

      <div className="flex-1 flex flex-col min-h-0">
        {/* Welcome section */}
        {!hasMessages && (
          <div className="flex-1 flex items-end justify-center pb-4">
            <h1 className="text-2xl font-semibold flex">
              {"What can I help you with?".split("").map((char, index) => (
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
          </div>
        )}

        {/* Messages area */}
        {hasMessages && (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-[1000px] mx-auto px-4 py-6 space-y-4">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <ChatMessage message={message} />
                </motion.div>
              ))}
              {isLoading && !messages.some((m) => m.role === "assistant" && m.id === (Date.now() + 1).toString()) && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-2.5">
                    <div className="flex gap-1">
                      <span className="size-2 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <span className="size-2 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <span className="size-2 bg-foreground/40 rounded-full animate-bounce" />
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        {/* Input area */}
        <div className="shrink-0 w-full max-w-[1000px] mx-auto px-4 py-4">
          <ChatInput
            onSend={handleSend}
            disabled={isLoading}
            placeholder={
              selectedRepo
                ? `Ask about ${selectedRepo.name}...`
                : "Paste a GitHub URL or select a repo..."
            }
          />
        </div>

        {/* Repo list */}
        {repos.length > 0 && !hasMessages && (
          <div className="shrink-0 w-full max-w-[1000px] mx-auto px-4">
            <RepoList
              repos={repos}
              selectedRepo={selectedRepo?.full_name}
              onSelect={handleRepoSelect}
            />
          </div>
        )}

        {/* Bottom spacer - grows on home */}
        <motion.div
          initial={false}
          animate={{ flexGrow: hasMessages ? 0 : 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 25 }}
        />
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
