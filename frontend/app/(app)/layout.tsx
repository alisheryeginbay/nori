import { cookies } from "next/headers"
import { currentUser } from "@clerk/nextjs/server"
import { AppShell } from "@/components/app-shell"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false"

  const clerkUser = await currentUser()

  const user = clerkUser
    ? {
        id: clerkUser.id,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        fullName: clerkUser.fullName,
        imageUrl: clerkUser.imageUrl,
        email: clerkUser.emailAddresses[0]?.emailAddress ?? null,
      }
    : null

  return <AppShell user={user} defaultSidebarOpen={sidebarOpen}>{children}</AppShell>
}
