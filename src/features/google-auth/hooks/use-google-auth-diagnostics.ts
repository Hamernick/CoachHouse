"use client"

import { useCallback, useRef, useState } from "react"

import { logger } from "@/lib/logger"

import {
  createGoogleAuthDiagnostics,
  type GoogleAuthDiagnostics,
  type GoogleAuthStage,
} from "../lib/recovery"
import type { GoogleAuthMode } from "../types"

export function useGoogleAuthDiagnostics(mode: GoogleAuthMode) {
  const reference = useRef<string | null>(null)
  const lastFailure = useRef<GoogleAuthStage | null>(null)
  const [diagnostics, setDiagnostics] = useState<GoogleAuthDiagnostics | null>(
    null
  )
  const recordStage = useCallback(
    (stage: GoogleAuthStage) => {
      reference.current ??= window.crypto.randomUUID()
      if (stage.endsWith("failed") || stage === "script_unavailable")
        lastFailure.current = stage
      const details = createGoogleAuthDiagnostics({
        reference: reference.current,
        timestamp: new Date().toISOString(),
        origin: window.location.origin,
        clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        release:
          process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
          document.documentElement.dataset.dplId,
        mode,
        stage,
        lastFailure: lastFailure.current,
      })
      setDiagnostics(details)
      logger.info("google_auth_browser_stage", details)
    },
    [mode]
  )

  return { diagnostics, recordStage }
}
