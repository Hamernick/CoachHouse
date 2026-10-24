import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  FiscalSponsorshipSigningPage,
  loadFiscalSponsorshipSigningSession,
} from "@/features/fiscal-sponsorship"
import { resolveOptionalAuthenticatedAppContext } from "@/lib/auth/request-context"

export const metadata: Metadata = {
  title: "Fiscal Sponsorship Agreement",
  description: "Review and sign your fiscal sponsorship agreement.",
}


export const dynamic = "force-dynamic"

export default async function FiscalSponsorshipSignPage({
  params,
}: {
  params: Promise<{ packetId: string }>
}) {
  const { packetId } = await params
  const requestContext = await resolveOptionalAuthenticatedAppContext()
  if (!requestContext) {
    const returnPath = `/fiscal-sponsorship/sign/${encodeURIComponent(packetId)}`
    redirect(`/login?redirect=${encodeURIComponent(returnPath)}`)
  }

  const result = await loadFiscalSponsorshipSigningSession(packetId)
  if ("error" in result) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-10 lg:px-6">
        <Alert variant="destructive">
          <AlertTitle>Signing Session Unavailable</AlertTitle>
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      </main>
    )
  }

  return <FiscalSponsorshipSigningPage initialSession={result.session} />
}
