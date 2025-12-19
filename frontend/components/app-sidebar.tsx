"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  PlusIcon,
  TrashIcon,
  MoreHorizontalIcon,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarFooter,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { UserMenu, type SerializedUser } from "@/components/user-menu"
import { getChats, deleteChat, type Chat } from "@/lib/api"

interface AppSidebarProps {
  user: SerializedUser
  onOpenSettings: () => void
}

export function AppSidebar({ user, onOpenSettings }: AppSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [chats, setChats] = React.useState<Chat[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  // Fetch chats on mount
  React.useEffect(() => {
    getChats(user.id)
      .then(setChats)
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [user.id])

  const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    try {
      await deleteChat(chatId)
      setChats((prev) => prev.filter((c) => c.id !== chatId))

      // If we're on the deleted chat, navigate home
      if (pathname === `/chat/${chatId}`) {
        router.push("/")
      }
    } catch (error) {
      console.error("Failed to delete chat:", error)
    }
  }

  const formatChatTitle = (chat: Chat) => {
    if (chat.title) return chat.title
    // Use repo_id as fallback (format: owner/repo)
    return chat.repo_id
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

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center justify-between px-2 py-1 group-data-[collapsible=icon]:justify-center">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 font-semibold text-sm hover:opacity-80 transition-opacity cursor-pointer group-data-[collapsible=icon]:hidden"
          >
            <img src="/logo.svg" className="size-4" alt="" />
            <span>Nori</span>
          </button>
          <SidebarTrigger />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            <span className="group-data-[collapsible=icon]:hidden">Chats</span>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* New Chat button */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => router.push("/")}
                  tooltip="New Chat"
                >
                  <PlusIcon className="size-4" />
                  <span>New Chat</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Loading state */}
              {isLoading && (
                <>
                  <SidebarMenuSkeleton showIcon />
                  <SidebarMenuSkeleton showIcon />
                  <SidebarMenuSkeleton showIcon />
                </>
              )}

              {/* Chat list */}
              {!isLoading && chats.map((chat) => (
                <SidebarMenuItem key={chat.id}>
                  <SidebarMenuButton
                    onClick={() => router.push(`/chat/${chat.id}`)}
                    isActive={pathname === `/chat/${chat.id}`}
                    tooltip={formatChatTitle(chat)}
                  >
                    <span className="truncate">{formatChatTitle(chat)}</span>
                  </SidebarMenuButton>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <SidebarMenuAction showOnHover>
                          <MoreHorizontalIcon className="size-4" />
                          <span className="sr-only">More</span>
                        </SidebarMenuAction>
                      }
                    />
                    <DropdownMenuContent side="right" align="start">
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={(e) => handleDeleteChat(chat.id, e)}
                      >
                        <TrashIcon className="size-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuItem>
              ))}

              {/* Empty state */}
              {!isLoading && chats.length === 0 && (
                <div className="px-2 py-4 text-sm text-muted-foreground text-center group-data-[collapsible=icon]:hidden">
                  No chats yet
                </div>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <UserMenu user={user} onOpenSettings={onOpenSettings} showName />
      </SidebarFooter>
    </Sidebar>
  )
}
