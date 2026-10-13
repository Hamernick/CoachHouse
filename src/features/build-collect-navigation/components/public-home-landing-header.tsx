"use client"

import { useRouter } from "next/navigation"
import { PublicThemeToggle } from "@/components/organization/public-theme-toggle"
import { HomeCanvasLoginButton } from "@/components/public/home-canvas-login-button"
import type { BuildCollectActiveArea } from "../types"
import { BuildCollectPublicHeader } from "./build-collect-public-header"

export function PublicHomeLandingHeader({ activeArea = "collect" }: { activeArea?: BuildCollectActiveArea }) {
  const router = useRouter()

  return (
    <BuildCollectPublicHeader
      activeArea={activeArea}
      showPublicSearch={false}
      authAction={
        <HomeCanvasLoginButton
          activeSection="find"
          changeSection={() => router.push("/login")}
        />
      }
      themeAction={
        <PublicThemeToggle
          variant="outline"
          size="icon"
          className="relative size-8 shrink-0 touch-manipulation shadow-none after:absolute after:left-1/2 after:top-1/2 after:size-11 after:-translate-1/2"
        />
      }
    />
  )
}
