import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { z } from "zod"
import { FiscalOptionalProfile } from "@/features/fiscal-sponsorship"
export const metadata: Metadata = { title: "Keep your details", robots: { index: false, follow: false }, referrer: "no-referrer" }
export default async function FiscalProfilePage({ searchParams }: { searchParams: Promise<{ application?: string }> }) {
  if (process.env.FISCAL_GUEST_PROFILE_IMPORT_ENABLED !== "true") notFound()
  const reference = z.string().uuid().safeParse((await searchParams).application)
  if (!reference.success) notFound()
  return <FiscalOptionalProfile reference={reference.data} />
}
