"use client"

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import LoaderCircleIcon from "lucide-react/dist/esm/icons/loader-circle"

import { useSupabaseClient } from "@/hooks/use-supabase-client"
import {
  DEFAULT_POST_AUTH_REDIRECT,
  getSafeRedirectPath,
} from "@/lib/auth/redirects"
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
import { PasswordInput } from "@/components/auth/password-input"

const GoogleAuthPanel = dynamic(
  () =>
    import("@/features/google-auth").then((module) => module.GoogleAuthPanel),
  { ssr: false }
)

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

type LoginFormValues = z.infer<typeof schema>

type LoginFormProps = {
  redirectTo?: string
  initialError?: string | null
  signUpHref?: string
}

type ExistingAuthSession = { access_token?: string | null } | null | undefined

const authFooterLinkClassName =
  "rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

export function resolveExistingAuthSessionRedirect({
  session,
  redirectTo,
}: {
  session: ExistingAuthSession
  redirectTo: string
}) {
  return session ? redirectTo : null
}

function mapAuthErrorMessage(raw: string | null | undefined) {
  if (!raw) return null
  const normalized = raw.toLowerCase()

  if (
    normalized.includes("pkce code verifier") ||
    normalized.includes("code verifier not found in storage")
  ) {
    return "Email confirmed. Sign in to continue."
  }
  if (
    normalized.includes("invalid refresh token") ||
    normalized.includes("refresh token not found")
  ) {
    return "Session expired. Please sign in again."
  }
  if (normalized.includes("missing verification code")) {
    return "This verification link is incomplete. Request a new link and try again."
  }

  return raw
}

function mapAuthNoticeMessage(raw: string | null | undefined) {
  if (!raw) return null
  switch (raw) {
    case "email_confirmed_sign_in":
      return "Email confirmed. Sign in to continue."
    default:
      return null
  }
}

export function LoginForm({
  redirectTo,
  initialError,
  signUpHref,
}: LoginFormProps) {
  const supabase = useSupabaseClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const searchError = mapAuthErrorMessage(searchParams.get("error"))
  const noticeMessage = mapAuthNoticeMessage(searchParams.get("notice"))
  const redirectFromSearch = getSafeRedirectPath(searchParams.get("redirect"))
  const resolvedRedirectTo =
    redirectFromSearch ??
    getSafeRedirectPath(redirectTo) ??
    DEFAULT_POST_AUTH_REDIRECT
  const [errorMessage, setErrorMessage] = useState<string | null>(
    mapAuthErrorMessage(initialError) ?? searchError
  )
  const [isSigningIn, setIsSigningIn] = useState(false)
  const resolvedSignUpHref = useMemo(() => {
    const base = signUpHref ?? "/sign-up"
    if (!resolvedRedirectTo || base.includes("redirect=")) return base
    const separator = base.includes("?") ? "&" : "?"
    return `${base}${separator}redirect=${encodeURIComponent(resolvedRedirectTo)}`
  }, [resolvedRedirectTo, signUpHref])
  const resolvedForgotPasswordHref = useMemo(() => {
    const base = "/forgot-password"
    if (!resolvedRedirectTo) return base
    return `${base}?redirect=${encodeURIComponent(resolvedRedirectTo)}`
  }, [resolvedRedirectTo])

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: "",
    },
  })
  const isConfirmationMessage =
    errorMessage === "Email confirmed. Sign in to continue."

  useEffect(() => {
    setErrorMessage(mapAuthErrorMessage(initialError) ?? searchError)
  }, [initialError, searchError])

  useEffect(() => {
    let cancelled = false

    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return
        const redirectPath = resolveExistingAuthSessionRedirect({
          session: data.session,
          redirectTo: resolvedRedirectTo,
        })
        if (!redirectPath) return

        router.replace(redirectPath)
        router.refresh()
      })
      .catch(() => {
        // A failed session check should leave the sign-in form usable.
      })

    return () => {
      cancelled = true
    }
  }, [resolvedRedirectTo, router, supabase])

  async function onSubmit(values: LoginFormValues) {
    if (isSigningIn) return

    setErrorMessage(null)
    setIsSigningIn(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      })

      if (error) {
        setErrorMessage(mapAuthErrorMessage(error.message))
        setIsSigningIn(false)
        return
      }

      form.reset()
      router.replace(resolvedRedirectTo)
      router.refresh()
    } catch {
      setErrorMessage("Unable to sign in. Please try again.")
      setIsSigningIn(false)
    }
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
                  <PasswordInput {...field} autoComplete="current-password" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {errorMessage ? (
            <p
              className={
                isConfirmationMessage
                  ? "text-sm text-emerald-600 dark:text-emerald-400"
                  : "text-destructive text-sm"
              }
              role={isConfirmationMessage ? "status" : "alert"}
            >
              {errorMessage}
            </p>
          ) : noticeMessage ? (
            <p className="text-sm text-emerald-600" role="status">
              {noticeMessage}
            </p>
          ) : null}
          <Button
            className="w-full"
            type="submit"
            disabled={isSigningIn}
            aria-busy={isSigningIn || undefined}
          >
            {isSigningIn ? (
              <>
                <LoaderCircleIcon
                  className="animate-spin"
                  data-icon="inline-start"
                  aria-hidden
                />
                <span>Signing in…</span>
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </form>
      </Form>
      <GoogleAuthPanel mode="login" redirectTo={resolvedRedirectTo} />
      <div className="text-muted-foreground flex flex-wrap justify-between gap-x-4 gap-y-2 text-sm">
        <Link href={resolvedSignUpHref} className={authFooterLinkClassName}>
          Need an account? Sign up
        </Link>
        <Link
          href={resolvedForgotPasswordHref}
          className={authFooterLinkClassName}
        >
          Forgot password?
        </Link>
      </div>
    </div>
  )
}
