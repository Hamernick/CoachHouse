"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { useSupabaseClient } from "@/hooks/use-supabase-client"

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
}: UseGoogleAuthControllerInput) {
  const supabase = useSupabaseClient()
  const router = useRouter()
  const nonceRef = useRef<string | null>(null)
  const [scriptReady, setScriptReady] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleCredential = useCallback(
    async (credential: string) => {
      const nonce = nonceRef.current
      if (!nonce || isPending) return

      setIsPending(true)
      setErrorMessage(null)

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
            setErrorMessage(resolveGoogleAuthErrorMessage({ mode }))
            return
          }
        }

        await onSuccess?.()
        if (mode === "link") {
          router.refresh()
          return
        }

        if (!redirectOnSuccess) return
        router.replace(redirectTo)
        router.refresh()
      } catch {
        setErrorMessage(resolveGoogleAuthErrorMessage({ mode }))
      } finally {
        setIsPending(false)
      }
    },
    [
      accountIntent,
      intentFocus,
      isPending,
      mode,
      onSuccess,
      redirectOnSuccess,
      redirectTo,
      router,
      signUpMetadata,
      supabase,
    ]
  )

  const initializeButton = useCallback(
    async (element: HTMLElement) => {
      if (
        !scriptReady ||
        disabled ||
        !window.google?.accounts.id ||
        !process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
      ) {
        return
      }

      const { nonce, nonceHash } = await createGoogleNonce()
      nonceRef.current = nonce
      element.replaceChildren()

      window.google.accounts.id.initialize({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        callback: ({ credential }) => void handleCredential(credential),
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
      })
    },
    [disabled, handleCredential, mode, scriptReady]
  )

  useEffect(() => {
    setErrorMessage(null)
  }, [mode])

  return {
    errorMessage,
    initializeButton,
    isPending,
    scriptReady,
    setErrorMessage,
    setScriptReady,
  }
}
