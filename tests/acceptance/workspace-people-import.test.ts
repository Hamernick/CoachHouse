import { beforeEach, describe, expect, it, vi } from "vitest"
import type { OrgPerson } from "@/actions/people"
import {
  defaultImportMapping,
  mappedContacts,
  parsePeopleImport,
  planPeopleImport,
} from "@/features/workspace-people-import/lib"
import { importWorkspacePeople } from "@/features/workspace-people-import/server/actions"
import type {
  ImportContact,
  ImportRow,
  PeopleImportInput,
} from "@/features/workspace-people-import/types"

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
const contact = (overrides: Partial<ImportContact> = {}): ImportContact => ({
  name: "Jo Rivera",
  email: "jo@example.org",
  phone: "",
  title: "",
  ...overrides,
})
const row = (
  overrides: Partial<ImportContact> = {},
  decision: ImportRow["decision"] = { kind: "auto" },
  number = 1
): ImportRow => ({ row: number, contact: contact(overrides), decision })
const existing: OrgPerson = {
  id: "jo",
  name: "Jo Rivera",
  email: "JO@example.org",
  title: "Director",
  category: "staff",
  tags: ["partner"],
  phone: "",
}
const read = (text: string, filename = "contacts.csv") => {
  const source = parsePeopleImport(text, filename)
  return mappedContacts(source, defaultImportMapping(source.headers))
}

describe("People file parsing", () => {
  it("accepts a one-column list of names", () => {
    expect(
      read("Name\nJo Rivera\nAlex Smith").map((person) => person.name)
    ).toEqual(["Jo Rivera", "Alex Smith"])
  })
  it("maps Google/Outlook columns, BOM, quoted commas and Unicode", () => {
    expect(
      read(
        '\uFEFFFirst Name,Last Name,E-mail 1 - Value,Phone 1 - Value,Job Title\r\nJo,Rivera,jo@example.org,+1 312 555 0100,"Director, communauté"'
      )
    ).toEqual([
      contact({ phone: "+1 312 555 0100", title: "Director, communauté" }),
    ])
  })
  it("allows manual column mapping without evaluating spreadsheet formulas", () => {
    const source = parsePeopleImport(
      "Contact,Address\n=1+1,jo@example.org",
      "people.csv"
    )
    expect(
      mappedContacts(source, {
        ...defaultImportMapping(source.headers),
        name: "Contact",
        email: "Address",
      })[0].name
    ).toBe("=1+1")
  })
  it.each([
    ["Name,Name\nJo,Jo", /unique/],
    ["Name,Email\nJo,jo@example.org,extra", /more values/],
    ['Name,Email\n"Jo,jo@example.org', /quotes/],
    ["Name,Email\n", /no contacts/],
  ])("rejects malformed CSV %s", (source, message) =>
    expect(() => read(source)).toThrow(message)
  )
  it("bounds bytes and rows before import", () => {
    expect(() => read("a".repeat(1_000_001))).toThrow(/1 MB/)
    expect(() =>
      read(
        "Name,Email\n" +
          Array.from(
            { length: 501 },
            (_, i) => `Jo ${i},jo${i}@example.org`
          ).join("\n")
      )
    ).toThrow(/500/)
  })
  it("reads Apple vCards with folded names, grouped fields and structured name fallback", () => {
    const cards =
      "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Jo Ri\r\n vera\r\nitem1.EMAIL:jo@example.org\r\nTEL;TYPE=CELL:tel:+13125550100\r\nTITLE:Director\\, community\r\nEND:VCARD\r\nBEGIN:VCARD\r\nVERSION:4.0\r\nN:Smith;Alex;;;\r\nEMAIL:alex@example.org\r\nEND:VCARD"
    expect(read(cards, "contacts.vcf")).toEqual([
      contact({ phone: "+13125550100", title: "Director, community" }),
      contact({ name: "Alex Smith", email: "alex@example.org" }),
    ])
  })
  it("rejects incomplete and unsupported encoded vCards", () => {
    expect(() => read("BEGIN:VCARD\nVERSION:3.0\nFN:Jo", "a.vcf")).toThrow(
      /incomplete/
    )
    expect(() =>
      read(
        "BEGIN:VCARD\nVERSION:3.0\nFN;ENCODING=QUOTED-PRINTABLE:Jo\nEND:VCARD",
        "a.vcf"
      )
    ).toThrow(/UTF-8/)
    expect(() => read("anything", "contacts.xlsx")).toThrow(/CSV or vCard/)
  })
})

describe("additive contact merge", () => {
  it("fills blanks while preserving existing values, tags and category", () => {
    const plan = planPeopleImport(
      [existing],
      [
        row({
          name: "Different imported name",
          title: "Replacement",
          phone: "+1 312 555 0100",
        }),
      ],
      "supporters"
    )
    expect(plan.people).toEqual([{ ...existing, phone: "+1 312 555 0100" }])
    expect(plan.filled).toBe(1)
    expect(existing.phone).toBe("")
  })
  it("deduplicates records within a file and repeat imports", () => {
    const rows = [row(), row({ phone: "+13125550100" }, { kind: "auto" }, 2)]
    const first = planPeopleImport([], rows, "supporters")
    expect(first.added).toBe(1)
    expect(first.people[0].phone).toBe("+13125550100")
    const second = planPeopleImport(first.people, rows, "supporters")
    expect(second.added + second.filled).toBe(0)
  })
  it("only uses a phone as an automatic match when the name also matches", () => {
    const person = { ...existing, email: "", phone: "+1 (312) 555-0100" }
    expect(
      planPeopleImport([person], [row({ phone: "+13125550100" })], "supporters")
        .filled
    ).toBe(1)
    expect(
      planPeopleImport(
        [person],
        [row({ name: "Alex", phone: "+13125550100" })],
        "supporters"
      ).added
    ).toBe(1)
  })
  it("requires a choice for same-name contacts and allows deliberate new contacts", () => {
    const ambiguous = row({ email: "another@example.org" })
    expect(planPeopleImport([existing], [ambiguous], "supporters").review).toBe(
      1
    )
    expect(
      planPeopleImport(
        [existing],
        [{ ...ambiguous, decision: { kind: "add" } }],
        "supporters"
      ).added
    ).toBe(1)
  })
  it("requires a target for duplicate emails and refuses unrelated or stale targets", () => {
    const duplicate = { ...existing, id: "jo-2", name: "Other Jo" }
    expect(
      planPeopleImport([existing, duplicate], [row()], "supporters").review
    ).toBe(1)
    expect(
      planPeopleImport(
        [existing, duplicate],
        [row({ phone: "3125550100" }, { kind: "merge", targetId: "jo-2" })],
        "supporters"
      ).people[1].phone
    ).toBe("3125550100")
    expect(
      planPeopleImport(
        [existing],
        [row({}, { kind: "merge", targetId: "another-org" })],
        "supporters"
      ).review
    ).toBe(1)
  })
  it("does not let Add as new bypass an exact email match", () => {
    expect(
      planPeopleImport([existing], [row({}, { kind: "add" })], "supporters")
        .added
    ).toBe(0)
  })
  it("skips invalid records and honors explicit skip without deleting anyone", () => {
    const plan = planPeopleImport(
      [existing],
      [
        row({ email: "bad" }),
        row({ email: "new@example.org", name: "New" }, { kind: "skip" }, 2),
      ],
      "supporters"
    )
    expect(plan.people).toEqual([existing])
    expect(plan.skipped).toBe(2)
  })
})

let people: OrgPerson[]
const input = (): PeopleImportInput => ({
  organizationId: "org-1",
  category: "supporters",
  rows: [row()],
})
beforeEach(() => {
  vi.clearAllMocks()
  people = []
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { role: "member" } }),
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
    const result = mutate(people)
    if (result.changed) people = result.people
    return { ok: true, value: result.value }
  })
})
describe("authorized import persistence", () => {
  it("checks permission and organization before writes", async () => {
    mocks.canEdit.mockReturnValue(false)
    expect(await importWorkspacePeople(input())).toEqual({ error: "Forbidden" })
    mocks.canEdit.mockReturnValue(true)
    expect(
      await importWorkspacePeople({ ...input(), organizationId: "other" })
    ).toHaveProperty("error")
    expect(mocks.mutate).not.toHaveBeenCalled()
  })
  it("validates fields and row caps server-side", async () => {
    expect(
      await importWorkspacePeople({ ...input(), rows: [row({ name: "" })] })
    ).toHaveProperty("error")
    expect(
      await importWorkspacePeople({
        ...input(),
        rows: Array.from({ length: 501 }, () => row()),
      })
    ).toHaveProperty("error")
    expect(
      await importWorkspacePeople({ ...input(), rows: [row(), row()] })
    ).toHaveProperty("error")
    expect(mocks.mutate).not.toHaveBeenCalled()
  })
  it("uses stable IDs for exact retries even when there is no email or phone", async () => {
    const request = { ...input(), rows: [row({ email: "" })] }
    expect(await importWorkspacePeople(request)).toMatchObject({
      ok: true,
      added: 1,
    })
    expect(await importWorkspacePeople(request)).toMatchObject({
      ok: true,
      added: 0,
    })
    expect(people).toHaveLength(1)
  })
  it("recomputes matches against contacts arriving during a concurrent save", async () => {
    mocks.mutate.mockImplementation(async ({ mutate }) => {
      expect(mutate([]).value.added).toBe(1)
      const retry = mutate([{ ...existing, title: "Concurrent change" }])
      people = retry.value.people
      return { ok: true, value: retry.value }
    })
    expect(await importWorkspacePeople(input())).toMatchObject({
      added: 0,
      filled: 0,
    })
    expect(people).toEqual([{ ...existing, title: "Concurrent change" }])
  })
  it("returns persistence failures without a success receipt", async () => {
    mocks.mutate.mockResolvedValue({ error: "Concurrent save; retry." })
    expect(await importWorkspacePeople(input())).toEqual({
      error: "Concurrent save; retry.",
    })
  })
})
