"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { guestProfileHref } from "../lib/guest-profile"

const SignUpForm = dynamic(() => import("@/components/auth/sign-up-form").then((module) => module.SignUpForm), { loading: () => <p role="status">Loading sign up…</p> })
const LoginForm = dynamic(() => import("@/components/auth/login-form").then((module) => module.LoginForm), { loading: () => <p role="status">Loading sign in…</p> })

export function FiscalOptionalProfileAuth({ reference, onAuthenticated }: { reference: string; onAuthenticated: () => void }) {
  const [mode, setMode] = useState<"signup" | "login">("signup")
  return <div className="mt-4 max-w-sm">
    <p className="mb-3 text-sm text-muted-foreground">Use the email on your application. This step is optional and won’t affect review.</p>
    {mode === "signup"
      ? <SignUpForm lockedIntentFocus="build" redirectTo={guestProfileHref(reference)} onAuthenticated={onAuthenticated} onSignIn={() => setMode("login")} />
      : <LoginForm redirectTo={guestProfileHref(reference)} onAuthenticated={onAuthenticated} onSignUp={() => setMode("signup")} />}
  </div>
}
