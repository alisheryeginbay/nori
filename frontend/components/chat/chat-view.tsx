"use client"

import * as React from "react"
import { motion } from "motion/react"
import { ChatMessage, type Message } from "./chat-message"
import { ChatInput } from "./chat-input"
import { useApp } from "@/components/app-shell"
import type { GitHubRepo } from "@/app/api/github/repos/route"
import { sendMessage, type ChatWithMessages } from "@/lib/api"

interface ChatViewProps {
  chat: ChatWithMessages
  repos: GitHubRepo[]
}

export function ChatView({ chat, repos }: ChatViewProps) {
  const { user, hasApiKey, openSettings } = useApp()
  const [messages, setMessages] = React.useState<Message[]>(
    chat.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
    }))
  )
  const [isLoading, setIsLoading] = React.useState(false)

  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const shouldAutoScroll = React.useRef(true)
  const lastScrollTop = React.useRef(0)
  const isScrollingProgrammatically = React.useRef(false)

  // Get repo info from chat.repo_id (format: owner/repo)
  const [owner, repoName] = chat.repo_id.split("/")

  const scrollToBottom = React.useCallback(() => {
    if (!shouldAutoScroll.current) return
    const container = scrollContainerRef.current
    if (!container) return

    // Mark as programmatic scroll to avoid triggering user scroll detection
    isScrollingProgrammatically.current = true
    container.scrollTop = container.scrollHeight
    lastScrollTop.current = container.scrollTop

    // Reset flag after scroll completes
    requestAnimationFrame(() => {
      isScrollingProgrammatically.current = false
    })
  }, [])

  // Disable auto-scroll when user scrolls up, re-enable when at bottom
  const handleScroll = () => {
    // Ignore programmatic scrolls
    if (isScrollingProgrammatically.current) return

    const container = scrollContainerRef.current
    if (!container) return

    const { scrollTop, scrollHeight, clientHeight } = container
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50

    // User scrolled up - disable auto-scroll
    if (scrollTop < lastScrollTop.current && !isAtBottom) {
      shouldAutoScroll.current = false
    }

    // User is at bottom - re-enable auto-scroll
    if (isAtBottom) {
      shouldAutoScroll.current = true
    }

    lastScrollTop.current = scrollTop
  }

  // Scroll on message changes
  React.useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const handleSend = async (content: string) => {
    if (!user) return

    // Check if user has API key
    if (!hasApiKey) {
      openSettings()
      return
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
    }

    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)
    shouldAutoScroll.current = true

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
      <div className="flex-1 min-h-0 relative">
        {/* Welcome message */}
        {messages.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-8 pointer-events-none">
            <h1 className="text-2xl font-semibold flex mb-2">
              {[owner, "/", repoName, "\u00A0", "is", "\u00A0", "ready"].map((part, index) => (
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
                    delay: index * 0.1,
                    ease: [0.215, 0.61, 0.355, 1],
                  }}
                >
                  {part}
                </motion.span>
              ))}
            </h1>
            <motion.p
              className="text-sm text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.5 }}
            >
              Ask anything about this repository
            </motion.p>
          </div>
        )}

        {/* Messages area */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
        >
          <div className="max-w-[1000px] mx-auto px-8 py-6 pb-24 space-y-6">
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
              >
                <div className="flex gap-1">
                  <span className="size-2 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="size-2 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="size-2 bg-foreground/40 rounded-full animate-bounce" />
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input area */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background to-transparent">
          <div className="max-w-[1000px] mx-auto px-8 py-4">
            <ChatInput
              onSend={handleSend}
              disabled={isLoading}
              placeholder={`Ask about ${repoName}...`}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
