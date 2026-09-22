"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import LoaderCircleIcon from "lucide-react/dist/esm/icons/loader-circle"

import { Button } from "@/components/ui/button"
import { useSupabaseClient } from "@/hooks/use-supabase-client"
import { DEFAULT_POST_AUTH_REDIRECT } from "@/lib/auth/redirects"
import type { CanvasSectionId } from "./home-canvas-preview-config"

type HomeCanvasLoginButtonProps = {
  activeSection: CanvasSectionId
  changeSection: (section: CanvasSectionId) => void
}

export function HomeCanvasLoginButton({
  activeSection,
  changeSection,
}: HomeCanvasLoginButtonProps) {
  const router = useRouter()
  const supabase = useSupabaseClient()
  const [isLoginRoutePending, setIsLoginRoutePending] = useState(false)

  async function handleLoginClick() {
    if (isLoginRoutePending || activeSection === "login") return

    setIsLoginRoutePending(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session) {
        router.replace(DEFAULT_POST_AUTH_REDIRECT)
        router.refresh()
        return
      }
    } catch {
      // If the session probe fails, keep the normal login form available.
    }

    setIsLoginRoutePending(false)
    changeSection("login")
  }

  return (
    <Button
      variant={activeSection === "login" ? "default" : "outline"}
      size="sm"
      className="h-11 rounded-full md:h-8"
      disabled={isLoginRoutePending}
      aria-busy={isLoginRoutePending || undefined}
      onClick={handleLoginClick}
    >
      {isLoginRoutePending ? (
        <>
          <LoaderCircleIcon className="animate-spin" data-icon="inline-start" aria-hidden />
          <span>Opening…</span>
        </>
      ) : (
        "Login"
      )}
    </Button>
  )
}
