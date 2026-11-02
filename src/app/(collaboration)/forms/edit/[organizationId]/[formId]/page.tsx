import type { Metadata } from "next"
import { OrganizationFormSourceEntry } from "@/features/organization-forms/client"
import { requireFormSourceSession } from "@/features/organization-forms/server"

export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: "Edit form", robots: { index: false, follow: false }, referrer: "no-referrer",
}

export default async function FormSourcePage({ params }: { params: Promise<{ organizationId: string; formId: string }> }) {
  const { organizationId, formId } = await params
  await requireFormSourceSession(organizationId, formId)
  return <main className="mx-auto min-h-dvh w-full max-w-2xl px-3 py-6 sm:px-6">
    <OrganizationFormSourceEntry key={`${organizationId}:${formId}`} organizationId={organizationId} formId={formId} />
  </main>
}
