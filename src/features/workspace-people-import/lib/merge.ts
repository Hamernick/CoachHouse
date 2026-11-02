import type { OrgPerson } from "@/actions/people"
import type { PersonCategory } from "@/lib/people/categories"
import type { ImportContact, ImportRow, PeopleImportPlan } from "../types"

export { contactCoreSchema as importContactSchema } from "@/lib/people/contact-schema"
import {
  contactCoreSchema as importContactSchema,
  CONTACT_DETAIL_FIELDS,
} from "@/lib/people/contact-schema"
const nameKey = (value: string) =>
  value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase()
const emailKey = (value?: string | null) => value?.trim().toLowerCase() || ""
const phoneKey = (value?: string | null) => {
  const digits = (value ?? "").replace(/\D/g, "")
  return digits.length >= 7 ? digits : ""
}

export function planPeopleImport(
  existing: OrgPerson[],
  rows: ImportRow[],
  category: PersonCategory,
  createId: (contact: ImportContact) => string = (contact) =>
    `preview:${JSON.stringify(contact)}`
): PeopleImportPlan {
  const people = new Map(existing.map((person) => [person.id, { ...person }]))
  const original = new Set(people.keys()),
    added = new Set<string>(),
    filled = new Set<string>()
  const emails = new Map<string, Set<string>>(),
    names = new Map<string, Set<string>>(),
    phones = new Map<string, Set<string>>()
  const put = (map: Map<string, Set<string>>, key: string, id: string) => {
    if (key) map.set(key, new Set([...(map.get(key) ?? []), id]))
  }
  const index = (person: OrgPerson) => {
    put(emails, emailKey(person.email), person.id)
    put(names, nameKey(person.name), person.id)
    if (phoneKey(person.phone))
      put(
        phones,
        `${phoneKey(person.phone)}:${nameKey(person.name)}`,
        person.id
      )
  }
  existing.forEach(index)
  const entries: PeopleImportPlan["entries"] = []
  for (const row of rows) {
    const parsed = importContactSchema.safeParse(row.contact)
    const entry: PeopleImportPlan["entries"][number] = {
      row: row.row,
      name: row.contact.name,
      outcome: "skip",
      reason: "Skipped",
      candidates: [],
      allowAdd: false,
    }
    entries.push(entry)
    if (!parsed.success) {
      entry.outcome = "invalid"
      entry.reason = parsed.error.issues[0]?.message ?? "Invalid contact"
      continue
    }
    const contact = parsed.data
    const importId = createId(contact)
    const strong = new Set([
      ...(emails.get(emailKey(contact.email)) ?? []),
      ...(phoneKey(contact.phone)
        ? (phones.get(`${phoneKey(contact.phone)}:${nameKey(contact.name)}`) ??
          [])
        : []),
      ...(people.has(importId) ? [importId] : []),
    ])
    const candidates = strong.size
      ? strong
      : (names.get(nameKey(contact.name)) ?? new Set<string>())
    entry.candidates = [...candidates]
      .filter((id) => original.has(id))
      .map((id) => ({ id, name: people.get(id)!.name }))
    entry.allowAdd = strong.size === 0
    if (row.decision.kind === "skip") continue
    let target = strong.size === 1 ? [...strong][0] : undefined
    if (row.decision.kind === "merge") {
      if (!row.decision.targetId || !candidates.has(row.decision.targetId)) {
        entry.outcome = "review"
        entry.reason = "The match changed. Review again."
        continue
      }
      target = row.decision.targetId
    } else if (
      strong.size > 1 ||
      (!strong.size && candidates.size && row.decision.kind !== "add")
    ) {
      entry.outcome = "review"
      entry.reason =
        strong.size > 1
          ? "Multiple matching contacts"
          : "Same name; choose how to import"
      continue
    }
    if (target) {
      const current = people.get(target)!
      const next = { ...current }
      if (current.contactMetadata?.archivedAt)
        next.contactMetadata = {
          ...current.contactMetadata,
          archivedAt: undefined,
        }
      for (const field of Object.keys(CONTACT_DETAIL_FIELDS) as Array<
        keyof NonNullable<ImportContact["details"]>
      >) {
        const value = contact.details?.[field]
        if (!current.details?.[field]?.trim() && value)
          next.details = { ...next.details, [field]: value }
      }
      for (const field of ["email", "phone", "title"] as const)
        if (!current[field]?.trim() && contact[field])
          next[field] = contact[field]
      if (
        current.contactMetadata?.archivedAt ||
        JSON.stringify(next.details) !== JSON.stringify(current.details) ||
        (["email", "phone", "title"] as const).some(
          (field) => next[field] !== current[field]
        )
      ) {
        people.set(target, next)
        index(next)
        if (original.has(target)) filled.add(target)
        entry.outcome = "fill"
        entry.reason = `Fill empty fields in ${current.name}`
      } else entry.reason = `Already saved: ${current.name}`
    } else {
      const person: OrgPerson = { id: importId, ...contact, category }
      people.set(person.id, person)
      index(person)
      added.add(person.id)
      entry.outcome = "add"
      entry.reason = "New contact"
    }
  }
  return {
    people: [...people.values()],
    entries,
    added: added.size,
    filled: filled.size,
    skipped: entries.filter(
      (entry) => entry.outcome === "skip" || entry.outcome === "invalid"
    ).length,
    review: entries.filter((entry) => entry.outcome === "review").length,
  }
}
