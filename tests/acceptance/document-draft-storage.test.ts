import { describe, expect, it } from "vitest"
import { draftKey, readDocumentDraft, removeDocumentDraft, storeDocumentDraft, type StoredDocumentDraft } from "@/features/organization-document-collaboration/lib/draft-storage"

function storage(): Storage {
  const values = new Map<string, string>()
  return { get length() { return values.size }, clear: () => values.clear(), getItem: key => values.get(key) ?? null,
    key: index => [...values.keys()][index] ?? null, removeItem: key => { values.delete(key) }, setItem: (key, value) => { values.set(key, value) } }
}
const draft: StoredDocumentDraft = { schema: 1, actorId: "coach", organizationId: "org", sectionId: "origin", clientId: "tab-1", generation: "generation", version: 1, savedAt: 1, content: "<p>Unsaved text</p>", budgetRows: [] }
describe("live document recovery storage", () => {
  it("recovers actual typed content after remount without crossing actor, org or section", () => {
    const local = storage()
    expect(storeDocumentDraft(local, draft)).toBe(true)
    expect(readDocumentDraft(local, "coach", draft, "new-tab")).toEqual(draft)
    expect(readDocumentDraft(local, "other", draft, "new-tab")).toBeNull()
    expect(readDocumentDraft(local, "coach", { ...draft, organizationId: "other" }, "new-tab")).toBeNull()
    expect(readDocumentDraft(local, "coach", { ...draft, sectionId: "other" }, "new-tab")).toBeNull()
  })
  it("an acknowledgment removes only this tab's draft", () => {
    const local = storage()
    storeDocumentDraft(local, draft)
    const second = { ...draft, clientId: "tab-2", savedAt: 2, content: "Other unsaved work" }
    storeDocumentDraft(local, second)
    removeDocumentDraft(local, draft)
    expect(readDocumentDraft(local, "coach", draft, "new-tab")).toEqual(second)
  })
  it("reports quota/storage failures honestly and ignores malformed data", () => {
    const local = storage()
    local.setItem(draftKey(draft), "broken-json")
    expect(readDocumentDraft(local, "coach", draft, "new-tab")).toBeNull()
    local.setItem = () => { throw new Error("Quota exceeded") }
    expect(storeDocumentDraft(local, draft)).toBe(false)
  })
})
