"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { useSupabaseClient } from "@/hooks/use-supabase-client"
import { resolveAuthCallbackUrl } from "@/components/auth/auth-callback-url"
import { clearOnboardingDraft } from "@/components/onboarding/onboarding-dialog/draft"
import {
  signUpSchema,
  type SignUpValues,
} from "@/components/auth/sign-up-form-schema"
import type { IntentFocus } from "@/components/onboarding/onboarding-dialog/types"
import { PasswordInput } from "@/components/auth/password-input"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { FIND_PATH } from "@/lib/find/routes"
import {
  createSignupLegalConsent,
  LegalConsentField,
} from "@/features/legal-consent"
import { resolveGoogleAuthCapabilities } from "@/features/google-auth"

const GoogleAuthPanel = dynamic(
  () =>
    import("@/features/google-auth").then((module) => module.GoogleAuthPanel),
  { ssr: false }
)

const DEFAULT_BUILDER_REDIRECT = "/onboarding?source=signup"
const DEFAULT_MEMBER_REDIRECT = `${FIND_PATH}?member_onboarding=1&source=signup`
const authInlineLinkClassName =
  "rounded-sm underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

type SignUpFormProps = {
  redirectTo?: string
  builderRedirectTo?: string
  memberRedirectTo?: string
  loginHref?: string
  signUpMetadata?: Record<string, unknown>
  defaultIntentFocus?: IntentFocus
  lockedIntentFocus?: IntentFocus | null
}

function resolveLegacyAccountIntent(intentFocus: IntentFocus) {
  switch (intentFocus) {
    case "build":
      return "founder_exec"
    case "support":
      return "staff_operator"
    case "fund":
      return "funder_partner"
    case "find":
    default:
      return "board_member"
  }
}

function resolvePostSignUpRedirect({
  intentFocus,
  builderRedirectTo,
  memberRedirectTo,
  redirectTo,
}: {
  intentFocus: IntentFocus
  builderRedirectTo?: string
  memberRedirectTo?: string
  redirectTo?: string
}) {
  if (intentFocus === "build") {
    return builderRedirectTo ?? redirectTo ?? DEFAULT_BUILDER_REDIRECT
  }
  return memberRedirectTo ?? redirectTo ?? DEFAULT_MEMBER_REDIRECT
}

function appendRedirectToHref({
  baseHref,
  redirectTo,
}: {
  baseHref?: string
  redirectTo: string
}) {
  const base = baseHref ?? "/login"
  if (base.includes("redirect=")) return base
  const separator = base.includes("?") ? "&" : "?"
  return `${base}${separator}redirect=${encodeURIComponent(redirectTo)}`
}

function isExistingAccountResponse(
  user: { identities?: unknown[] } | null | undefined
) {
  return Boolean(
    user && Array.isArray(user.identities) && user.identities.length === 0
  )
}

function resolveSignUpErrorMessage(raw: string) {
  const normalized = raw.toLowerCase()
  if (normalized.includes("email rate limit exceeded")) {
    return "Too many verification emails were requested. Wait a minute and retry."
  }
  return raw
}

export function SignUpForm({
  redirectTo,
  builderRedirectTo,
  memberRedirectTo,
  loginHref,
  signUpMetadata,
  defaultIntentFocus = "build",
  lockedIntentFocus = null,
}: SignUpFormProps) {
  const supabase = useSupabaseClient()
  const router = useRouter()
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle")
  const [message, setMessage] = useState<string>("")
  const [countdown, setCountdown] = useState(20)
  const [isPending, startTransition] = useTransition()
  const activeIntentFocus = lockedIntentFocus ?? defaultIntentFocus
  const resolvedRedirectTo = useMemo(
    () =>
      resolvePostSignUpRedirect({
        intentFocus: activeIntentFocus,
        builderRedirectTo,
        memberRedirectTo,
        redirectTo,
      }),
    [activeIntentFocus, builderRedirectTo, memberRedirectTo, redirectTo]
  )
  const resolvedLoginHref = useMemo(
    () =>
      appendRedirectToHref({
        baseHref: loginHref,
        redirectTo: resolvedRedirectTo,
      }),
    [loginHref, resolvedRedirectTo]
  )
  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      acceptedLegal: false,
    },
  })
  const acceptedLegal = form.watch("acceptedLegal")
  const googleAuthConfigured = resolveGoogleAuthCapabilities({
    clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    linkingEnabled: process.env.NEXT_PUBLIC_GOOGLE_LINKING_ENABLED,
    loginEnabled: process.env.NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED,
    signupEnabled: process.env.NEXT_PUBLIC_GOOGLE_SIGNUP_ENABLED,
  }).signup

  useEffect(() => {
    if (status !== "success") return

    setCountdown(20)
    const intervalId = window.setInterval(() => {
      setCountdown((value) => (value <= 1 ? 0 : value - 1))
    }, 1000)
    const timeoutId = window.setTimeout(() => {
      router.replace(resolvedLoginHref)
      router.refresh()
    }, 20_000)

    return () => {
      window.clearInterval(intervalId)
      window.clearTimeout(timeoutId)
    }
  }, [resolvedLoginHref, router, status])

  async function onSubmit(values: SignUpValues) {
    setStatus("idle")
    setMessage("")
    setCountdown(20)

    startTransition(async () => {
      const legalConsent = createSignupLegalConsent()
      const emailRedirectTo = resolveAuthCallbackUrl(resolvedRedirectTo)

      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          emailRedirectTo,
          data: {
            ...(signUpMetadata ?? {}),
            account_intent: resolveLegacyAccountIntent(activeIntentFocus),
            onboarding_intent_focus: activeIntentFocus,
            legal_consent: legalConsent,
          },
        },
      })

      if (error) {
        setStatus("error")
        setMessage(resolveSignUpErrorMessage(error.message))
        return
      }

      if (isExistingAccountResponse(data.user)) {
        setStatus("error")
        setMessage(
          "An account with this email already exists. Sign in instead."
        )
        return
      }

      clearOnboardingDraft()
      setStatus("success")
      setMessage(
        "Check your inbox for your verification link from Coach House."
      )
      form.reset()
    })
  }

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form method="post" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <PasswordInput {...field} autoComplete="new-password" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm password</FormLabel>
                <FormControl>
                  <PasswordInput {...field} autoComplete="new-password" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="acceptedLegal"
            render={({ field, fieldState }) => (
              <LegalConsentField
                checked={field.value}
                disabled={isPending}
                onCheckedChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          {status !== "idle" ? (
            <p
              className={`text-sm ${status === "success" ? "text-emerald-600" : "text-destructive"}`}
              role={status === "error" ? "alert" : "status"}
            >
              {message}
              {status === "success" ? (
                <>
                  {" "}
                  Redirecting to sign in in {countdown}s.{" "}
                  <Link
                    href={resolvedLoginHref}
                    className={`underline hover:no-underline ${authInlineLinkClassName}`}
                  >
                    Go now
                  </Link>
                </>
              ) : (
                <>
                  {" "}
                  <Link
                    href={resolvedLoginHref}
                    className={`underline hover:no-underline ${authInlineLinkClassName}`}
                  >
                    Go to sign in
                  </Link>
                </>
              )}
            </p>
          ) : null}
          <Button
            className="w-full"
            type="submit"
            disabled={isPending}
            aria-busy={isPending || undefined}
          >
            {isPending ? "Creating account..." : "Create account"}
          </Button>
        </form>
      </Form>
      <GoogleAuthPanel
        mode="signup"
        redirectTo={resolvedRedirectTo}
        disabled={!acceptedLegal || isPending}
        accountIntent={resolveLegacyAccountIntent(activeIntentFocus)}
        intentFocus={activeIntentFocus}
        signUpMetadata={signUpMetadata}
      />
      {googleAuthConfigured && !acceptedLegal ? (
        <p className="text-muted-foreground text-center text-xs">
          Accept the Terms and Privacy Policy above to continue with Google.
        </p>
      ) : null}
      <div className="text-muted-foreground text-center text-sm">
        Already have an account?{" "}
        <Link href={resolvedLoginHref} className={authInlineLinkClassName}>
          Sign in
        </Link>
      </div>
    </div>
  )
}
