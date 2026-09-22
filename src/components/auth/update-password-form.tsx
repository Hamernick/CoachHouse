"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { useSupabaseClient } from "@/hooks/use-supabase-client"
import { DEFAULT_POST_AUTH_REDIRECT } from "@/lib/auth/redirects"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { PasswordInput } from "@/components/auth/password-input"

const schema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords must match",
  })

type UpdatePasswordValues = z.infer<typeof schema>

export type UpdatePasswordFormStatus = "checking" | "ready" | "retry"
export type UpdatePasswordRecoveryError = "invalid_or_expired" | "missing_code"

export function getUpdatePasswordRetryMessage(
  recoveryError?: UpdatePasswordRecoveryError | null,
) {
  switch (recoveryError) {
    case "missing_code":
      return "This reset link is incomplete. Request a new reset email and try again."
    case "invalid_or_expired":
      return "This reset link is invalid or expired. Request a new reset email to continue."
    default:
      return "Reset links are single-use. Request a new reset email to update your password."
  }
}

type UpdatePasswordFormProps = {
  redirectTo?: string
  initialStatus?: UpdatePasswordFormStatus
  recoveryError?: UpdatePasswordRecoveryError | null
  retryHref?: string
}

export function UpdatePasswordForm({
  redirectTo = DEFAULT_POST_AUTH_REDIRECT,
  initialStatus = "checking",
  recoveryError = null,
  retryHref = "/forgot-password",
}: UpdatePasswordFormProps) {
  const supabase = useSupabaseClient()
  const router = useRouter()
  const [status, setStatus] = useState<UpdatePasswordFormStatus>(
    recoveryError ? "retry" : initialStatus,
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const form = useForm<UpdatePasswordValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  })

  useEffect(() => {
    if (recoveryError || initialStatus !== "checking") return

    let cancelled = false
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return
      if (data.user) {
        setStatus("ready")
      } else {
        setStatus("retry")
      }
    })
    return () => {
      cancelled = true
    }
  }, [initialStatus, recoveryError, supabase])

  async function onSubmit(values: UpdatePasswordValues) {
    setErrorMessage(null)
    startTransition(async () => {
      const { error } = await supabase.auth.updateUser({ password: values.password })
      if (error) {
        setErrorMessage(error.message)
        return
      }
      form.reset()
      router.replace(redirectTo)
      router.refresh()
    })
  }

  if (status === "checking") {
    return <p className="text-sm text-muted-foreground">Verifying session...</p>
  }

  if (status === "retry") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground" role="alert">
          {getUpdatePasswordRetryMessage(recoveryError)}
        </p>
        <Button asChild className="w-full">
          <Link href={retryHref}>Request a new reset link</Link>
        </Button>
        <Button asChild className="w-full" variant="ghost">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form method="post" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New password</FormLabel>
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
        {errorMessage ? (
          <p className="text-sm text-destructive" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <Button className="w-full" type="submit" disabled={isPending}>
          {isPending ? "Updating..." : "Update password"}
        </Button>
      </form>
    </Form>
  )
}
