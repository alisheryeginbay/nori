"use client"

import * as React from "react"
import { motion } from "motion/react"
import { useSignIn } from "@clerk/nextjs"
import { UserMenu, type SerializedUser } from "@/components/user-menu"
import { ChatMessage, type Message } from "./chat-message"
import { ChatInput } from "./chat-input"
import { Button } from "@/components/ui/button"
import { SettingsDialog } from "@/components/settings-dialog"
import { GithubIcon } from "lucide-react"
import type { GitHubRepo } from "@/app/api/github/repos/route"
import {
  getUser,
  sendMessage,
  type ChatWithMessages,
} from "@/lib/api"

interface ChatViewProps {
  user: SerializedUser
  chat: ChatWithMessages
  repos: GitHubRepo[]
}

export function ChatView({ user, chat, repos }: ChatViewProps) {
  const [messages, setMessages] = React.useState<Message[]>(
    chat.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
    }))
  )
  const [isLoading, setIsLoading] = React.useState(false)
  const [hasApiKey, setHasApiKey] = React.useState<boolean | null>(null)
  const [settingsOpen, setSettingsOpen] = React.useState(false)

  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const { signIn, isLoaded } = useSignIn()

  // Get repo name from chat.repo_id (format: owner/repo)
  const repoName = chat.repo_id.split("/")[1] || chat.repo_id

  // Fetch user's API key status on mount
  React.useEffect(() => {
    getUser(user.id)
      .then((data) => setHasApiKey(data.has_anthropic_key))
      .catch(() => setHasApiKey(false))
  }, [user.id])

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

  const handleSend = async (content: string) => {
    // Check if user has API key
    if (!hasApiKey) {
      setSettingsOpen(true)
      return
    }

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
      await sendMessage(chat.id, content, user.id, {
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
      <div className="max-w-[1000px] w-full mx-auto flex flex-col h-full border-x">
      <header className="shrink-0 px-8 py-4 border-b">
        <div className="flex items-center justify-between">
          <a href="/" className="text-lg font-semibold hover:opacity-80 transition-opacity flex items-center gap-2">
            <img src="/logo.svg" className="size-4" alt="" />
            Nori
          </a>
          <UserMenu user={user} onOpenSettings={() => setSettingsOpen(true)} />
        </div>
      </header>

      <div className="flex-1 min-h-0 relative">
        {/* Messages area */}
        <div className="h-full overflow-y-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
          <div className="px-8 py-6 pb-24 space-y-4">
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

        {/* Input area */}
        <div className="absolute bottom-0 left-0 right-0 px-8 py-4 bg-gradient-to-t from-background via-background to-transparent">
          <ChatInput
            onSend={handleSend}
            disabled={isLoading}
            placeholder={`Ask about ${repoName}...`}
          />
        </div>
      </div>
      </div>

      {/* Settings Dialog */}
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        userId={user.id}
        hasApiKey={hasApiKey ?? false}
        onApiKeyUpdated={setHasApiKey}
      />
    </div>
  )
}
