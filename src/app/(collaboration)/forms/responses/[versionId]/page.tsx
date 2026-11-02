import type { Metadata } from "next"
import { OrganizationFormResponses } from "@/features/organization-forms/client"
import { requireFormResponseSession } from "@/features/organization-forms/server"

export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: "Form responses", robots: { index: false, follow: false }, referrer: "no-referrer",
}

export default async function FormResponsesPage({ params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params
  await requireFormResponseSession(versionId)
  return <main className="mx-auto min-h-dvh w-full max-w-2xl px-3 py-6 sm:px-6">
    <OrganizationFormResponses key={versionId} versionId={versionId} standalone />
  </main>
}
