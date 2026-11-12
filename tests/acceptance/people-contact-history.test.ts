import { knowledgeLoader } from "@/features/workspace-ai/server/knowledge-records"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import type { OrgPerson } from "@/actions/people"
import { upsertPersonAction } from "@/actions/people"
import {
  contactCoreSchema,
  contactRecordSchema,
  contactJsonSchema,
  isActiveContact,
  type ContactSource,
} from "@/lib/people/contact-schema"
import {
  stampContactChange,
  stableContactJson,
} from "@/lib/people/contact-provenance"
import {
  recordPeopleImport,
  undoPeopleImport,
  readPeopleImportHistory,
  retainPeopleImportHistory,
  type PeopleImportBatch,
} from "@/lib/people/import-history"
import {
  parsePastedPeople,
  mappedContacts,
  defaultImportMapping,
  planPeopleImport,
} from "@/features/workspace-people-import/lib"
import { importWorkspacePeople } from "@/features/workspace-people-import/server/actions"
import {
  listPeopleImports,
  undoWorkspacePeopleImport,
} from "@/features/workspace-people-import/server/history-actions"
import { PersonAdditionalFields } from "@/components/people/person-additional-fields"

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  activeOrg: vi.fn(),
  canEdit: vi.fn(),
  mutate: vi.fn(),
}))
vi.mock("@/lib/auth", () => ({ requireServerSession: mocks.session }))
vi.mock("@/lib/organization/active-org", () => ({
  resolveActiveOrganization: mocks.activeOrg,
  canEditOrganization: mocks.canEdit,
}))
vi.mock("@/lib/people/profile-write", () => ({
  mutateOrganizationPeopleProfile: mocks.mutate,
}))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }))
const now = "2026-10-25T22:00:00.000Z"
const batchId = "4af850ce-60f3-4dbf-b4b1-a59a92a77dec"
const source: ContactSource = {
  kind: "csv",
  label: "Contacts.csv",
  recordedAt: now,
  recordedBy: "user-1",
  batchId,
  verification: "unverified",
}
const person: OrgPerson = {
  id: "person-1",
  name: "Jo",
  category: "supporters",
  email: "jo@example.org",
}
const batch = (changes: PeopleImportBatch["changes"]): PeopleImportBatch => ({
  id: batchId,
  actorId: "user-1",
  createdAt: now,
  kind: "csv",
  label: "Contacts.csv",
  changes,
  added: 1,
  filled: 0,
  skipped: 0,
  review: 0,
})

describe("versioned contact contract", () => {
  it("accepts legacy records without inventing provenance and exports JSON Schema", () => {
    expect(contactRecordSchema.parse(person).contactMetadata).toBeUndefined()
    expect(contactJsonSchema()).toHaveProperty(
      "$id",
      "urn:coach-house:contact:v1"
    )
    expect(contactJsonSchema()).toHaveProperty("properties.contactMetadata")
  })
  it("validates optional CRM fields, dates, timezone and web protocols", () => {
    const base = { name: "Jo", email: "", phone: "", title: "" }
    expect(
      contactCoreSchema.safeParse({
        ...base,
        details: {
          relationshipStage: "Active",
          timezone: "America/Chicago",
          followUpDate: "2026-12-01",
          website: "https://example.org",
        },
      }).success
    ).toBe(true)
    for (const details of [
      { timezone: "invented-zone" },
      { followUpDate: "2026-02-31" },
      { website: "javascript:alert(1)" },
      { relationshipStage: "guessed" },
      { secretField: "x" },
    ])
      expect(contactCoreSchema.safeParse({ ...base, details }).success).toBe(
        false
      )
  })
  it("keeps source status unverified and only stamps changed fields", () => {
    const next = stampContactChange(
      person,
      { ...person, phone: "3125550100" },
      source
    )
    expect(next.contactMetadata?.schemaVersion).toBe(1)
    expect(next.contactMetadata?.provenance.phone).toEqual(source)
    expect(next.contactMetadata?.provenance.name).toBeUndefined()
    expect(
      contactRecordSchema.safeParse({
        ...next,
        contactMetadata: {
          ...next.contactMetadata,
          provenance: { phone: { ...source, verification: "verified" } },
        },
      }).success
    ).toBe(false)
  })
  it("serializes fingerprints consistently across object key order", () => {
    expect(stableContactJson({ b: [1, { d: 2, c: 3 }], a: undefined })).toBe(
      stableContactJson({ b: [1, { c: 3, d: 2 }] })
    )
    expect(JSON.parse(stableContactJson(person))).toEqual(person)
  })
  it("keeps optional fields hidden until added and shows source details separately", () => {
    const markup = renderToStaticMarkup(
      createElement(PersonAdditionalFields, {
        value: {},
        onChange: () => {},
        formId: "person",
        readOnly: false,
      })
    )
    expect(markup).toContain("Add field")
    expect(markup).toContain("Sources")
    expect(markup).not.toContain('type="url"')
  })
})

describe("spreadsheet paste", () => {
  it("maps TSV headers and optional fields through the normal import contract", () => {
    const parsed = parsePastedPeople(
      "Name\tEmail\tOrganization\tNext follow-up\nJo\tjo@example.org\tCommunity Org\t2026-12-01"
    )
    const contacts = mappedContacts(
      parsed,
      defaultImportMapping(parsed.headers)
    )
    expect(parsed.format).toBe("paste")
    expect(contacts[0]).toMatchObject({
      name: "Jo",
      details: { organization: "Community Org", followUpDate: "2026-12-01" },
    })
  })
  it("preserves the first contact when pasted rows have no header", () => {
    const parsed = parsePastedPeople(
      "Jo\tjo@example.org\nAlex\talex@example.org",
      false
    )
    const mapping = {
      ...defaultImportMapping(parsed.headers),
      name: "Column 1",
      email: "Column 2",
    }
    expect(mappedContacts(parsed, mapping).map((value) => value.name)).toEqual([
      "Jo",
      "Alex",
    ])
  })
  it("rejects oversized paste and additive imports preserve existing CRM values", () => {
    expect(() => parsePastedPeople("x".repeat(1_000_001))).toThrow(/1 MB/)
    const result = planPeopleImport(
      [{ ...person, details: { organization: "Existing" } }],
      [
        {
          row: 1,
          contact: {
            name: "Jo",
            email: "jo@example.org",
            title: "",
            phone: "",
            details: { organization: "Replacement", location: "Chicago" },
          },
          decision: { kind: "auto" },
        },
      ],
      "supporters"
    )
    expect(result.people[0].details).toEqual({
      organization: "Existing",
      location: "Chicago",
    })
  })
})

describe("conflict-safe import undo", () => {
  it("archives an unchanged created contact while retaining its identity and data", () => {
    const recorded = recordPeopleImport([], [person], source)
    const result = undoPeopleImport(
      recorded.people,
      batch(recorded.changes),
      now
    )
    expect(result.archived).toBe(1)
    expect(result.people[0]).toMatchObject(person)
    expect(isActiveContact(result.people[0])).toBe(false)
  })
  it("preserves a newly imported contact after a manual edit", () => {
    const recorded = recordPeopleImport([], [person], source)
    const edited = stampContactChange(
      recorded.people[0],
      { ...recorded.people[0], name: "Jo updated" },
      { ...source, kind: "manual", batchId: undefined }
    )
    const result = undoPeopleImport([edited], batch(recorded.changes), now)
    expect(result.protectedCount).toBe(1)
    expect(result.people[0].name).toBe("Jo updated")
    expect(isActiveContact(result.people[0])).toBe(true)
  })
  it("reverts untouched imported values while preserving later edits and other fields", () => {
    const recorded = recordPeopleImport(
      [person],
      [
        {
          ...person,
          title: "Director",
          phone: "3125550100",
          details: { location: "Chicago" },
        },
      ],
      source
    )
    const edited = stampContactChange(
      recorded.people[0],
      { ...recorded.people[0], title: "Founder", tags: ["keep"] },
      { ...source, kind: "manual", batchId: undefined }
    )
    const result = undoPeopleImport([edited], batch(recorded.changes), now)
    expect(result.people[0]).toMatchObject({
      title: "Founder",
      phone: null,
      tags: ["keep"],
      details: {},
    })
    expect(result.restored).toBe(2)
    expect(result.protectedCount).toBe(1)
  })
  it("does not overwrite a later edit even if the value was changed back", () => {
    const recorded = recordPeopleImport(
      [person],
      [{ ...person, title: "Director" }],
      source
    )
    const intermediate = stampContactChange(
      recorded.people[0],
      { ...recorded.people[0], title: "Founder" },
      { ...source, kind: "manual", batchId: undefined }
    )
    const edited = stampContactChange(
      intermediate,
      { ...intermediate, title: "Director" },
      { ...source, kind: "manual", batchId: undefined }
    )
    expect(
      undoPeopleImport([edited], batch(recorded.changes), now).restored
    ).toBe(0)
  })
  it("ignores already undone batches and bounds retained history", () => {
    expect(
      undoPeopleImport([person], { ...batch([]), undoneAt: now }, now).people
    ).toEqual([person])
    expect(readPeopleImportHistory([{ invalid: true }])).toEqual([])
    expect(
      retainPeopleImportHistory(
        Array.from({ length: 8 }, () => batch([])),
        now
      )
    ).toHaveLength(5)
    expect(
      retainPeopleImportHistory(
        [{ ...batch([]), createdAt: "2026-01-01T00:00:00.000Z" }],
        now
      )
    ).toEqual([])
  })
})

let profile: {
  org_people: OrgPerson[]
  people_import_history: PeopleImportBatch[]
  mission: string
}
beforeEach(() => {
  vi.clearAllMocks()
  profile = { org_people: [], people_import_history: [], mission: "Keep this" }
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi
      .fn()
      .mockImplementation(async () => ({ data: { profile, role: "member" } })),
  }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  mocks.session.mockResolvedValue({
    session: { user: { id: "user-1" } },
    supabase: { from: vi.fn(() => query) },
  })
  mocks.activeOrg.mockResolvedValue({ orgId: "org-1", role: "owner" })
  mocks.canEdit.mockReturnValue(true)
  mocks.mutate.mockImplementation(async ({ mutate }) => {
    const result = mutate(profile.org_people, profile)
    if ("error" in result) return result
    if (result.changed)
      profile = {
        ...profile,
        org_people: result.people,
        people_import_history:
          result.peopleImportHistory ?? profile.people_import_history,
      }
    return { ok: true, value: result.value }
  })
})
const request = () => ({
  organizationId: "org-1",
  batchId,
  source: { kind: "paste" as const, label: "Pasted rows" },
  category: "supporters" as const,
  rows: [
    {
      row: 1,
      contact: { name: "Jo", email: "jo@example.org", phone: "", title: "" },
      decision: { kind: "auto" as const },
    },
  ],
})
describe("authenticated contact history actions", () => {
  it("stores history with the contact change and supports reopening, undo, and safe retry", async () => {
    const result = await importWorkspacePeople(request())
    expect(result).toMatchObject({ ok: true, batchId, added: 1 })
    expect(profile.people_import_history).toHaveLength(1)
    expect(
      profile.org_people[0].contactMetadata?.provenance.email?.recordedBy
    ).toBe("user-1")
    expect(await importWorkspacePeople(request())).toMatchObject({
      added: 1,
      batchId,
    })
    expect(profile.org_people).toHaveLength(1)
    expect(await listPeopleImports("org-1")).toMatchObject({
      imports: [{ id: batchId, kind: "paste" }],
    })
    expect(
      await undoWorkspacePeopleImport({ organizationId: "org-1", batchId })
    ).toMatchObject({ ok: true, archived: 1, people: [] })
    expect(
      await undoWorkspacePeopleImport({ organizationId: "org-1", batchId })
    ).toMatchObject({ ok: true, archived: 0 })
    expect(await importWorkspacePeople(request())).toHaveProperty("error")
    expect(profile.mission).toBe("Keep this")
  })
  it("restores an archived imported contact on a deliberate new import without a duplicate", async () => {
    await importWorkspacePeople(request())
    await undoWorkspacePeopleImport({ organizationId: "org-1", batchId })
    const nextId = "6336729e-f1c8-4b4b-bc51-5af608e5db30"
    expect(
      await importWorkspacePeople({ ...request(), batchId: nextId })
    ).toMatchObject({ ok: true, filled: 1 })
    expect(profile.org_people).toHaveLength(1)
    expect(isActiveContact(profile.org_people[0])).toBe(true)
  })
  it("denies read-only, cross-organization and expired undo requests", async () => {
    mocks.canEdit.mockReturnValue(false)
    expect(await listPeopleImports("org-1")).toEqual({ error: "Forbidden" })
    expect(
      await undoWorkspacePeopleImport({ organizationId: "org-1", batchId })
    ).toEqual({ error: "Forbidden" })
    mocks.canEdit.mockReturnValue(true)
    expect(
      await undoWorkspacePeopleImport({ organizationId: "other", batchId })
    ).toHaveProperty("error")
    profile.people_import_history = [
      { ...batch([]), createdAt: "2000-01-01T00:00:00.000Z" },
    ]
    expect(
      await undoWorkspacePeopleImport({ organizationId: "org-1", batchId })
    ).toHaveProperty("error")
  })
  it("rejects stale editor revisions and writes server-owned provenance", async () => {
    await importWorkspacePeople(request())
    const current = profile.org_people[0]
    expect(
      await upsertPersonAction({
        ...current,
        name: "Changed",
        expectedRevision: 0,
      })
    ).toHaveProperty("error")
    expect(
      await upsertPersonAction({
        ...current,
        name: "Changed",
        expectedRevision: current.contactMetadata?.revision,
      })
    ).toHaveProperty("ok", true)
    expect(
      profile.org_people[0].contactMetadata?.provenance.name
    ).toMatchObject({
      kind: "manual",
      recordedBy: "user-1",
      verification: "unverified",
    })
  })
  it("commits people and undo history together while preserving a concurrent profile edit", async () => {
    const { mutateOrganizationPeopleProfile } = await vi.importActual<
      typeof import("@/lib/people/profile-write")
    >("@/lib/people/profile-write")
    let stored = {
      mission: "Original",
      org_people: [] as OrgPerson[],
      people_import_history: [] as PeopleImportBatch[],
    }
    let attempted: typeof stored | null = null
    let writes = 0
    const peerBatch = {
      ...batch([]),
      id: "6336729e-f1c8-4b4b-bc51-5af608e5db30",
    }
    const query = {
      select: () => query,
      eq: () => query,
      update: ({ profile }: { profile: typeof stored }) => {
        attempted = profile
        return query
      },
      maybeSingle: async () => {
        if (!attempted)
          return {
            data: {
              profile: structuredClone(stored),
              updated_at: String(writes),
            },
            error: null,
          }
        writes++
        if (writes === 1) {
          stored = {
            mission: "Concurrent edit",
            org_people: [{ ...person, id: "peer" }],
            people_import_history: [peerBatch],
          }
          attempted = null
          return { data: null, error: null }
        }
        stored = attempted
        attempted = null
        return { data: { updated_at: String(writes) }, error: null }
      },
    }
    await mutateOrganizationPeopleProfile<OrgPerson, null>({
      supabase: { from: () => query } as unknown as Parameters<
        typeof mutateOrganizationPeopleProfile
      >[0]["supabase"],
      orgId: "org-1",
      mutate: (people, profile) => ({
        ok: true,
        changed: true,
        value: null,
        people: [...people, person],
        peopleImportHistory: [
          ...readPeopleImportHistory(profile.people_import_history),
          batch([]),
        ],
      }),
    })
    expect(stored.mission).toBe("Concurrent edit")
    expect(stored.org_people.map((item) => item.id)).toEqual([
      "peer",
      "person-1",
    ])
    expect(stored.people_import_history.map((item) => item.id)).toEqual([
      peerBatch.id,
      batchId,
    ])
  })
  it("gives AI field sources without actor identifiers and excludes archived contacts", async () => {
    const active = stampContactChange(
      null,
      { ...person, id: batchId, details: { organization: "Community Org" } },
      source
    )
    const archived = {
      ...active,
      id: "6336729e-f1c8-4b4b-bc51-5af608e5db30",
      name: "Archived",
      contactMetadata: { ...active.contactMetadata!, archivedAt: now },
    }
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      abortSignal: vi.fn(),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({
          data: {
            profile: { org_people: [active, archived] },
            updated_at: now,
          },
          error: null,
        }),
    }
    query.select.mockReturnValue(query)
    query.eq.mockReturnValue(query)
    query.abortSignal.mockReturnValue(query)
    const context = {
      supabase: { from: () => query },
      target: { organizationId: "org-1" },
      user: { id: "actor-1" },
      graph: { particles: [] },
    } as unknown as Parameters<typeof knowledgeLoader>[0]
    const results = await knowledgeLoader(context)("person", "Jo")
    expect(results).toHaveLength(1)
    expect(JSON.parse(results[0].content)).toMatchObject({
      details: { organization: "Community Org" },
      sources: { name: { kind: "csv", verification: "unverified" } },
    })
    expect(results[0].content).not.toContain("recordedBy")
    expect(query.eq).toHaveBeenCalledWith("user_id", "org-1")
  })
})
