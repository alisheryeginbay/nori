"use client";

import * as React from "react"
import { motion } from "motion/react"
import { useSignIn } from "@clerk/nextjs"
import { UserMenu, type SerializedUser } from "@/components/user-menu"
import { ChatMessage, type Message } from "./chat-message"
import { ChatInput } from "./chat-input"
import { RepoList } from "./repo-list"
import { Button } from "@/components/ui/button"
import { GithubIcon } from "lucide-react"

interface ChatLayoutProps {
  user: SerializedUser | null
}

export function ChatLayout({ user }: ChatLayoutProps) {
  const [messages, setMessages] = React.useState<Message[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const { signIn, isLoaded } = useSignIn()

  const hasMessages = messages.length > 0

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
    if (!user) {
      signInWithGitHub()
      return
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
    }

    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "This is a placeholder response. Connect to your AI backend to get real responses.",
      }
      setMessages((prev) => [...prev, assistantMessage])
      setIsLoading(false)
    }, 1000)
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="shrink-0 px-4 py-3">
        <div className="max-w-[1000px] mx-auto flex items-center justify-between">
          <a href="/" className="text-lg font-semibold hover:opacity-80 transition-opacity">
            Nori
          </a>
          {user ? (
            <UserMenu user={user} />
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
        {/* Welcome section - only on home */}
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
                    y: 20
                  }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    filter: "blur(0px)",
                    y: 0
                  }}
                  transition={{
                    duration: 0.5,
                    delay: index * 0.05,
                    ease: [0.215, 0.61, 0.355, 1]
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
              {messages.map((message, index) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <ChatMessage message={message} />
                </motion.div>
              ))}
              {isLoading && (
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

        {/* Input area - always at natural position */}
        <div className="shrink-0 w-full max-w-[1000px] mx-auto px-4 py-4">
          <ChatInput
            onSend={handleSend}
            disabled={isLoading}
            placeholder="Ask anything..."
          />
        </div>

        {/* Repo list */}
        {user && !hasMessages && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="shrink-0 w-full max-w-[1000px] mx-auto px-4"
          >
            <RepoList />
          </motion.div>
        )}

        {/* Bottom spacer - grows on home */}
        <motion.div
          initial={false}
          animate={{ flexGrow: hasMessages ? 0 : 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 25 }}
        />
      </div>
    </div>
  )
}
