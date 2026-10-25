import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  FiscalSponsorshipW9Page,
  loadFiscalSponsorshipW9Session,
} from "@/features/fiscal-sponsorship"
import { resolveOptionalAuthenticatedAppContext } from "@/lib/auth/request-context"

export const metadata: Metadata = {
  title: "Fiscal Sponsorship Tax Form",
  description: "Complete the tax information for your fiscally sponsored project.",
}


export const dynamic = "force-dynamic"

export default async function FiscalSponsorshipW9Route({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const requestContext = await resolveOptionalAuthenticatedAppContext()
  if (!requestContext) {
    const returnPath = `/fiscal-sponsorship/w9/${encodeURIComponent(projectId)}`
    redirect(`/login?redirect=${encodeURIComponent(returnPath)}`)
  }

  const result = await loadFiscalSponsorshipW9Session(projectId)
  if ("error" in result) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-10 lg:px-6">
        <Alert variant="destructive">
          <AlertTitle>W-9 unavailable</AlertTitle>
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      </main>
    )
  }

  return <FiscalSponsorshipW9Page initialSession={result.session} />
}
