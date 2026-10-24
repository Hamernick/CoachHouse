import type { Metadata } from "next"
import { AuthCard } from "@/components/auth/auth-card"
import { AuthScreenShell } from "@/components/auth/auth-screen-shell"
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"

export const metadata: Metadata = {
  title: "Reset Your Password",
  description: "Request a secure link to reset your Coach House password.",
}


type SearchParams = Record<string, string | string[] | undefined>

type ForgotPasswordPageProps = {
  searchParams?: Promise<SearchParams>
}

function getSafeRedirect(value: unknown) {
  if (typeof value !== "string") return undefined
  if (!value.startsWith("/")) return undefined
  if (value.startsWith("//")) return undefined
  return value
}

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const resolved = searchParams ? await searchParams : {}
  const redirect = getSafeRedirect(resolved.redirect)

  return (
    <AuthScreenShell>
      <AuthCard
        title="Reset your password"
        description="Enter your email and we'll send a secure link to choose a new password."
      >
        <ForgotPasswordForm redirectTo={redirect} />
      </AuthCard>
    </AuthScreenShell>
  )
}
