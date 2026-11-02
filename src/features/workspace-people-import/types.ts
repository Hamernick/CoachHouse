import type { OrgPerson } from "@/actions/people"
import type { PersonCategory } from "@/lib/people/categories"

export type ImportContact = import("zod").infer<
  typeof import("@/lib/people/contact-schema").contactCoreSchema
>
export type ImportField =
  | "name"
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "title"
  | import("@/lib/people/contact-schema").ContactDetailField
export type ImportMapping = Record<ImportField, string>
export type ImportSource = {
  headers: string[]
  rows: string[][]
  format: "csv" | "vcf" | "paste"
}
export type ImportDecision = {
  kind: "auto" | "skip" | "add" | "merge"
  targetId?: string
}
export type ImportRow = {
  row: number
  contact: ImportContact
  decision: ImportDecision
}
export type ImportEntry = {
  row: number
  name: string
  outcome: "add" | "fill" | "skip" | "review" | "invalid"
  reason: string
  candidates: { id: string; name: string }[]
  allowAdd: boolean
}
export type PeopleImportPlan = {
  people: OrgPerson[]
  entries: ImportEntry[]
  added: number
  filled: number
  skipped: number
  review: number
}
export type PeopleImportInput = {
  organizationId: string
  batchId?: string
  source?: { kind: "csv" | "vcf" | "paste"; label: string }
  category: PersonCategory
  rows: ImportRow[]
}

export type PeopleImportResult =
  | { error: string }
  | {
      ok: true
      people: OrgPerson[]
      batchId?: string
      added: number
      filled: number
      skipped: number
      review: number
    }
