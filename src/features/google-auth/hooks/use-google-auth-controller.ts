"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { useSupabaseClient } from "@/hooks/use-supabase-client"
import { getSafePostLoginRedirectPath } from "@/lib/auth/redirects"

import { loadGoogleIdentityScript } from "../lib/identity-script"
import { useGoogleAuthDiagnostics } from "./use-google-auth-diagnostics"

import {
  resolveGoogleAuthErrorMessage,
  sanitizeGoogleSignupMetadata,
} from "../lib"
import type {
  GoogleAuthMode,
  GoogleLinkValidationResult,
  GoogleSignupInput,
  GoogleSignupProvisionResult,
} from "../types"

function encodeBase64Url(bytes: Uint8Array) {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return window
    .btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "")
}

async function createGoogleNonce() {
  const randomBytes = window.crypto.getRandomValues(new Uint8Array(32))
  const nonce = encodeBase64Url(randomBytes)
  const digest = await window.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(nonce)
  )

  return {
    nonce,
    nonceHash: Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join(""),
  }
}

type UseGoogleAuthControllerInput = {
  mode: GoogleAuthMode
  redirectTo: string
  accountIntent?: string
  intentFocus?: GoogleSignupInput["intentFocus"]
  signUpMetadata?: Record<string, unknown>
  disabled?: boolean
  redirectOnSuccess?: boolean
  onSuccess?: () => void | Promise<void>
  enabled?: boolean
}

export function useGoogleAuthController({
  mode,
  redirectTo,
  accountIntent,
  intentFocus,
  signUpMetadata,
  disabled = false,
  onSuccess,
  redirectOnSuccess = true,
  enabled = true,
}: UseGoogleAuthControllerInput) {
  const supabase = useSupabaseClient()
  const router = useRouter()
  const nonceRef = useRef<string | null>(null)
  const initialization = useRef(0)
  const pendingRef = useRef(false)
  const [attempt, setAttempt] = useState(0)
  const [scriptReady, setScriptReady] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [recoveryMessage, setRecoveryMessage] = useState("")
  const { diagnostics, recordStage } = useGoogleAuthDiagnostics(mode)

  const prepareScript = useCallback(async () => {
    recordStage("loading")
    try {
      await loadGoogleIdentityScript()
      setScriptReady(true)
      return true
    } catch {
      recordStage("script_unavailable")
      setErrorMessage(
        "Google sign-in could not load. Restart sign-in or use your email and password."
      )
      return false
    }
  }, [recordStage])

  useEffect(() => {
    if (!enabled) return
    void prepareScript()
    return () => {
      initialization.current += 1
      nonceRef.current = null
    }
  }, [enabled, prepareScript])

  const handleCredential = useCallback(
    async (credential: string) => {
      const nonce = nonceRef.current
      if (!nonce || pendingRef.current || disabled || !enabled) return

      nonceRef.current = null
      pendingRef.current = true
      setIsPending(true)
      setErrorMessage(null)
      recordStage("credential_received")
      let succeeded = false

      try {
        if (mode === "signup") {
          const provisionResponse = await fetch("/api/auth/google/signup", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              credential,
              nonce,
              acceptedLegal: true,
              accountIntent: accountIntent ?? "founder_exec",
              intentFocus: intentFocus ?? "build",
              signUpMetadata: sanitizeGoogleSignupMetadata(signUpMetadata),
            }),
          })
          const provisionResult = (await provisionResponse.json().catch(() => ({
            ok: false,
            code: "unavailable",
          }))) as GoogleSignupProvisionResult

          if (!provisionResponse.ok || !provisionResult.ok) {
            recordStage("provision_failed")
            setErrorMessage(
              resolveGoogleAuthErrorMessage({
                mode,
                result: provisionResult,
              })
            )
            return
          }
        }

        if (mode === "link") {
          const linkResponse = await fetch("/api/auth/google/link", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ credential, nonce }),
          })
          const linkResult = (await linkResponse.json().catch(() => ({
            ok: false,
            code: "unavailable",
          }))) as GoogleLinkValidationResult

          if (!linkResponse.ok || !linkResult.ok) {
            recordStage("link_failed")
            setErrorMessage(
              resolveGoogleAuthErrorMessage({ mode, result: linkResult })
            )
            return
          }
        }

        const { error } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token: credential,
          nonce,
        })

        if (error) {
          recordStage("exchange_failed")
          setErrorMessage(resolveGoogleAuthErrorMessage({ mode }))
          return
        }

        if (mode === "link") {
          const { data: identitiesData, error: identitiesError } =
            await supabase.auth.getUserIdentities()

          if (
            identitiesError ||
            !identitiesData.identities.some(
              (identity) => identity.provider === "google"
            )
          ) {
            recordStage("link_failed")
            setErrorMessage(resolveGoogleAuthErrorMessage({ mode }))
            return
          }
        }

        recordStage("signed_in")
        succeeded = true
        await onSuccess?.()
        if (mode === "link") {
          router.refresh()
          return
        }

        if (!redirectOnSuccess) return
        router.replace(getSafePostLoginRedirectPath(redirectTo) ?? "/workspace")
        router.refresh()
      } catch {
        recordStage("exchange_failed")
        setErrorMessage(resolveGoogleAuthErrorMessage({ mode }))
      } finally {
        pendingRef.current = false
        setIsPending(false)
        if (!succeeded) setAttempt((value) => value + 1)
      }
    },
    [
      accountIntent,
      disabled,
      enabled,
      intentFocus,
      mode,
      onSuccess,
      redirectOnSuccess,
      redirectTo,
      router,
      signUpMetadata,
      supabase,
      recordStage,
    ]
  )

  const credentialHandler = useRef(handleCredential)
  useEffect(() => {
    credentialHandler.current = handleCredential
  }, [handleCredential])

  const initializeButton = useCallback(
    async (element: HTMLElement) => {
      if (
        !scriptReady ||
        !enabled ||
        disabled ||
        !window.google?.accounts.id ||
        !process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
      ) {
        return
      }

      const generation = ++initialization.current
      try {
        const { nonce, nonceHash } = await createGoogleNonce()
        if (
          generation !== initialization.current ||
          !element.isConnected ||
          pendingRef.current
        )
          return
        nonceRef.current = nonce
        element.replaceChildren()

        window.google.accounts.id.initialize({
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
          callback: ({ credential }) => {
            if (generation !== initialization.current) return
            void credentialHandler.current(credential)
          },
          nonce: nonceHash,
          context: mode === "signup" ? "signup" : "signin",
          ux_mode: "popup",
          auto_select: false,
          cancel_on_tap_outside: true,
        })
        window.google.accounts.id.renderButton(element, {
          type: "standard",
          theme: "outline",
          size: "large",
          text:
            mode === "signup"
              ? "signup_with"
              : mode === "link"
                ? "continue_with"
                : "signin_with",
          shape: "rectangular",
          logo_alignment: "left",
          width: Math.min(400, Math.max(220, element.clientWidth)),
          click_listener: () => {
            if (generation === initialization.current)
              recordStage("button_clicked")
          },
        })
        // A provider popup may fail without calling us. "Ready" is not proof of login.
        recordStage("ready")
      } catch {
        if (generation !== initialization.current) return
        recordStage("initialization_failed")
        setErrorMessage(
          "Google sign-in could not start. Restart sign-in or use your email and password."
        )
      }
    },
    [disabled, enabled, mode, scriptReady, recordStage]
  )

  const restartSignIn = useCallback(async () => {
    if (pendingRef.current) return
    initialization.current += 1
    nonceRef.current = null
    setErrorMessage(null)
    setRecoveryMessage("")
    recordStage("retry_requested")
    if (await prepareScript()) {
      setAttempt((value) => value + 1)
      setRecoveryMessage(
        "Sign-in restarted. Choose the Google button to try again."
      )
    }
  }, [prepareScript, recordStage])

  useEffect(() => {
    setErrorMessage(null)
  }, [mode])

  return {
    errorMessage,
    diagnostics,
    attempt,
    recoveryMessage,
    restartSignIn,
    initializeButton,
    isPending,
    scriptReady,
  }
}
