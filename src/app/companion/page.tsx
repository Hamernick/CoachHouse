import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { CompanionBrowser } from "@/features/coach-house-companion"

export const metadata: Metadata = { title: "Companion Pilot", robots: { index: false, follow: false } }
export const dynamic = "force-dynamic"

export default function CompanionPage() {
  if (process.env.COMPANION_SANDBOX_ENABLED !== "1") notFound()
  return <CompanionBrowser />
}
