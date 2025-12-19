import { currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { ChatsView } from "@/components/chats-view"

export default async function ChatsPage() {
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

  return <ChatsView user={user} />
}
