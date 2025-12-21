import { clerkClient, currentUser } from "@clerk/nextjs/server"
import { redirect, notFound } from "next/navigation"
import { ChatView } from "@/components/chat/chat-view"
import { getChat } from "@/lib/api"
import type { GitHubRepo } from "@/app/api/github/repos/route"

async function getGitHubRepos(userId: string): Promise<GitHubRepo[]> {
  try {
    const client = await clerkClient()
    const tokens = await client.users.getUserOauthAccessToken(userId, "github")

    if (!tokens.data || tokens.data.length === 0) {
      return []
    }

    const githubToken = tokens.data[0].token

    const response = await fetch(
      "https://api.github.com/user/repos?sort=updated&per_page=50",
      {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github.v3+json",
        },
        next: { revalidate: 60 },
      }
    )

    if (!response.ok) {
      return []
    }

    return response.json()
  } catch {
    return []
  }
}

interface ChatPageProps {
  params: Promise<{ id: string }>
}

export default async function ChatPage({ params }: ChatPageProps) {
  const { id } = await params
  const clerkUser = await currentUser()

  if (!clerkUser) {
    redirect("/")
  }

  const user = {
    id: clerkUser.id,
    firstName: clerkUser.firstName,
    lastName: clerkUser.lastName,
    fullName: clerkUser.fullName,
    imageUrl: clerkUser.imageUrl,
    email: clerkUser.emailAddresses[0]?.emailAddress ?? null,
  }

  let chat
  try {
    chat = await getChat(id)
  } catch {
    notFound()
  }

  // Verify the chat belongs to this user
  if (chat.user_id !== user.id) {
    notFound()
  }

  const repos = await getGitHubRepos(user.id)

  return <ChatView chat={chat} repos={repos} />
}
