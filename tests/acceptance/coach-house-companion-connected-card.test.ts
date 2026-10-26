import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { ConnectedCompanionPanel, connectedProposalIsCurrent, connectedProposalMatches, connectedSaveArguments, connectedSaveConfirmed } from "@/features/coach-house-companion/components/connected-companion-panel"
import type { LiveCompanionProposal, LiveCompanionSnapshot } from "@/features/coach-house-companion/types"

const initial: LiveCompanionSnapshot = {
  mode: "connected", organization: { id: "organization-one", name: "Practice Organization" },
  lesson: { id: "lesson-one", title: "Mission", description: "Define your mission", href: "https://staging.coachhouse.app/class/foundations/module/1", fields: [{ name: "mission", label: "Your mission", type: "short_text", required: false }], completionMode: "all_answered", completeOnSubmit: true, body: "Lesson body", videoUrl: null, resources: [] },
  source: { kind: "published", label: "Published lesson", verifiedAt: "2026-10-26T00:00:00Z" },
  draft: { answers: {}, revision: 0, updatedAt: null, visibility: "personal" },
  document: { id: "mission", title: "Mission statement", content: "Existing mission", revision: "f".repeat(64), visibility: "organization", href: "https://staging.coachhouse.app/organization?section=mission" },
  submission: { status: "not_submitted", completed: false, submittedAt: null, answers: {} },
  calendar: { capability: "export", event: null }, receipts: [], coachingHref: "https://staging.coachhouse.app/coaching",
}
const proposal: LiveCompanionProposal = {
  organizationId: initial.organization.id, lessonId: initial.lesson.id, documentId: initial.document.id,
  content: "Help families learn together.", expectedRevision: initial.document.revision, visibility: "organization",
}
const saved = (): LiveCompanionSnapshot => ({ ...initial, document: { ...initial.document, revision: "a".repeat(64), content: proposal.content } })

describe("Connected Companion compact review card", () => {
  it("uses opaque revision equality and accepts a changed hash regardless of lexical order", () => {
    expect(connectedProposalIsCurrent(proposal, initial)).toBe(true)
    expect(connectedProposalIsCurrent(proposal, saved())).toBe(false)
    expect(connectedSaveConfirmed(proposal, saved())).toBe(true)
    expect(connectedSaveConfirmed(proposal, { ...saved(), document: { ...saved().document, revision: initial.document.revision } })).toBe(false)
  })

  it.each(["organizationId", "lessonId", "documentId"] as const)("rejects a different %s in review and save confirmation", (field) => {
    const foreign = { ...proposal, [field]: "different" }
    expect(connectedProposalMatches(foreign, initial)).toBe(false)
    expect(connectedSaveConfirmed(foreign, saved())).toBe(false)
  })

  it("does not confirm absent readback or different saved content", () => {
    expect(connectedSaveConfirmed(proposal, undefined)).toBe(false)
    expect(connectedSaveConfirmed(proposal, { ...saved(), document: { ...saved().document, content: "Someone else's text" } })).toBe(false)
  })

  it("binds the write to the exact approved organization, lesson, document, hash, and retry identity", () => {
    const args = connectedSaveArguments(proposal, "stable-retry-identity")
    expect(args).toEqual({
      organizationId: initial.organization.id, lessonId: initial.lesson.id, documentId: initial.document.id,
      content: proposal.content, expectedRevision: initial.document.revision, requestId: "stable-retry-identity", confirmed: true,
    })
    expect(connectedSaveArguments(proposal, "stable-retry-identity")).toEqual(args)
  })

  it("renders compact connected status, read-only review, native links, and no embedded assignment form", () => {
    const transport = vi.fn()
    const html = renderToStaticMarkup(createElement(ConnectedCompanionPanel, { initialSnapshot: initial, proposal, transport }))
    expect(html).toContain("Connected")
    expect(html).toContain("Current draft")
    expect(html).toContain("Proposed change")
    expect(html).toContain("Save change")
    expect(html).toContain("previously published version stays unchanged")
    expect(html).toContain("Open lesson")
    expect(html).toContain("Open workspace")
    expect(html).toContain("Book coaching")
    expect(html).toContain('href="https://staging.coachhouse.app/workspace"')
    expect(html).toContain('href="https://staging.coachhouse.app/coaching"')
    expect(html).toContain('href="https://staging.coachhouse.app/organization?section=mission"')
    expect(html).not.toContain('href="https://coachhouse.app')
    expect(html).not.toMatch(/<(input|textarea|form)\b/)
    expect(html).not.toContain(initial.document.revision)
    expect(transport).not.toHaveBeenCalled()
  })

  it.each(["javascript:alert(1)", "https://user:secret@staging.coachhouse.app/accelerator", "https://staging.coachhouse.app/unrelated"])("disables native links for an invalid lesson destination: %s", (href) => {
    const snapshot = { ...initial, lesson: { ...initial.lesson, href } }
    const html = renderToStaticMarkup(createElement(ConnectedCompanionPanel, { initialSnapshot: snapshot, proposal, transport: vi.fn() }))
    expect(html).not.toContain('href=')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Open workspace/)
  })

  it("keeps foreign or unsafe secondary links within the verified application origin", () => {
    const snapshot = { ...initial, coachingHref: "javascript:alert(1)", document: { ...initial.document, href: "https://foreign.example/document" } }
    const html = renderToStaticMarkup(createElement(ConnectedCompanionPanel, { initialSnapshot: snapshot, proposal, transport: vi.fn() }))
    expect(html).toContain('href="https://staging.coachhouse.app/coaching"')
    expect(html).not.toContain("foreign.example")
    expect(html).not.toContain("javascript:")
  })

  it("explains that a stale proposal needs a new review", () => {
    const newer = { ...initial, document: { ...initial.document, revision: "a".repeat(64), content: "Changed elsewhere" } }
    const html = renderToStaticMarkup(createElement(ConnectedCompanionPanel, { initialSnapshot: newer, proposal, transport: vi.fn() }))
    expect(html).toContain("Request a refreshed proposal before saving.")
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Save change<\/button>/)
  })
})
