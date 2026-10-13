"use client"

import { useEffect, useRef } from "react"
import Script from "next/script"
import LoaderCircleIcon from "lucide-react/dist/esm/icons/loader-circle"

import { Button } from "@/components/ui/button"

import { useGoogleAuthController } from "../hooks/use-google-auth-controller"
import { resolveGoogleAuthCapabilities } from "../lib"
import type { GoogleAuthMode, GoogleSignupInput } from "../types"

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: {
            client_id: string
            callback(response: { credential: string }): void
            nonce: string
            context: "signin" | "signup"
            ux_mode: "popup"
            auto_select: boolean
            cancel_on_tap_outside: boolean
          }): void
          renderButton(
            element: HTMLElement,
            options: {
              type: "standard"
              theme: "outline"
              size: "large"
              text: "continue_with" | "signin_with" | "signup_with"
              shape: "rectangular"
              logo_alignment: "left"
              width: number
            }
          ): void
        }
      }
    }
  }
}

type GoogleAuthPanelProps = {
  mode: GoogleAuthMode
  redirectTo: string
  disabled?: boolean
  accountIntent?: string
  intentFocus?: GoogleSignupInput["intentFocus"]
  signUpMetadata?: Record<string, unknown>
  showDivider?: boolean
  redirectOnSuccess?: boolean
  onSuccess?: () => void | Promise<void>
}

export function GoogleAuthPanel({
  mode,
  redirectTo,
  disabled = false,
  accountIntent,
  intentFocus,
  signUpMetadata,
  showDivider = true,
  onSuccess,
  redirectOnSuccess = true,
}: GoogleAuthPanelProps) {
  const buttonRef = useRef<HTMLDivElement>(null)
  const {
    errorMessage,
    initializeButton,
    isPending,
    scriptReady,
    setErrorMessage,
    setScriptReady,
  } = useGoogleAuthController({
    mode,
    redirectTo,
    disabled,
    accountIntent,
    intentFocus,
    signUpMetadata,
    onSuccess,
    redirectOnSuccess,
  })
  const isConfigured = resolveGoogleAuthCapabilities({
    clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    linkingEnabled: process.env.NEXT_PUBLIC_GOOGLE_LINKING_ENABLED,
    loginEnabled: process.env.NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED,
    signupEnabled: process.env.NEXT_PUBLIC_GOOGLE_SIGNUP_ENABLED,
  })[mode]

  useEffect(() => {
    if (!buttonRef.current) return
    void initializeButton(buttonRef.current)
  }, [initializeButton])

  if (!isConfigured) return null

  return (
    <div className="space-y-3">
      {showDivider ? (
        <div className="relative" aria-hidden="true">
          <div className="absolute inset-0 flex items-center">
            <span className="border-border w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background text-muted-foreground px-2">Or</span>
          </div>
        </div>
      ) : null}
      <Script
        id="google-identity-services"
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
        onError={() =>
          setErrorMessage("Google sign-in is unavailable. Please try again.")
        }
      />
      <div className="relative min-h-10 w-full">
        {disabled || !scriptReady ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full"
            disabled
          >
            Continue with Google
          </Button>
        ) : (
          <div
            ref={buttonRef}
            className={
              isPending
                ? "pointer-events-none overflow-hidden rounded-md opacity-60"
                : "overflow-hidden rounded-md"
            }
            aria-hidden={isPending || undefined}
          />
        )}
        {isPending ? (
          <div
            className="bg-background/85 absolute inset-0 flex min-h-11 items-center justify-center gap-2 rounded-md text-sm font-medium"
            role="status"
          >
            <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
            <span>
              {mode === "signup"
                ? "Creating account…"
                : mode === "link"
                  ? "Connecting…"
                  : "Signing in…"}
            </span>
          </div>
        ) : null}
      </div>
      {errorMessage ? (
        <p className="text-destructive text-sm" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  )
}
