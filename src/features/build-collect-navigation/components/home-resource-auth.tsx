"use client"

import { useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import XIcon from "lucide-react/dist/esm/icons/x"
import { Button } from "@/components/ui/button"

const SignUpForm = dynamic(() => import("@/components/auth/sign-up-form").then((module) => module.SignUpForm), { loading: () => <p role="status" className="text-sm text-muted-foreground">Loading sign up…</p> })
const LoginForm = dynamic(() => import("@/components/auth/login-form").then((module) => module.LoginForm), { loading: () => <p role="status" className="text-sm text-muted-foreground">Loading sign in…</p> })

export function HomeResourceAuth({ redirectTo, onClose, onAuthenticated }: { redirectTo: string; onClose: () => void; onAuthenticated: () => void }) {
  const [mode, setMode] = useState<"signup" | "login">("signup")
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    heading.current?.focus({ preventScroll: true })
    return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }) }
  }, [])
  return <section aria-label="Save your collection" className="absolute inset-0 z-10 animate-in fade-in-0 duration-150 motion-reduce:animate-none overflow-y-auto overscroll-y-auto bg-background p-4 sm:p-6" onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); onClose() } }}>
    <div className="mx-auto max-w-sm">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div><h4 ref={heading} tabIndex={-1} className="text-lg font-medium outline-none">{mode === "signup" ? "Keep your collection." : "Welcome back."}</h4>
          <p className="mt-1 text-sm text-muted-foreground">{mode === "signup" ? "Create a free account to save this resource." : "Sign in and keep collecting."}</p></div>
        <Button variant="ghost" size="icon" className="size-11 shrink-0 rounded-full" onClick={onClose} aria-label="Return to resources"><XIcon aria-hidden /></Button>
      </header>
      {mode === "signup" ? <SignUpForm lockedIntentFocus="find" redirectTo={redirectTo} onAuthenticated={onAuthenticated} onSignIn={() => setMode("login")} /> : <LoginForm redirectTo={redirectTo} onAuthenticated={onAuthenticated} onSignUp={() => setMode("signup")} />}
    </div>
  </section>
}
