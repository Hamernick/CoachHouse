import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { CompanionBrowser } from "@/features/coach-house-companion"

export const metadata: Metadata = {
  title: "Companion Pilot",
  description: "Private Coach House Companion pilot for accelerator progress and document review.",
  robots: { index: false, follow: false },
}
export const dynamic = "force-dynamic"

export default function CompanionPage() {
  if (process.env.COMPANION_SANDBOX_ENABLED !== "1") notFound()
  return <CompanionBrowser />
}
