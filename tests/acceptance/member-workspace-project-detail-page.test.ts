import React from "react"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import type { PlatformAdminDashboardLabProject } from "@/features/platform-admin-dashboard"
import { SidebarProvider } from "@/components/ui/sidebar"
import { MemberWorkspaceProjectDetailPage } from "@/features/member-workspace/components/projects/member-workspace-project-detail-page"
import { getProjectDetailsById } from "@/features/platform-admin-dashboard/upstream/lib/data/project-details"
import {
  buildMemberWorkspaceProjectDetailDraft,
  buildMemberWorkspaceProjectUpdateInput,
} from "@/features/member-workspace/components/projects/member-workspace-project-detail-editing"
import { MemberWorkspaceProjectDetailTabs } from "@/features/member-workspace/components/projects/member-workspace-project-detail-tabs"
import { MemberWorkspaceProjectDetailHeader } from "@/features/member-workspace/components/projects/member-workspace-project-detail-header"
import { MemberWorkspaceProjectOverviewDocument } from "@/features/member-workspace/components/projects/member-workspace-project-overview-document"
import { MemberWorkspaceProjectTasksEditor } from "@/features/member-workspace/components/projects/member-workspace-project-tasks-editor"

vi.mock("next/navigation", () => ({
  usePathname: () => "/projects/project-1",
  useRouter: () => ({
    push: () => undefined,
    refresh: () => undefined,
  }),
}))

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}))

const project = getProjectDetailsById("project-1")

function buildProjectSource(
  overrides: Pick<
    PlatformAdminDashboardLabProject,
    "description" | "projectKind"
  >
) {
  return { ...project.source!, ...overrides }
}

function renderProjectDetailPage(
  overrideProps?: Partial<
    React.ComponentProps<typeof MemberWorkspaceProjectDetailPage>
  >,
  activeTab?: string
) {
  const Page = (props: React.ComponentProps<typeof MemberWorkspaceProjectDetailPage>) =>
    activeTab ? React.createElement(MemberWorkspaceProjectDetailTabs, {
      ...props,
      activeTab,
      draft: buildMemberWorkspaceProjectDetailDraft(props.project),
      isEditing: false,
      onActiveTabChange: () => undefined,
      onChangeDraftField: () => undefined,
      onPendingInlineTaskContextHandled: () => undefined,
    }) : React.createElement(MemberWorkspaceProjectDetailPage, props)
  return renderToStaticMarkup(
    React.createElement(
      SidebarProvider,
      { defaultOpen: true },
      React.createElement(Page, {
        project,
        assigneeOptions: [],
        currentUser: {
          id: "user-1",
          name: "Alex Rivera",
          avatarUrl: "https://example.com/alex.png",
        },
        organizationSummary: {
          orgId: "org-1",
          canonicalProjectId: "project-1",
          name: "Coach House",
          ownerName: "Alex Rivera",
          ownerAvatarUrl: "https://example.com/alex.png",
          publicSlug: "coach-house",
          organizationStatus: "approved",
          isPublic: false,
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-02T00:00:00.000Z",
          acceleratorProgress: 64,
          setupProgress: 75,
          setupCompletedCount: 9,
          setupTotalCount: 12,
          missingSetupCount: 2,
          memberCount: 3,
          tags: [],
          members: [],
          setupItems: [],
          profile: {},
        },
        updateProjectAction: async () => ({
          ok: true as const,
          id: project.id,
        }),
        ...overrideProps,
      })
    )
  )
}

describe("MemberWorkspaceProjectDetailPage", () => {
  it("keeps breadcrumbs and editing without the local sidebar toggle", () => {
    const markup = renderProjectDetailPage()
    expect(markup).not.toContain('data-slot="sidebar-trigger"')
    expect(markup).not.toContain('aria-label="Toggle sidebar"')
    expect(markup).toContain('href="/projects"')
    expect(markup).toContain('aria-label="Edit project"')
  })

  it("gives the organization setup rail a wider desktop column", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/features/member-workspace/components/projects/member-workspace-project-detail-page.tsx"
      ),
      "utf8"
    )

    expect(source).toContain("lg:grid-cols-[minmax(0,2fr)_minmax(0,384px)]")
    expect(source).not.toContain("lg:grid-cols-[minmax(0,2fr)_minmax(0,320px)]")
  })

  it("renders the inline header editing surface without relying on a dialog", () => {
    const draft = buildMemberWorkspaceProjectDetailDraft(project)
    const markup = renderToStaticMarkup(
      React.createElement(MemberWorkspaceProjectDetailHeader, {
        project,
        assigneeOptions: [
          {
            id: "user-1",
            name: "Alex Rivera",
            avatarUrl: "https://example.com/alex.png",
            email: "alex@example.com",
          },
          {
            id: "user-2",
            name: "Morgan Lee",
            avatarUrl: null,
            email: "morgan@example.com",
          },
        ],
        canEditProject: true,
        isEditing: true,
        draft,
        onChangeDraftField: () => undefined,
      })
    )

    expect(markup).toContain('data-slot="editable"')
    expect(markup).toContain('id="member-workspace-project-name"')
    expect(markup).toContain('id="member-workspace-project-status"')
    expect(markup).toContain('id="member-workspace-project-priority"')
    expect(markup).toContain('id="member-workspace-project-start-date"')
    expect(markup).toContain('id="member-workspace-project-members"')
    expect(markup).not.toContain("Update the project details inline")
    expect(markup).not.toContain("Edit mode")
    expect(markup).not.toContain("rounded-2xl border p-4 shadow-sm")
    expect(markup).not.toContain('aria-label="Edit project"')
  })

  it("uses a structured assignment menu instead of a comma-separated people input", () => {
    const headerSource =
      readFileSync(
        join(
          process.cwd(),
          "src/features/member-workspace/components/projects/member-workspace-project-detail-header.tsx"
        ),
        "utf8"
      ) +
      readFileSync(
        join(
          process.cwd(),
          "src/features/member-workspace/components/projects/member-workspace-project-detail-header-controls.tsx"
        ),
        "utf8"
      )

    expect(headerSource).toContain("MembersAssignmentMenu")
    expect(headerSource).toContain("DropdownMenuCheckboxItem")
    expect(headerSource).toContain("Assign all")
    expect(headerSource).toContain("Remove all")
    expect(headerSource).toContain("Transfer to")
    expect(headerSource).toContain("HeaderMetaChip")
    expect(headerSource).not.toContain("function InlineEditableChip")
    expect(headerSource).not.toContain(
      'ariaLabel: "Assigned members", value: draft.memberLabels'
    )
  })

  it("keeps overview editing flat without card shells or line-based helper copy", () => {
    const overviewSource = readFileSync(
      join(
        process.cwd(),
        "src/features/member-workspace/components/projects/member-workspace-project-overview-editor.tsx"
      ),
      "utf8"
    )
    const editingSource = readFileSync(
      join(
        process.cwd(),
        "src/features/member-workspace/components/projects/member-workspace-project-detail-editing.ts"
      ),
      "utf8"
    )
    const detailTabsSource = readFileSync(
      join(
        process.cwd(),
        "src/features/member-workspace/components/projects/member-workspace-project-detail-tabs.tsx"
      ),
      "utf8"
    )
    const overviewDocumentSource = readFileSync(
      join(
        process.cwd(),
        "src/features/member-workspace/components/projects/member-workspace-project-overview-document.tsx"
      ),
      "utf8"
    )
    const overviewTypographySource = readFileSync(
      join(
        process.cwd(),
        "src/features/member-workspace/components/projects/member-workspace-project-overview-typography.ts"
      ),
      "utf8"
    )

    expect(overviewSource).not.toContain("EditorPanel")
    expect(overviewSource).not.toContain("bg-card/80")
    expect(overviewSource).not.toContain("rounded-2xl border")
    expect(overviewSource).not.toContain("One item per line")
    expect(overviewSource).not.toContain(
      "text-muted-foreground text-sm leading-6"
    )
    expect(overviewSource).not.toContain("MultilineField")
    expect(overviewSource).not.toContain("<Textarea")
    expect(overviewSource).toContain("RichTextEditor")
    expect(overviewSource).toContain("overviewDocument")
    expect(overviewSource).toContain("toolbarClassName")
    expect(overviewSource).toContain(
      "MEMBER_WORKSPACE_PROJECT_OVERVIEW_EDITOR_CLASS_NAME"
    )
    expect(detailTabsSource).toContain("MemberWorkspaceProjectOverviewDocument")
    expect(detailTabsSource).not.toContain("dangerouslySetInnerHTML")
    expect(overviewDocumentSource).toContain(
      "MEMBER_WORKSPACE_PROJECT_OVERVIEW_DOCUMENT_CLASS_NAME"
    )
    expect(overviewTypographySource).toContain("[&_ul]:!pl-4")
    expect(overviewTypographySource).toContain("[&_p]:whitespace-pre-wrap")
    expect(overviewTypographySource).toContain("[&_li]:whitespace-pre-wrap")
    expect(overviewTypographySource).toContain("ProseMirror")
    expect(overviewTypographySource).toContain("min-h-[32rem]")
    expect(overviewTypographySource).toContain("max-h-[32rem]")
    expect(overviewTypographySource).toContain("overflow-y-auto")
    expect(overviewTypographySource).not.toContain(
      "min-h-[32rem] bg-transparent px-4 py-3"
    )
    expect(overviewDocumentSource).toContain("ReactMarkdown")
    expect(overviewDocumentSource).toContain("remarkGfm")
    expect(overviewDocumentSource).toContain(
      "formatMemberWorkspaceProjectOverviewDocumentMarkdown"
    )
    expect(overviewDocumentSource).toContain(
      "resolveMemberWorkspaceProjectOverviewDocumentSource"
    )
    expect(editingSource).toContain("getProjectSourceStringField")
    expect(editingSource).not.toContain("project.source?.description")
    expect(overviewSource).not.toContain('field="scopeIn"')
    expect(overviewSource).not.toContain('field="keyFeaturesP0"')
    expect(overviewSource).not.toContain("ScopeColumns")
    expect(overviewSource).not.toContain("OutcomesList")
    expect(overviewSource).not.toContain("KeyFeaturesColumns")
    expect(editingSource).not.toContain("renderListSection")
    expect(editingSource).not.toContain("blocks.push(`<ul>")
  })

  it("renders the read-only overview document with editor-grade typography", () => {
    const markup = renderToStaticMarkup(
      React.createElement(MemberWorkspaceProjectOverviewDocument, {
        project: {
          ...project,
          description:
            "<h2>Saved overview</h2><p>This should show in view mode.</p>",
          source: buildProjectSource({ description: "" }),
        },
      })
    )

    expect(markup).toContain(
      'data-slot="member-workspace-project-overview-document"'
    )
    expect(markup).toContain("ProseMirror")
    expect(markup).toContain("max-h-[32rem]")
    expect(markup).toContain("overflow-y-auto")
    expect(markup).not.toContain("min-h-[32rem]")
    expect(markup).toContain("whitespace-pre-wrap")
    expect(markup).toContain("<h2>Saved overview</h2>")
    expect(markup).toContain("<p>This should show in view mode.</p>")
    expect(markup).not.toContain("<script")
  })

  it("prefers the saved source overview document over the derived summary", () => {
    const markup = renderToStaticMarkup(
      React.createElement(MemberWorkspaceProjectOverviewDocument, {
        project: {
          ...project,
          description: "Collapsed summary should not replace the document.",
          source: buildProjectSource({
            description:
              "<h2>Saved source document</h2><p><strong>Formatting</strong> should survive.</p>",
          }),
        },
      })
    )

    expect(markup).toContain("<h2>Saved source document</h2>")
    expect(markup).toContain("<strong>Formatting</strong>")
    expect(markup).not.toContain("Collapsed summary should not replace")
  })

  it("prefers the dedicated overview document over source and summary fields", () => {
    const markup = renderToStaticMarkup(
      React.createElement(MemberWorkspaceProjectOverviewDocument, {
        project: {
          ...project,
          description: "Collapsed summary should not replace the document.",
          overviewDocument:
            "<h2>Dedicated overview document</h2><p>This is the rich saved document.</p>",
          source: buildProjectSource({
            description: "<p>Legacy source document.</p>",
          }),
        },
      })
    )

    expect(markup).toContain("<h2>Dedicated overview document</h2>")
    expect(markup).toContain("This is the rich saved document.")
    expect(markup).not.toContain("Collapsed summary should not replace")
    expect(markup).not.toContain("Legacy source document")
  })

  it("renders markdown overview content inside the read-only overview section", () => {
    const markup = renderToStaticMarkup(
      React.createElement(MemberWorkspaceProjectOverviewDocument, {
        project: {
          ...project,
          description:
            "## Markdown overview\n\nThis should render as **formatted** markdown.\n\n- First item\n- Second item\n\n| Area | Owner |\n| --- | --- |\n| Intake | Coach House |\n\n<script>alert('x')</script>",
          source: buildProjectSource({ description: "" }),
        },
      })
    )

    expect(markup).toContain(
      'data-slot="member-workspace-project-overview-document"'
    )
    expect(markup).toContain("<h2>Markdown overview</h2>")
    expect(markup).toContain("<strong>formatted</strong>")
    expect(markup).toContain("<li>First item</li>")
    expect(markup).toContain("<table>")
    expect(markup).toContain("<td>Coach House</td>")
    expect(markup).not.toContain("<script")
  })

  it("serializes the overview summary and rich document into separate update fields", () => {
    const draft = buildMemberWorkspaceProjectDetailDraft(project)
    const payload = buildMemberWorkspaceProjectUpdateInput({
      project,
      draft: {
        ...draft,
        overviewDocument:
          '<h2>Launch plan</h2><script>alert("no")</script><p onclick="track()">Build one editable overview document.</p><ul><li>Inline editing</li><li>Mobile-first layout</li></ul>',
      },
    })

    expect(payload.description).toBe(
      "Build one editable overview document. Inline editing Mobile-first layout"
    )
    expect(payload.overviewDocumentHtml).toContain("<h2>Launch plan</h2>")
    expect(payload.overviewDocumentHtml).toContain(
      "<p>Build one editable overview document.</p>"
    )
    expect(payload.overviewDocumentHtml).toContain("<li>Inline editing</li>")
    expect(payload.overviewDocumentHtml).not.toContain("<script")
    expect(payload.overviewDocumentHtml).not.toContain("onclick")
    expect(payload.description).not.toContain("<h2>")
    expect(payload.description).not.toContain("Goal:")
    expect(payload.description).not.toContain("P2:")
    expect(payload.tags).toBe(project.source?.tags.join(", "))
  })

  it("renders inline task editing controls that stay usable on mobile", () => {
    const markup = renderToStaticMarkup(
      React.createElement(MemberWorkspaceProjectTasksEditor, {
        project,
        assigneeOptions: [],
      })
    )

    expect(markup).toContain(
      "Task rows edit inline while the page stays in edit mode."
    )
    expect(markup).toContain("Add task")
    expect(markup).toContain("Edit task")
    expect(markup).toContain("Delete")
    expect(markup).toContain("Up")
    expect(markup).toContain("Down")
    expect(markup).not.toContain('role="dialog"')
  })

  it("hides the location chip when the project detail has no real location data", () => {
    const markup = renderToStaticMarkup(
      React.createElement(MemberWorkspaceProjectDetailHeader, {
        project: {
          ...project,
          meta: {
            ...project.meta,
            locationLabel: undefined,
          },
        },
        canEditProject: true,
        isEditing: false,
      })
    )

    expect(markup).not.toContain("Australia")
    expect(markup).not.toContain(">Location<")
  })

  it("renders admin project detail surfaces as read-only", () => {
    const markup = renderProjectDetailPage({
      canManageProject: false,
      updateProjectAction: undefined,
    })

    expect(markup).not.toContain('aria-label="Edit project"')
    expect(markup).not.toContain("Save changes")
    expect(markup).not.toContain("Add notes")
    expect(markup).not.toContain("Add File")
    expect(markup).not.toContain("New Task")
  })

  it("lets admins edit project details without enabling broader project management controls", () => {
    const markup = renderProjectDetailPage({
      canManageProject: false,
      canEditProjectDetails: true,
      updateProjectAction: async () => ({ ok: true, id: project.id }),
    })

    expect(markup).toContain('aria-label="Edit project"')
    expect(markup).not.toContain("Save changes")
    expect(markup).not.toContain("Add notes")
    expect(markup).not.toContain("Add File")
    expect(markup).not.toContain("New Task")
  })

  it("shows a confirmation-backed delete action for standard organization records", () => {
    const detailPageSource = readFileSync(
      join(
        process.cwd(),
        "src/features/member-workspace/components/projects/member-workspace-project-detail-page.tsx"
      ),
      "utf8"
    )
    const markup = renderProjectDetailPage({
      project: {
        ...project,
        source: buildProjectSource({ projectKind: "standard" }),
      },
      canManageProject: false,
      canEditProjectDetails: true,
      deleteProjectAction: async () => ({ ok: true, id: project.id }),
      updateProjectAction: async () => ({ ok: true, id: project.id }),
    })

    expect(markup).toContain("Delete")
    expect(detailPageSource).toContain("getProjectSourceProjectKind")
    expect(detailPageSource).not.toContain("project.source?.projectKind")

    const deleteDialogSource = readFileSync(
      join(
        process.cwd(),
        "src/features/member-workspace/components/projects/member-workspace-project-delete-dialog.tsx"
      ),
      "utf8"
    )

    expect(deleteDialogSource).toContain("Delete {projectName}?")
    expect(deleteDialogSource).toContain("Delete organization")
    expect(deleteDialogSource).toContain("This removes the organization record")
  })

  it("hides the delete action for canonical admin organization records", () => {
    const markup = renderProjectDetailPage({
      project: {
        ...project,
        source: buildProjectSource({ projectKind: "organization_admin" }),
      },
      canManageProject: false,
      canEditProjectDetails: true,
      deleteProjectAction: async () => ({ ok: true, id: project.id }),
      updateProjectAction: async () => ({ ok: true, id: project.id }),
    })

    expect(markup).not.toContain("Delete organization")
    expect(markup).not.toContain(`Delete ${project.name}?`)
  })

  it("renders the fiscal sponsorship workbench only in its dedicated tab", () => {
    expect(renderProjectDetailPage()).not.toContain("data-fiscal-sponsorship-project-workbench")
    const markup = renderProjectDetailPage(undefined, "fiscal-sponsorship")

    expect(markup).toContain("data-fiscal-sponsorship-project-workbench")
    expect(markup).toContain("Fiscal Sponsorship")
    expect(markup).toContain("Fiscal sponsorship workbench")
    expect(markup).toContain("Fiscal sponsorship progress")
    expect(markup).toContain('data-slot="radio-group"')
    expect(markup).toContain('data-state="checked"')
    expect(markup).toContain(
      'data-fiscal-sponsorship-phase-status="incomplete"'
    )
    expect(markup).toContain("Required data")
    expect(markup).toContain("Applicant: Alex Rivera")
    expect(markup).toContain("No application")
    expect(markup).toContain("Next: Complete and submit the application")
    expect(markup).toContain("Legal entity and tax status")
    expect(markup).toContain("Signature packet")
    expect(markup).toContain("Grant request support")
    expect(markup).toContain("rounded-[2rem]")
    expect(markup).toContain("rounded-[1.45rem]")
    expect(markup).toContain("max-w-none")
    expect(markup).not.toContain("Application approved")
    expect(markup).not.toContain("Agreement generated")
  })

  it("renders real fiscal sponsorship workflow status when available", () => {
    const props: Partial<React.ComponentProps<typeof MemberWorkspaceProjectDetailPage>> = {
      fiscalSponsorshipWorkflowSummary: {
        applicationId: "app-1",
        applicationStatus: "agreement_ready",
        legalEntityType: "informal_group_with_ein",
        reviewNotes: null,
        reviewedAt: "2026-06-10T18:00:00.000Z",
        submittedAt: "2026-06-10T17:00:00.000Z",
        events: [
          {
            actorId: "coach-1",
            applicationId: "app-1",
            createdAt: "2026-06-10T18:05:00.000Z",
            eventType: "agreement_generated",
            id: "event-1",
            metadata: { documentId: "doc-1" },
            summary: "Fiscal sponsorship agreement generated.",
          },
        ],
        latestAgreementDocument: {
          assetId: "asset-1",
          documentKey: null,
          downloadHref:
            "/api/account/project-assets?assetId=asset-1&projectId=project-1&download=1",
          generatedAt: "2026-06-10T18:05:00.000Z",
          id: "doc-1",
          kind: "agreement",
          reviewNotes: null,
          reviewedAt: null,
          reviewStatus: "pending",
          status: "generated",
          storagePath: "org/project/fiscal/doc.html",
          title: "Model C agreement",
          uploadedAt: null,
          version: 1,
          viewHref:
            "/api/account/project-assets?assetId=asset-1&projectId=project-1",
        },
        latestAuditCertificateDocument: null,
        latestExecutedAgreementDocument: null,
        latestSignaturePacket: null,
        requiredDocuments: [],
      },
    }
    const markup = renderProjectDetailPage(props, "fiscal-sponsorship")
    const pageMarkup = renderProjectDetailPage(props)

    expect(markup).toContain("Agreement ready")
    expect(markup).toContain("Prepared")
    expect(markup).toContain("Signatures")
    expect(markup).toContain("Not sent")
    expect(markup).toContain("Next: Send prepared agreement for signatures")
    expect(markup).toContain("Model C agreement v1 is prepared")
    expect(pageMarkup).toContain("Recent updates")
    expect(pageMarkup).toContain("Fiscal sponsorship agreement prepared.")
    expect(pageMarkup).toContain("Agreement prepared")
    expect(pageMarkup).toContain(
      'href="/api/account/project-assets?assetId=asset-1&amp;projectId=project-1"'
    )
  }, 15_000)

  it("renders coach fiscal sponsorship workflow actions when provided", () => {
    const markup = renderProjectDetailPage({
      fiscalSponsorshipWorkflowSummary: {
        applicationId: "app-1",
        applicationStatus: "agreement_ready",
        legalEntityType: "informal_group_with_ein",
        reviewNotes: null,
        reviewedAt: "2026-06-10T18:00:00.000Z",
        submittedAt: "2026-06-10T17:00:00.000Z",
        events: [],
        latestAgreementDocument: {
          assetId: "asset-1",
          documentKey: null,
          downloadHref:
            "/api/account/project-assets?assetId=asset-1&projectId=project-1&download=1",
          generatedAt: "2026-06-10T18:05:00.000Z",
          id: "doc-1",
          kind: "agreement",
          reviewNotes: null,
          reviewedAt: null,
          reviewStatus: "pending",
          status: "generated",
          storagePath: "org/project/fiscal/doc.html",
          title: "Model C agreement",
          uploadedAt: null,
          version: 1,
          viewHref:
            "/api/account/project-assets?assetId=asset-1&projectId=project-1",
        },
        latestAuditCertificateDocument: null,
        latestExecutedAgreementDocument: null,
        latestSignaturePacket: null,
        requiredDocuments: [],
      },
      generateFiscalSponsorshipAgreementAction: async () => ({
        ok: true,
        applicationId: "app-1",
        assetId: "asset-1",
        documentId: "doc-1",
      }),
      reviewFiscalSponsorshipApplicationAction: async () => ({
        ok: true,
        applicationId: "app-1",
      }),
      sendFiscalSponsorshipAgreementForSignatureAction: async () => ({
        ok: true,
        applicationId: "app-1",
        packetId: "packet-1",
        providerSubmissionId: "submission-1",
      }),
    }, "fiscal-sponsorship")

    expect(markup).toContain(
      "data-fiscal-sponsorship-project-workbench-admin-actions"
    )
    expect(markup).not.toContain("Approve application")
    expect(markup).not.toContain("Prepare agreement")
    expect(markup).toContain("Send for signature")
  })

  it("keeps /organizations fiscal document actions platform-admin only", () => {
    const fiscalWorkbenchSource = readFileSync(
      join(
        process.cwd(),
        "src/features/member-workspace/components/projects/member-workspace-project-fiscal-workbench.tsx"
      ),
      "utf8"
    )
    const detailPageSource = readFileSync(
      join(
        process.cwd(),
        "src/features/member-workspace/components/projects/member-workspace-project-detail-page.tsx"
      ),
      "utf8"
    )
    const detailTabsSource = readFileSync(
      join(
        process.cwd(),
        "src/features/member-workspace/components/projects/member-workspace-project-detail-tabs.tsx"
      ),
      "utf8"
    )
    const organizationDetailRouteSource = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/organizations/[id]/page.tsx"),
      "utf8"
    )
    const organizationsPageSource = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/organizations/page.tsx"),
      "utf8"
    )

    expect(fiscalWorkbenchSource).toContain("project.files.map((file)")
    expect(fiscalWorkbenchSource).toContain("id: file.id")
    expect(fiscalWorkbenchSource).toContain("name: file.name")
    expect(fiscalWorkbenchSource).toContain("description: file.description")
    expect(fiscalWorkbenchSource).toContain("url: file.url")
    expect(fiscalWorkbenchSource).toContain("projectAssets={projectAssets}")
    expect(detailPageSource).toContain(
      "canConnectFiscalDocuments={canEditProjectDetails}"
    )
    expect(detailTabsSource).toContain(
      "canConnectDocuments={canConnectFiscalDocuments}"
    )
    expect(detailTabsSource).toContain(
      "connectFiscalSponsorshipDocumentAssetAction={"
    )
    expect(fiscalWorkbenchSource).toContain(
      "connectFiscalSponsorshipDocumentAssetAction={"
    )

    expect(organizationsPageSource).toContain('from "@/lib/admin/auth"')
    expect(organizationsPageSource).toContain(
      'await requirePlatformCapability("organizations"'
    )
    expect(organizationsPageSource).not.toContain(
      "requireMemberWorkspacePageAccess"
    )
    expect(organizationDetailRouteSource).toContain('from "@/lib/admin/auth"')
    expect(organizationDetailRouteSource).toContain(
      'const staff = await requirePlatformCapability("organizations"'
    )
    expect(organizationDetailRouteSource).toContain(
      "loadPlatformAdminOrganizationProjectDetailPage({"
    )
    expect(organizationDetailRouteSource).toContain("userId: staff.userId")
    expect(organizationDetailRouteSource).not.toContain(
      "loadMemberWorkspaceProjectDetailPage(id)"
    )
    expect(organizationDetailRouteSource).not.toContain(
      "requireMemberWorkspacePageAccess"
    )
    expect(organizationDetailRouteSource).toContain(
      'const canManageProjectTasks =\n    result.scope === "organization" || result.scope === "platform-admin"'
    )
    expect(organizationDetailRouteSource).toContain(
      "canManageProjectTasks ? deleteMemberWorkspaceTaskAction : undefined"
    )
    expect(organizationDetailRouteSource).toContain(
      "connectFiscalSponsorshipDocumentAsset"
    )
    expect(organizationDetailRouteSource).toContain(
      "connectFiscalSponsorshipDocumentAssetAction={"
    )
    expect(organizationDetailRouteSource).toContain(
      "canEditProjectDetails\n          ? connectFiscalSponsorshipDocumentAsset\n          : undefined"
    )
    expect(organizationDetailRouteSource).toContain(
      "reviewFiscalSponsorshipDocumentAction={"
    )
    expect(organizationDetailRouteSource).toContain(
      "canManageFiscalSponsorship ? reviewFiscalSponsorshipDocument : undefined"
    )
    expect(
      organizationDetailRouteSource.indexOf("canEditProjectDetails")
    ).toBeLessThan(
      organizationDetailRouteSource.indexOf(
        "canManageFiscalSponsorship ? reviewFiscalSponsorshipDocument"
      )
    )
  })
})

describe("organization coach header metadata", () => {
  it("renders assigned photos, initials and a capped avatar group", () => {
    const markup = renderToStaticMarkup(
      React.createElement(MemberWorkspaceProjectDetailHeader, {
        project,
        assignedCoaches: [
          { id: "1", name: "Alex Rivera", imageUrl: "https://example.com/alex.png" },
          { id: "2", name: "Sam Lee", imageUrl: null },
          { id: "3", name: "Pat Jones", imageUrl: null },
          { id: "4", name: "Robin Smith", imageUrl: null },
        ],
      })
    )
    expect(markup).toContain('aria-label="Assigned coaches"')
    expect(markup).toContain('alt="Alex Rivera"')
    expect(markup).toContain(">SL<")
    expect(markup).toContain(">+1<")
    expect(markup).toContain('title="Robin Smith"')
    expect(markup).not.toContain("Frank.PNG")
  })
  it.each([
    [["Alex Rivera", "Sam Lee"], "Alex Rivera, Sam Lee"],
    [[], "Unassigned"],
    [null, "Unavailable"],
  ] as const)("shows the actual assignment state", (names, expected) => {
    const markup = renderToStaticMarkup(
      React.createElement(MemberWorkspaceProjectDetailHeader, {
        project,
        assignedCoachNames: names ? [...names] : null,
      })
    )
    expect(markup).toContain("Coach:")
    expect(markup).toContain(expected)
  })
})
