"use client"

import * as React from "react"
import { useClerk } from "@clerk/nextjs"
import { useRouter } from "next/navigation"

export default function SSOCallbackPage() {
  const { handleRedirectCallback } = useClerk()
  const router = useRouter()

  React.useEffect(() => {
    async function handleCallback() {
      try {
        await handleRedirectCallback({
          redirectUrl: "/",
        })
      } catch (err) {
        router.push("/")
      }
    }
    handleCallback()
  }, [handleRedirectCallback, router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <div className="size-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
        <p className="text-sm text-muted-foreground">Signing in...</p>
      </div>
    </div>
  )
}
