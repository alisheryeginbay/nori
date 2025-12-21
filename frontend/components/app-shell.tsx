"use client"

import * as React from "react"
import { type SerializedUser } from "@/components/user-menu"
import { SettingsDialog } from "@/components/settings-dialog"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { getUser } from "@/lib/api"

interface AppContextValue {
  user: SerializedUser | null
  hasApiKey: boolean | null
  openSettings: () => void
}

const AppContext = React.createContext<AppContextValue | null>(null)

export function useApp() {
  const context = React.useContext(AppContext)
  if (!context) {
    throw new Error("useApp must be used within AppShell")
  }
  return context
}

interface AppShellProps {
  user: SerializedUser | null
  children: React.ReactNode
}

export function AppShell({ user, children }: AppShellProps) {
  const [hasApiKey, setHasApiKey] = React.useState<boolean | null>(null)
  const [settingsOpen, setSettingsOpen] = React.useState(false)

  React.useEffect(() => {
    if (user) {
      getUser(user.id)
        .then((data) => setHasApiKey(data.has_anthropic_key))
        .catch(() => setHasApiKey(false))
    }
  }, [user])

  const contextValue = React.useMemo(
    () => ({
      user,
      hasApiKey,
      openSettings: () => setSettingsOpen(true),
    }),
    [user, hasApiKey]
  )

  return (
    <AppContext.Provider value={contextValue}>
      <SidebarProvider>
        <AppSidebar user={user} onOpenSettings={() => setSettingsOpen(true)} />
        <SidebarInset>
          {children}

          {user && (
            <SettingsDialog
              open={settingsOpen}
              onOpenChange={setSettingsOpen}
              userId={user.id}
              hasApiKey={hasApiKey ?? false}
              onApiKeyUpdated={setHasApiKey}
            />
          )}
        </SidebarInset>
      </SidebarProvider>
    </AppContext.Provider>
  )
}
