import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

import { PDFDocument } from "pdf-lib"
import { describe, expect, it } from "vitest"

import {
  FISCAL_SPONSORSHIP_W9_TEMPLATE,
  getFiscalSponsorshipW9CertificationText,
  redactFiscalSponsorshipW9Fields,
  validateFiscalSponsorshipW9Fields,
  type FiscalSponsorshipW9Fields,
} from "@/features/fiscal-sponsorship/lib/w9-field-manifest"
import { buildFiscalSponsorshipW9Pdf } from "@/features/fiscal-sponsorship/lib/w9-pdf"
import { buildFiscalSponsorshipProjectWorkbenchData } from "@/features/fiscal-sponsorship/lib/project-workbench-data"
import { resolveDocumentKindForKey } from "@/features/fiscal-sponsorship/server/workflow-document-actions-support"
import type { FiscalSponsorshipProjectWorkflowSummaryDocument } from "@/features/fiscal-sponsorship/types"

const fields: FiscalSponsorshipW9Fields = {
  accountNumber: "CH-AB12CD34",
  address: "123 North State Street",
  businessName: "",
  city: "Chicago",
  exemptPayeeCode: "",
  fatcaExemptionCode: "",
  foreignPartnersOwnersBeneficiaries: false,
  llcClassification: "",
  name: "Sample Community Arts Initiative",
  otherClassification: "",
  postalCode: "60601",
  state: "IL",
  subjectToBackupWithholding: false,
  taxClassification: "individual",
  tin: "123-45-6789",
  tinType: "ssn",
}

function buildW9Document({
  kind,
  status,
}: {
  kind: FiscalSponsorshipProjectWorkflowSummaryDocument["kind"]
  status: FiscalSponsorshipProjectWorkflowSummaryDocument["status"]
}): FiscalSponsorshipProjectWorkflowSummaryDocument {
  return {
    assetId: "asset-w9",
    documentKey: "tax_id_confirmation",
    downloadHref: "/api/fiscal-sponsorship/documents/doc-w9?download=1",
    generatedAt: "2026-07-28T22:00:00.000Z",
    id: "doc-w9",
    kind,
    reviewNotes: null,
    reviewedAt: "2026-07-28T22:05:00.000Z",
    reviewStatus: "accepted",
    status,
    storagePath: "org/project/w9.pdf",
    title: "Signed IRS Form W-9",
    uploadedAt: "2026-07-28T22:00:00.000Z",
    version: 1,
    viewHref: "/api/fiscal-sponsorship/documents/doc-w9",
  }
}

describe("fiscal sponsorship W-9 completion", () => {
  it("pins the current official template and validates taxpayer fields", () => {
    const templateBytes = readFileSync("public/fiscal-sponsorship/form-w-9.pdf")
    const templateSha256 = createHash("sha256")
      .update(templateBytes)
      .digest("hex")

    expect(FISCAL_SPONSORSHIP_W9_TEMPLATE.revision).toBe("March 2024")
    expect(templateSha256).toBe(FISCAL_SPONSORSHIP_W9_TEMPLATE.sha256)
    expect(validateFiscalSponsorshipW9Fields(fields)).toEqual({})
    expect(getFiscalSponsorshipW9CertificationText(false)).toContain(
      "Under penalties of perjury"
    )
    expect(getFiscalSponsorshipW9CertificationText(false)).toContain(
      "I am not subject to backup withholding"
    )
    expect(
      validateFiscalSponsorshipW9Fields({ ...fields, tin: "1234" })
    ).toMatchObject({ tin: "Enter a nine-digit SSN, ITIN, or EIN." })
  })

  it("generates a flattened signed PDF without retaining raw TIN metadata", async () => {
    const result = await buildFiscalSponsorshipW9Pdf({
      fields,
      signature: {
        method: "typed",
        signedAt: "2026-07-27T14:05:00.000Z",
        signerName: "Caleb Hamernick",
        value: "Caleb Hamernick",
      },
    })
    const document = await PDFDocument.load(result.bytes)
    const redacted = redactFiscalSponsorshipW9Fields(fields)

    expect(result.bytes.length).toBeGreaterThan(100_000)
    expect(result.sha256).toHaveLength(64)
    expect(document.getPageCount()).toBe(6)
    expect(document.getForm().getFields()).toHaveLength(0)
    expect(redacted).not.toHaveProperty("tin")
    expect(redacted.tinLast4).toBe("6789")
  })

  it("enforces assigned-signer access, private storage, review, and immutability", () => {
    const actions = readFileSync(
      "src/features/fiscal-sponsorship/server/w9-actions.ts",
      "utf8"
    )
    const sessionSupport = readFileSync(
      "src/features/fiscal-sponsorship/server/w9-session-support.ts",
      "utf8"
    )
    const agreementActions = readFileSync(
      "src/features/fiscal-sponsorship/server/workflow-agreement-actions.ts",
      "utf8"
    )
    const migration = readFileSync(
      "supabase/migrations/20260727130000_complete_fiscal_sponsorship_signing.sql",
      "utf8"
    )

    expect(sessionSupport).toContain("resolveFiscalApplicantSigner")
    expect(sessionSupport).toContain(
      "context.user.id !== signerResult.signer.id"
    )
    expect(actions).toContain("redactFiscalSponsorshipW9Fields(fields)")
    expect(actions).toContain("certificationSha256")
    expect(actions).toContain("FISCAL_SPONSORSHIP_SIGNING_BUCKET")
    expect(actions).not.toContain("field_values: fields")
    expect(agreementActions).toContain(
      "Accept the applicant’s completed W-9 before preparing an agreement."
    )
    expect(agreementActions).toContain(
      "The accepted file is not a completed W-9."
    )
    expect(migration).toContain("reject_executed_fiscal_tax_form_mutation")
    expect(migration).toContain("Executed fiscal tax forms are immutable")
    expect(migration).toContain("om.role in ('owner', 'admin', 'staff')")
  })

  it("uses coach acceptance to classify an uploaded PDF as a completed W-9", () => {
    const workflowActions = readFileSync(
      "src/features/fiscal-sponsorship/server/workflow-actions.ts",
      "utf8"
    )
    const documentTransitions = readFileSync(
      "supabase/migrations/20260805231500_atomic_fiscal_document_transitions.sql",
      "utf8"
    )
    const source = {
      organization: { name: "Coach House test", ownerName: "Alex Rivera" },
      project: { id: "project-1", name: "Community program" },
      workflowSummary: {
        applicationId: "app-1",
        applicationStatus: "approved" as const,
        events: [],
        latestAgreementDocument: null,
        latestAuditCertificateDocument: null,
        latestExecutedAgreementDocument: null,
        latestSignaturePacket: null,
        legalEntityType: "individual" as const,
        requiredDocuments: [
          buildW9Document({ kind: "application", status: "draft" }),
        ],
        reviewNotes: null,
        reviewedAt: "2026-07-28T22:05:00.000Z",
        submittedAt: "2026-07-28T21:00:00.000Z",
      },
    }

    expect(resolveDocumentKindForKey("tax_id_confirmation")).toBe("application")
    const pendingWorkbench = buildFiscalSponsorshipProjectWorkbenchData(source)

    expect(pendingWorkbench).toMatchObject({
      canGenerateAgreement: false,
      nextStep: "Complete and accept the signed W-9",
    })
    expect(
      buildFiscalSponsorshipProjectWorkbenchData({
        ...source,
        workflowSummary: {
          ...source.workflowSummary,
          requiredDocuments: [
            buildW9Document({ kind: "tax_form", status: "executed" }),
          ],
        },
      })
    ).toMatchObject({
      canGenerateAgreement: true,
      nextStep: "Prepare the sponsorship agreement",
    })
    expect(documentTransitions).toContain("then 'tax_form'")
    expect(documentTransitions).toContain("then 'executed'")
    expect(documentTransitions).toContain(
      "version = coalesce(v_tax_form_version, v_document.version)"
    )
    expect(workflowActions).not.toContain(
      "isFiscalSponsorshipAgreementFileName"
    )
  })

  it("offers the assigned applicant direct W-9 completion in the workbench", () => {
    const summary = readFileSync(
      "src/features/fiscal-sponsorship/server/workflow-summary.ts",
      "utf8"
    )
    const workbench = readFileSync(
      "src/features/fiscal-sponsorship/components/fiscal-sponsorship-project-workbench-required-documents.tsx",
      "utf8"
    )
    const userUploadPanel = readFileSync(
      "src/features/fiscal-sponsorship/components/fiscal-sponsorship-required-documents-upload-panel.tsx",
      "utf8"
    )
    const workflowDrawer = readFileSync(
      "src/features/fiscal-sponsorship/components/fiscal-sponsorship-workflow-drawer.tsx",
      "utf8"
    )

    expect(summary).toContain("canCompleteW9")
    expect(summary).toContain("application.primary_email")
    expect(workbench).toContain("Complete W-9")
    expect(workbench).toContain("New W-9")
    expect(workbench).toContain("Replace PDF")
    expect(workbench).toContain("/fiscal-sponsorship/w9/${projectId}")
    expect(userUploadPanel).toContain("Complete W-9")
    expect(userUploadPanel).toContain("Complete new W-9")
    expect(userUploadPanel).toContain("/fiscal-sponsorship/w9/${projectId}")
    expect(userUploadPanel).not.toContain(
      "isFiscalSponsorshipAgreementFileName"
    )
    expect(workflowDrawer).toContain(
      "canCompleteW9={data.workflowSummary?.canCompleteW9 ?? false}"
    )
  })

  it("restores human-reviewed test documents without deleting evidence", () => {
    const migration = readFileSync(
      "supabase/migrations/20260730223800_restore_human_reviewed_fiscal_documents.sql",
      "utf8"
    )

    expect(migration).toContain("review_status = 'accepted'")
    expect(migration).toContain("document_key = 'tax_id_confirmation'")
    expect(migration).toContain("kind = 'tax_form'")
    expect(migration).toContain("status = 'executed'")
    expect(migration).toContain("review_notes = null")
    expect(migration).not.toContain("delete from")
  })
})
