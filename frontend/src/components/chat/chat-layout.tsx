"use client";

import * as React from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  SignedIn,
  SignedOut,
  SignInButton,
  useUser,
} from "@clerk/nextjs"
import { UserMenu } from "@/components/user-menu"
import { ChatMessage, type Message } from "./chat-message"
import { ChatInput } from "./chat-input"
import { Button } from "@/components/ui/button"
import { LogInIcon } from "lucide-react"

export function ChatLayout() {
  const { isLoaded, isSignedIn, user } = useUser()
  const [messages, setMessages] = React.useState<Message[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [showSignInPrompt, setShowSignInPrompt] = React.useState(false)
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  const hasMessages = messages.length > 0

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  React.useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async (content: string) => {
    if (!isSignedIn) {
      setShowSignInPrompt(true)
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
          {!isLoaded ? (
            <Button variant="outline" size="sm" disabled>
              Loading...
            </Button>
          ) : (
            <>
              <SignedIn>
                <UserMenu />
              </SignedIn>
              <SignedOut>
                <SignInButton mode="modal">
                  <Button variant="outline" size="sm" className="gap-2">
                    <LogInIcon className="size-4" />
                    Sign In
                  </Button>
                </SignInButton>
              </SignedOut>
            </>
          )}
        </div>
      </header>

      <div className="flex-1 flex flex-col min-h-0">
        <AnimatePresence>
          {!hasMessages && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{ paddingBottom: "100px" }}
            >
              <h1 className="text-2xl font-semibold">What can I help you with?</h1>
            </motion.div>
          )}
        </AnimatePresence>

        {!hasMessages && <div className="flex-1" />}

        {hasMessages && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.5 }}
            className="flex-1 overflow-y-auto"
          >
            <div className="max-w-[1000px] mx-auto px-4 py-6 space-y-4">
              {messages.map((message, index) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: index === 0 ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index === 0 ? 0 : 0.1 }}
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
          </motion.div>
        )}

        <motion.div
          layout
          transition={{
            layout: { duration: 0.7, ease: [0.32, 0.72, 0, 1] }
          }}
          className="shrink-0 w-full max-w-[1000px] mx-auto px-4 py-4"
        >
          <ChatInput
            onSend={handleSend}
            disabled={isLoading}
            placeholder={hasMessages ? "Type a message..." : "Ask anything..."}
          />
          <AnimatePresence>
            {showSignInPrompt && !isSignedIn && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="mt-3 p-3 bg-muted rounded-lg flex items-center justify-between"
              >
                <span className="text-sm text-muted-foreground">
                  Sign in to start chatting
                </span>
                <SignInButton mode="modal">
                  <Button size="sm" className="gap-2">
                    <LogInIcon className="size-4" />
                    Sign In
                  </Button>
                </SignInButton>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {!hasMessages && <div className="flex-1" />}
      </div>
    </div>
  )
}
