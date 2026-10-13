import type { Metadata } from "next"
import { FiscalSponsorshipPublicPage } from "@/features/fiscal-sponsorship"
import { DocumentationSurface } from "@/features/nonprofit-documentation"

export const metadata: Metadata = {
  title: "Fiscal sponsorship · Fund your first project",
  description: "Review fiscal sponsorship requirements and start or resume your Coach House application. No paid plan required.",
  alternates: { canonical: "/documentation/fiscal-sponsorship" },
}

export default function FiscalSponsorshipDocumentationPage() {
  return <DocumentationSurface><FiscalSponsorshipPublicPage /></DocumentationSurface>
}
