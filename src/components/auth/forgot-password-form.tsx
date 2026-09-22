"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { resolveAuthCallbackUrl } from "@/components/auth/auth-callback-url"
import { useSupabaseClient } from "@/hooks/use-supabase-client"
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

const schema = z.object({
  email: z.string().email("Enter a valid email"),
})

type ForgotPasswordValues = z.infer<typeof schema>

type ForgotPasswordFormProps = {
  redirectTo?: string
}

export function buildForgotPasswordCallbackRedirect(redirectTo?: string) {
  if (!redirectTo) return "/update-password"
  if (redirectTo.startsWith("/update-password")) return redirectTo

  const updatePasswordUrl = new URL("/update-password", "https://coachhouse.local")
  updatePasswordUrl.searchParams.set("redirect", redirectTo)
  return `${updatePasswordUrl.pathname}${updatePasswordUrl.search}`
}

export function ForgotPasswordForm({ redirectTo }: ForgotPasswordFormProps) {
  const supabase = useSupabaseClient()
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle")
  const [message, setMessage] = useState<string>("")
  const [isPending, startTransition] = useTransition()

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
    },
  })

  async function onSubmit(values: ForgotPasswordValues) {
    setStatus("idle")
    setMessage("")
    startTransition(async () => {
      const emailRedirectTo = resolveAuthCallbackUrl(
        buildForgotPasswordCallbackRedirect(redirectTo),
      )

      const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: emailRedirectTo,
      })

      if (error) {
        setStatus("error")
        setMessage(error.message)
        return
      }

      setStatus("success")
      setMessage("If that email is registered, a reset link is on its way.")
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
                  <Input {...field} type="email" autoComplete="email" placeholder="you@example.com" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {status !== "idle" ? (
            <p
              className={`text-sm ${status === "success" ? "text-emerald-600" : "text-destructive"}`}
              role="status"
            >
              {message}
            </p>
          ) : null}
          <Button className="w-full" type="submit" disabled={isPending}>
            {isPending ? "Sending email..." : "Send reset link"}
          </Button>
        </form>
      </Form>
      <div className="text-center text-sm text-muted-foreground">
        Remembered it? {" "}
        <Link href="/login" className="hover:text-foreground">
          Back to sign in
        </Link>
      </div>
    </div>
  )
}
