"use server"

import { createHash, randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import type { OrgPerson } from "@/actions/people"
import { requirePeopleImportAccess } from "./access"
import {
  isActiveContact,
  type ContactSource,
} from "@/lib/people/contact-schema"
import {
  readPeopleImportHistory,
  recordPeopleImport,
  retainPeopleImportHistory,
  type PeopleImportBatch,
} from "@/lib/people/import-history"
import { PERSON_CATEGORY_META } from "@/lib/people/categories"
import { mutateOrganizationPeopleProfile } from "@/lib/people/profile-write"
import {
  importContactSchema,
  planPeopleImport,
  MAX_PEOPLE_IMPORT_ROWS,
} from "../lib"
import type { PeopleImportInput, PeopleImportResult } from "../types"

const schema = z
  .object({
    organizationId: z.string().min(1).max(128),
    batchId: z.uuid().optional(),
    source: z
      .object({
        kind: z.enum(["csv", "vcf", "paste"]),
        label: z
          .string()
          .trim()
          .min(1)
          .max(160)
          .regex(/^[^\u0000-\u001f\u007f]+$/),
      })
      .strict()
      .optional(),
    category: z.enum(
      Object.keys(PERSON_CATEGORY_META) as [
        PeopleImportInput["category"],
        ...PeopleImportInput["category"][],
      ]
    ),
    rows: z
      .array(
        z
          .object({
            row: z.number().int().min(1).max(MAX_PEOPLE_IMPORT_ROWS),
            contact: importContactSchema,
            decision: z
              .object({
                kind: z.enum(["auto", "skip", "add", "merge"]),
                targetId: z.string().max(2048).optional(),
              })
              .strict(),
          })
          .strict()
      )
      .min(1)
      .max(MAX_PEOPLE_IMPORT_ROWS),
  })
  .strict()

export async function importWorkspacePeople(
  input: PeopleImportInput
): Promise<PeopleImportResult> {
  if (
    !input ||
    !Array.isArray(input.rows) ||
    input.rows.length > MAX_PEOPLE_IMPORT_ROWS
  )
    return { error: "Import up to 500 contacts at a time." }
  const parsed = schema.safeParse(input)
  if (!parsed.success)
    return { error: "Review the contact fields before importing." }
  if (
    new Set(parsed.data.rows.map((row) => row.row)).size !==
    parsed.data.rows.length
  )
    return { error: "Duplicate import rows." }
  const access = await requirePeopleImportAccess(parsed.data.organizationId)
  if ("error" in access) return { error: access.error }
  const { supabase, orgId, actorId } = access
  const batchId = parsed.data.batchId ?? randomUUID()
  const source: ContactSource = {
    kind: parsed.data.source?.kind ?? "csv",
    label: parsed.data.source?.label ?? "Contacts import",
    batchId,
    recordedAt: new Date().toISOString(),
    recordedBy: actorId,
    verification: "unverified",
  }
  const result = await mutateOrganizationPeopleProfile<
    OrgPerson,
    {
      people: OrgPerson[]
      batchId?: string
      added: number
      filled: number
      skipped: number
      review: number
    }
  >({
    supabase,
    orgId,
    mutate: (people, profile) => {
      const history = readPeopleImportHistory(profile?.people_import_history)
      const previous = history.find((item) => item.id === batchId)
      if (previous) {
        if (previous.actorId !== actorId || previous.undoneAt)
          return {
            error: "This import was already processed. Start a new import.",
          }
        return {
          ok: true,
          changed: false,
          value: {
            people: people.filter(isActiveContact),
            batchId,
            added: previous.added,
            filled: previous.filled,
            skipped: previous.skipped,
            review: previous.review,
          },
        }
      }
      const plan = planPeopleImport(
        people,
        parsed.data.rows,
        parsed.data.category,
        (contact) => {
          const hash = createHash("sha256")
            .update(JSON.stringify([orgId, contact]))
            .digest("hex")
          return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`
        }
      )
      const recorded = recordPeopleImport(people, plan.people, source)
      const value = {
        people: recorded.people.filter(isActiveContact),
        ...(recorded.changes.length ? { batchId } : {}),
        added: plan.added,
        filled: plan.filled,
        skipped: plan.skipped,
        review: plan.review,
      }
      if (!recorded.changes.length) return { ok: true, changed: false, value }
      const batch: PeopleImportBatch = {
        id: batchId,
        actorId,
        createdAt: source.recordedAt,
        label: source.label,
        kind: source.kind === "manual" ? "csv" : source.kind,
        changes: recorded.changes,
        added: plan.added,
        filled: plan.filled,
        skipped: plan.skipped,
        review: plan.review,
      }
      let retained: PeopleImportBatch[]
      try {
        retained = retainPeopleImportHistory(
          [...history, batch],
          source.recordedAt
        )
      } catch {
        return {
          error:
            "Split this import into smaller files so it can be undone safely.",
        }
      }
      return {
        ok: true,
        changed: true,
        people: recorded.people,
        peopleImportHistory: retained,
        value,
      }
    },
  })
  if ("error" in result) return result
  for (const path of ["/my-organization", "/workspace", "/people"])
    revalidatePath(path)
  return { ok: true as const, ...result.value }
}
