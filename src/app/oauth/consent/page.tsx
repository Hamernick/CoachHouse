import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { CompanionConsent } from "@/features/coach-house-companion"
import { loadCompanionConsent } from "@/features/coach-house-companion/server"

export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: "Connect to Coach House",
  description: "Review and approve your Coach House Accelerator connection.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}

export default async function CompanionConsentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const state = await loadCompanionConsent((await searchParams).authorization_id)
  if (state.status === "login" || state.status === "redirect") redirect(state.href)
  return <CompanionConsent state={state} />
}
