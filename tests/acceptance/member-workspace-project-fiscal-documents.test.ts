import React from "react"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import {
  getMemberWorkspaceProjectFiscalDocumentAssetIds,
  MemberWorkspaceProjectFiscalDocuments,
} from "@/features/member-workspace/components/projects/member-workspace-project-fiscal-documents"
import type { FiscalSponsorshipProjectWorkflowSummary } from "@/features/fiscal-sponsorship"

function buildWorkflowSummary(
  override?: Partial<FiscalSponsorshipProjectWorkflowSummary>
): FiscalSponsorshipProjectWorkflowSummary {
  return {
    applicationId: "application-1",
    applicationStatus: "countersigned",
    events: [],
    latestAgreementDocument: null,
    latestAuditCertificateDocument: null,
    latestExecutedAgreementDocument: null,
    latestSignaturePacket: null,
    legalEntityType: "corporation",
    requiredDocuments: [],
    reviewNotes: null,
    reviewedAt: null,
    submittedAt: null,
    ...override,
  }
}

describe("MemberWorkspaceProjectFiscalDocuments", () => {
  it("keeps both download paths behind server-side authorization", () => {
    const projectAssetRouteSource = readFileSync(
      join(process.cwd(), "src/app/api/account/project-assets/route.ts"),
      "utf8"
    )
    const fiscalDocumentRouteSource = readFileSync(
      join(
        process.cwd(),
        "src/app/api/fiscal-sponsorship/documents/[documentId]/route.ts"
      ),
      "utf8"
    )

    expect(projectAssetRouteSource).toContain("canAccessProjectOrg({")
    expect(projectAssetRouteSource).toContain("createSignedUrl(")
    expect(fiscalDocumentRouteSource).toContain("supabase.auth.getUser()")
    expect(fiscalDocumentRouteSource).toContain(
      '.from("fiscal_sponsorship_documents")'
    )
    expect(fiscalDocumentRouteSource).toContain(
      "actualSha256 !== document.file_sha256"
    )
    expect(fiscalDocumentRouteSource).toContain(
      "canManageFiscalSponsorshipForOrganization"
    )
    expect(fiscalDocumentRouteSource).toContain(
      '"Cache-Control": "private, no-store, max-age=0"'
    )
  })

  it("keeps executed fiscal records out of generic asset edit and delete controls", () => {
    const detailTabsSource = readFileSync(
      join(
        process.cwd(),
        "src/features/member-workspace/components/projects/member-workspace-project-detail-tabs.tsx"
      ),
      "utf8"
    )

    expect(detailTabsSource).toContain(
      "getMemberWorkspaceProjectFiscalDocumentAssetIds("
    )
    expect(detailTabsSource).toContain("!fiscalDocumentAssetIds.has(file.id)")
    expect(detailTabsSource).toContain("generalProjectFiles.map")
    expect(detailTabsSource).toContain("<MemberWorkspaceProjectFiscalDocuments")
  })

  it("shows legacy DocuSeal files through authorized project asset routes", () => {
    const workflowSummary = buildWorkflowSummary({
      latestExecutedAgreementDocument: {
        assetId: "asset-docuseal",
        documentKey: null,
        downloadHref:
          "/api/account/project-assets?assetId=asset-docuseal&projectId=project-1&download=1",
        generatedAt: "2026-07-16T15:00:00.000Z",
        id: "document-docuseal",
        kind: "executed_agreement",
        reviewNotes: null,
        reviewedAt: null,
        reviewStatus: "accepted",
        status: "executed",
        storagePath: "org-1/project-1/private-docuseal-file.pdf",
        title: "Executed fiscal sponsorship agreement",
        uploadedAt: null,
        version: 1,
        viewHref:
          "/api/account/project-assets?assetId=asset-docuseal&projectId=project-1",
      },
    })
    const markup = renderToStaticMarkup(
      React.createElement(MemberWorkspaceProjectFiscalDocuments, {
        workflowSummary,
      })
    )

    expect(markup).toContain("Signed fiscal sponsorship documents")
    expect(markup).toContain("Executed fiscal sponsorship agreement")
    expect(markup).toContain(
      "/api/account/project-assets?assetId=asset-docuseal&amp;projectId=project-1"
    )
    expect(markup).not.toContain("private-docuseal-file.pdf")
    expect(
      getMemberWorkspaceProjectFiscalDocumentAssetIds(workflowSummary)
    ).toEqual(new Set(["asset-docuseal"]))
  })

  it("shows native executed and audit PDFs through hash-verifying routes", () => {
    const workflowSummary = buildWorkflowSummary({
      latestAuditCertificateDocument: {
        assetId: null,
        documentKey: null,
        downloadHref:
          "/api/fiscal-sponsorship/documents/document-audit?download=1",
        generatedAt: "2026-07-16T16:00:00.000Z",
        id: "document-audit",
        kind: "audit_certificate",
        reviewNotes: null,
        reviewedAt: null,
        reviewStatus: "accepted",
        status: "executed",
        storagePath: "org-1/project-1/private-native-audit.pdf",
        title: "Form B Execution Certificate",
        uploadedAt: null,
        version: 1,
        viewHref: "/api/fiscal-sponsorship/documents/document-audit",
      },
      latestExecutedAgreementDocument: {
        assetId: null,
        documentKey: null,
        downloadHref:
          "/api/fiscal-sponsorship/documents/document-executed?download=1",
        generatedAt: "2026-07-16T16:00:00.000Z",
        id: "document-executed",
        kind: "executed_agreement",
        reviewNotes: null,
        reviewedAt: null,
        reviewStatus: "accepted",
        status: "executed",
        storagePath: "org-1/project-1/private-native-executed.pdf",
        title: "Executed Form B Fiscal Sponsorship Agreement",
        uploadedAt: null,
        version: 2,
        viewHref: "/api/fiscal-sponsorship/documents/document-executed",
      },
    })
    const markup = renderToStaticMarkup(
      React.createElement(MemberWorkspaceProjectFiscalDocuments, {
        workflowSummary,
      })
    )

    expect(markup).toContain("Executed Form B Fiscal Sponsorship Agreement")
    expect(markup).toContain("Form B Execution Certificate")
    expect(markup).toContain(
      "/api/fiscal-sponsorship/documents/document-executed?download=1"
    )
    expect(markup).toContain(
      "/api/fiscal-sponsorship/documents/document-audit?download=1"
    )
    expect(markup).not.toContain("private-native-executed.pdf")
    expect(markup).not.toContain("private-native-audit.pdf")
  })

  it("does not expose unfinished or inaccessible fiscal records", () => {
    const workflowSummary = buildWorkflowSummary({
      latestExecutedAgreementDocument: {
        assetId: null,
        documentKey: null,
        downloadHref: null,
        generatedAt: "2026-07-16T16:00:00.000Z",
        id: "document-draft",
        kind: "executed_agreement",
        reviewNotes: null,
        reviewedAt: null,
        reviewStatus: "pending",
        status: "generated",
        storagePath: "org-1/project-1/private-draft.pdf",
        title: "Draft agreement",
        uploadedAt: null,
        version: 1,
        viewHref: null,
      },
    })
    const markup = renderToStaticMarkup(
      React.createElement(MemberWorkspaceProjectFiscalDocuments, {
        workflowSummary,
      })
    )

    expect(markup).toBe("")
  })
})
