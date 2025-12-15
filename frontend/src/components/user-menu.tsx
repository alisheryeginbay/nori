"use client"

import { useUser, useClerk } from "@clerk/nextjs"
import { UserIcon, LogOutIcon } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function UserMenu() {
  const { user } = useUser()
  const { signOut, openUserProfile } = useClerk()

  if (!user) return null

  const initials = user.firstName && user.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user.emailAddresses[0]?.emailAddress?.[0]?.toUpperCase() ?? "U"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center justify-center size-8 rounded-full bg-muted hover:bg-muted/80 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 overflow-hidden">
        {user.imageUrl ? (
          <img
            src={user.imageUrl}
            alt={user.fullName ?? "User"}
            className="size-full object-cover"
          />
        ) : (
          <span className="text-sm font-medium">{initials}</span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <span className="text-xs text-muted-foreground">
              {user.emailAddresses[0]?.emailAddress}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => openUserProfile()}>
          <UserIcon />
          My Profile
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
