"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { TrashIcon } from "lucide-react"
import { useApp } from "@/components/app-shell"
import { getChats, deleteChat, type Chat } from "@/lib/api"

export function ChatsView() {
  const router = useRouter()
  const { user } = useApp()
  const [chats, setChats] = React.useState<Chat[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    if (user) {
      getChats(user.id)
        .then(setChats)
        .catch(console.error)
        .finally(() => setIsLoading(false))
    }
  }, [user])

  const handleDeleteChat = async (chatId: string) => {
    try {
      await deleteChat(chatId)
      setChats((prev) => prev.filter((c) => c.id !== chatId))
    } catch (error) {
      console.error("Failed to delete chat:", error)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return "Today"
    if (diffDays === 1) return "Yesterday"
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  const formatChatTitle = (chat: Chat) => {
    if (chat.title) return chat.title
    return chat.repo_id
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1000px] mx-auto px-8 py-8">
          <h1 className="text-2xl font-semibold mb-6">Chat History</h1>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-16 bg-muted/50 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : chats.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No chats yet</p>
              <button
                onClick={() => router.push("/")}
                className="mt-4 text-sm text-primary hover:underline cursor-pointer"
              >
                Start a new chat
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {chats.map((chat) => (
                <div
                  key={chat.id}
                  role="button"
                  tabIndex={0}
                  className="group flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
                  onClick={() => router.push(`/chat/${chat.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      router.push(`/chat/${chat.id}`)
                    }
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">
                      {formatChatTitle(chat)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(chat.created_at)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteChat(chat.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 p-2 hover:bg-destructive/10 rounded-md transition-all cursor-pointer"
                  >
                    <TrashIcon className="size-4 text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
