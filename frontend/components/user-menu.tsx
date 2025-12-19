"use client"

import { useClerk } from "@clerk/nextjs"
import { LogOutIcon, SettingsIcon } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export interface SerializedUser {
  id: string
  firstName: string | null
  lastName: string | null
  fullName: string | null
  imageUrl: string
  email: string | null
}

interface UserMenuProps {
  user: SerializedUser
  onOpenSettings?: () => void
  showName?: boolean
}

export function UserMenu({ user, onOpenSettings, showName = false }: UserMenuProps) {
  const { signOut } = useClerk()

  const initials = user.firstName && user.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user.email?.[0]?.toUpperCase() ?? "U"

  const displayName = user.fullName ?? user.firstName ?? user.email

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md p-1 hover:bg-sidebar-accent transition-colors focus:outline-none cursor-pointer">
        <div className="flex items-center justify-center size-7 rounded-full bg-muted overflow-hidden shrink-0">
          {user.imageUrl ? (
            <img
              src={user.imageUrl}
              alt={user.fullName ?? "User"}
              className="size-full object-cover"
            />
          ) : (
            <span className="text-sm font-medium">{initials}</span>
          )}
        </div>
        {showName && displayName && (
          <span className="text-sm truncate group-data-[collapsible=icon]:hidden">{displayName}</span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-full bg-muted overflow-hidden shrink-0">
                {user.imageUrl ? (
                  <img
                    src={user.imageUrl}
                    alt={user.fullName ?? "User"}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="size-full flex items-center justify-center">
                    <span className="text-sm font-medium">{initials}</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">
                  {user.fullName ?? user.firstName ?? "User"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {user.email}
                </span>
              </div>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onOpenSettings}>
          <SettingsIcon />
          API Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => signOut()}>
          <LogOutIcon />
          Log Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
