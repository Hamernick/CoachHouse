import { describe, expect, it } from "vitest"
import {
  workspacePageDraftSchema,
  workspacePageSchema,
  workspacePageSnapshotSchema,
} from "@/features/workspace-sharing"

const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const now = "2026-10-16T18:30:00.000Z"
const draft = { title: "Community table", description: "Join us", particleIds: [id(2), id(1)] }
const snapshot = {
  version: 1,
  brand: { name: "Community table", organizationSlug: "community-table" },
  title: draft.title,
  description: draft.description,
  items: draft.particleIds.map((id) => ({ id, title: "Published note", content: { kind: "notes", markdown: "Saved content" } })),
}
const page = {
  id: id(10), orgId: id(11), linkId: id(12), revision: 1, draft,
  visibility: "private", publishedSnapshot: null, publishedAt: null,
  createdAt: now, updatedAt: now,
}

describe("workspace sharing membership and snapshot contracts", () => {
  it("preserves explicit membership order without canvas geometry", () => {
    expect(workspacePageDraftSchema.parse(draft).particleIds).toEqual([id(2), id(1)])
    expect(workspacePageDraftSchema.safeParse({ ...draft, position: { x: 1, y: 2 } }).success).toBe(false)
  })
  it.each([[], [id(1), id(1)], ["not-a-uuid"], Array.from({ length: 51 }, (_, i) => id(i + 1))])(
    "rejects empty, duplicate, invalid or excessive membership (%j)", (particleIds) => {
      expect(workspacePageDraftSchema.safeParse({ ...draft, particleIds }).success).toBe(false)
    })
  it("allows an unnamed draft while bounding titles and descriptions", () => {
    expect(workspacePageDraftSchema.parse({ ...draft, title: "  " }).title).toBe("")
    expect(workspacePageDraftSchema.safeParse({ ...draft, title: "x".repeat(241) }).success).toBe(false)
    expect(workspacePageDraftSchema.safeParse({ ...draft, description: "x".repeat(2001) }).success).toBe(false)
  })
  it("keeps subsequent draft edits separate from the confirmed snapshot", () => {
    const saved = workspacePageSchema.parse({ ...page, visibility: "public", publishedSnapshot: snapshot, publishedAt: now })
    saved.draft.title = "Unfinished private title"
    saved.draft.particleIds.reverse()
    expect(saved.publishedSnapshot?.title).toBe("Community table")
    expect(saved.publishedSnapshot?.items.map((item) => item.id)).toEqual([id(2), id(1)])
    expect(workspacePageSchema.safeParse(saved).success).toBe(true)
  })
  it("cannot make a draft public without committed content", () => {
    expect(workspacePageSchema.safeParse(page).success).toBe(true)
    expect(workspacePageSchema.safeParse({ ...page, visibility: "public" }).success).toBe(false)
    expect(workspacePageSchema.safeParse({ ...page, publishedAt: now }).success).toBe(false)
    expect(workspacePageSchema.safeParse({ ...page, publishedSnapshot: snapshot }).success).toBe(false)
  })
  it("can retain a prior publication privately without a history collection", () => {
    expect(workspacePageSchema.safeParse({ ...page, publishedSnapshot: snapshot, publishedAt: now }).success).toBe(true)
    expect(workspacePageSchema.safeParse({ ...page, history: [snapshot] }).success).toBe(false)
  })
  it.each(["orgId", "particleIds", "accessToken", "source", "responses", "destination", "state"])(
    "rejects private property %s at every public boundary", (key) => {
      expect(workspacePageSnapshotSchema.safeParse({ ...snapshot, [key]: "private" }).success).toBe(false)
      expect(workspacePageSnapshotSchema.safeParse({ ...snapshot, brand: { ...snapshot.brand, [key]: "private" } }).success).toBe(false)
      expect(workspacePageSnapshotSchema.safeParse({ ...snapshot, items: [{ ...snapshot.items[0], [key]: "private" }] }).success).toBe(false)
    })
  it("rejects duplicated items, ungranted files and malformed brand paths", () => {
    expect(workspacePageSnapshotSchema.safeParse({ ...snapshot, items: [snapshot.items[0], snapshot.items[0]] }).success).toBe(false)
    expect(workspacePageSnapshotSchema.safeParse({ ...snapshot, items: [{ id: id(1), title: "File", content: { kind: "document", path: "private/file.pdf" } }] }).success).toBe(false)
    for (const organizationSlug of ["../private", "https://example.com", "Org Name", "-leading", "trailing-"]) {
      expect(workspacePageSnapshotSchema.safeParse({ ...snapshot, brand: { ...snapshot.brand, organizationSlug } }).success).toBe(false)
    }
  })
})
