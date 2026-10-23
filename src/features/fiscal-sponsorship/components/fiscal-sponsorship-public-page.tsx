import { Button } from "@/components/ui/button"
import { DocumentationPageHeader } from "@/features/nonprofit-documentation"
import { FiscalSponsorshipOverview } from "./fiscal-sponsorship-overview"
import { FiscalSponsorshipPublicIntake } from "./fiscal-sponsorship-public-intake"
import { FiscalLinkedApplications } from "./fiscal-linked-applications"

export function FiscalSponsorshipPublicPage() {
  return (
    <main id="documentation-content" className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <DocumentationPageHeader
        eyebrow="Fiscal sponsorship"
        title="Fund your first project."
        description="A path to raising funds for your charitable project."
        artwork="best-practices/fundraising"
      >
        <Button asChild variant="link" className="h-11 px-2 text-sm">
          <a href="#how-it-works">How it works</a>
        </Button>
        <p className="text-xs leading-5 text-muted-foreground">Applications are reviewed. Sponsorship does not guarantee funding.</p>
      </DocumentationPageHeader>
      {process.env.FISCAL_GUEST_PROFILE_IMPORT_ENABLED === "true" && <FiscalLinkedApplications />}
      <FiscalSponsorshipPublicIntake
        profileImportEnabled={process.env.FISCAL_GUEST_PROFILE_IMPORT_ENABLED === "true"}
        draftPersistenceEnabled={process.env.FISCAL_GUEST_INTAKE_ENABLED === "true"}
        submissionEnabled={process.env.FISCAL_GUEST_INTAKE_ENABLED === "true" && process.env.FISCAL_GUEST_SUBMISSION_UI_ENABLED === "true"}
      />
      <FiscalSponsorshipOverview />
    </main>
  )
}
