import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { z } from "zod"
import { FiscalGuestApplication } from "@/features/fiscal-sponsorship"
export const metadata: Metadata = {
  description: "Continue your fiscal sponsorship application.", title: "Your application", robots: { index: false, follow: false }, referrer: "no-referrer" }
export default async function FiscalApplicationPage({ searchParams }: { searchParams: Promise<{ application?: string }> }) {
  const reference = z.string().uuid().safeParse((await searchParams).application)
  if (!reference.success) notFound()
  return <FiscalGuestApplication profileImportEnabled={process.env.FISCAL_GUEST_PROFILE_IMPORT_ENABLED === "true"} reference={reference.data} />
}
