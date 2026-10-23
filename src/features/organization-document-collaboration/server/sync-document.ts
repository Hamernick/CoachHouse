import "server-only"

import { randomUUID } from "node:crypto"
import { revalidatePath, revalidateTag } from "next/cache"
import { normalizeRoadmapBudgetRows, roadmapBudgetRowsEqual } from "@/lib/roadmap/budget"
import { sanitizeHtml } from "@/lib/markdown/sanitize"
import { resolveRoadmapSections, updateRoadmapSection, getRoadmapWorkspaceRevalidationPaths } from "@/lib/roadmap"
import { documentContext } from "./context"
import { applyDocumentSteps } from "../lib"
import { documentSchema, serializeDocument, validateDocument } from "../lib/schema"
import { toPlainDocumentJson } from "../lib/serialization"
import type { DocumentSession, DocumentSyncInput, DocumentSyncResult } from "../types"

import { documentTrace, DocumentOperationError } from "./diagnostics"

export async function syncOrganizationDocument(input: DocumentSyncInput): Promise<DocumentSyncResult> {
  const trace = documentTrace(input)
  try {
    if (JSON.stringify(input).length > 1_000_000) throw new DocumentOperationError("invalid", "Document request is too large.")
    const writing = Boolean(input.steps?.length || input.initialDocument || input.budget)
    const { user, admin, capabilities } = await trace.measure("authorize", () => documentContext(input, writing, trace))
    if (!input.clientId.startsWith(`${user.id}:`) || input.clientId.length > 100) throw new DocumentOperationError("invalid", "Invalid editing session.")
    if (!Number.isInteger(input.version) || input.version < 0) throw new DocumentOperationError("invalid", "Invalid document revision.")
    for (let attempt = 0; attempt < 3; attempt++) {
      const [organization, stored] = await trace.measure("read", () => Promise.all([
        admin.from("organizations").select("profile,updated_at,public_slug").eq("user_id", input.organizationId).single(),
        admin.from("organization_core_document_sessions").select("generation,version,document,steps,section_revision,section_content")
          .eq("org_id", input.organizationId).eq("section_id", input.sectionId).maybeSingle(),
      ]))
      if (organization.error || stored.error) throw new DocumentOperationError("unavailable", "Document collaboration is unavailable. Keep this editor open and try again.", organization.error?.code ?? stored.error?.code)
      const profile = organization.data.profile ?? {}
      const section = resolveRoadmapSections(profile).find(item => item.id === input.sectionId)
      if (!section) throw new DocumentOperationError("invalid", "Document no longer exists. Your local edits have not been discarded.")
      if (section.driveSource) throw new DocumentOperationError("invalid", "This document is now connected to Google Drive. Your local edits have not been discarded.")
      let session = stored.data as DocumentSession | null
      const invalidated = session && session.section_revision !== section.lastUpdated && session.section_content !== section.content
      if (input.generation && (invalidated || session?.generation !== input.generation)) {
        return { error: "This document changed outside the live editor. Copy your unsaved text before reopening to compare the latest version.", code: "external_change" }
      }
      let nextProfile = null
      let nextSection = section
      let next: DocumentSession | null = invalidated ? null : session
      if (!next && input.initialDocument) {
        if (input.expectedRevision !== section.lastUpdated) return { error: "The document changed while opening. Reopen it to load the latest version.", code: "external_change" }
        const doc = await trace.measure("bootstrap", async () => {
          const parsed = documentSchema.nodeFromJSON(input.initialDocument!)
          validateDocument(parsed)
          return parsed
        })
        if (doc.content.size > 250_000) throw new DocumentOperationError("invalid", "Document is too large.")
        next = { generation: randomUUID(), version: 0, document: toPlainDocumentJson(doc.toJSON()), steps: [], section_revision: section.lastUpdated, section_content: section.content }
      } else if (next && input.generation && input.version === next.version && input.steps?.length) {
        next = applyDocumentSteps(next, input.steps, input.clientId)
        const content = sanitizeHtml(serializeDocument(documentSchema.nodeFromJSON(next.document)))
        const updated = updateRoadmapSection(profile, input.sectionId, { content })
        nextProfile = updated.nextProfile
        nextSection = updated.section
        next.section_revision = nextSection.lastUpdated
        next.section_content = nextSection.content
      }
      if (next && next.section_revision !== nextSection.lastUpdated) next = { ...next, section_revision: nextSection.lastUpdated }
      if (next && input.generation && input.version > next.version) return { error: "Document revision is unavailable. Your edits are retained.", code: "expired" }
      if (next && input.generation === next.generation && input.version === (session?.version ?? 0) && input.budget) {
        if (input.sectionId !== "budget") throw new DocumentOperationError("invalid", "Budget rows belong to the Budget document.")
        const currentRows = section.budgetRows ?? []
        const nextRows = normalizeRoadmapBudgetRows(input.budget.next)
        if (!roadmapBudgetRowsEqual(currentRows, normalizeRoadmapBudgetRows(input.budget.base))
          && !roadmapBudgetRowsEqual(currentRows, nextRows)) {
          return { error: "Budget rows changed elsewhere. Your edits are still here. Choose which rows to keep.", code: "budget_conflict", savedBudgetRows: currentRows }
        }
        if (!roadmapBudgetRowsEqual(currentRows, nextRows)) {
          const updated = updateRoadmapSection(nextProfile ?? profile, input.sectionId, { budgetRows: nextRows })
          nextProfile = updated.nextProfile
          nextSection = updated.section
          next = { ...next, section_revision: nextSection.lastUpdated }
        }
      }
      if (next && input.generation && input.version < next.version - next.steps.length) {
        return { error: "This editing session is too old to merge safely. Copy any unsaved text before reopening the latest document.", code: "expired" }
      }
      if (next !== session && next) {
        const { data: committed, error } = await trace.measure("commit", () => admin.rpc("commit_core_document_session", {
          p_org: input.organizationId, p_section: input.sectionId,
          p_expected_updated_at: organization.data.updated_at,
          p_expected_generation: session?.generation ?? null, p_expected_version: session?.version ?? null,
          p_state: next, p_profile: nextProfile,
        }))
        if (error) throw new DocumentOperationError("unavailable", "Unable to save. Your edits remain in this editor; retry shortly.", error.code)
        if (!committed) continue
        trace.committed()
        session = next
        if (nextProfile) {
          try {
            for (const path of getRoadmapWorkspaceRevalidationPaths({ publicSlug: organization.data.public_slug, sectionSlug: nextSection.slug })) revalidatePath(path)
            revalidatePath("/resources")
            revalidateTag("public-map-organizations", "max")
          } catch (error) { trace.failure(error) } // Cache refresh cannot un-acknowledge a committed save.
        }
      } else session = next
      const responseSession = session && input.generation === session.generation
        ? { ...session, steps: session.steps.slice(Math.max(0, input.version - (session.version - session.steps.length))) }
        : session
      trace.success()
      return { section: nextSection, session: responseSession, participants: [], userId: user.id, capabilities, requestId: trace.requestId }
    }
    return { error: "Another update is still saving. Your edits are retained; retry shortly." }
  } catch (error) { return trace.failure(error) }
}

