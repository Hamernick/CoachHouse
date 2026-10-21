import { z } from "zod"
import type { NoteContent } from "@/lib/modules/note-content"
import { loadPersonalNote, writePersonalNote } from "../server/note-module-actions"
import { getParticleNotes, type NoteDocument } from "./particle-notes"
import { particleSchema, particleGraphSchema } from "./particle-schema"
import type { Particle } from "../types"

export class NoteSaveError extends Error {
  constructor(message: string, public retryable: boolean) { super(message) }
}

export type NoteDetail = {
  body: NoteContent
  updatedAt: string | null
  version: string | null
  lesson?: { title: string; href: string; moduleId: string } | null
  particle?: Particle
  revision?: number
}
const detailSchema = z.object({ particle: particleSchema, revision: z.number().int().min(0) })
const saveSchema = z.object({ ok: z.literal(true), value: z.object({ graph: particleGraphSchema }) })
function workspaceDetail(particle: Particle, revision: number): NoteDetail {
  const note = getParticleNotes(particle)
  if (note?.kind !== "workspace") throw new Error("This note is no longer available.")
  return { body: { content: note.content, ...(note.html !== undefined ? { html: note.html } : {}) },
    updatedAt: note.contentEditedAt ?? particle.updatedAt, particle, revision, version: null }
}
export async function readNote(note: NoteDocument, organizationId: string, signal?: AbortSignal): Promise<NoteDetail> {
  if (note.source.kind === "module_note") {
    const result = await loadPersonalNote(note.source.moduleId)
    if ("error" in result) throw new Error(result.error)
    return { ...result, updatedAt: result.body.updatedAt }
  }
  const response = await fetch(`/api/account/workspace-notes?${new URLSearchParams({ organizationId, id: note.source.id })}`, { cache: "no-store", signal })
  if (!response.ok) throw new Error(response.status === 404 ? "This note is no longer available." : "Unable to load this note. Try again.")
  const detail = detailSchema.parse(await response.json())
  return workspaceDetail(detail.particle, detail.revision)
}
export async function writeNote(note: NoteDocument, detail: NoteDetail, body: NoteContent | null, editId: string): Promise<NoteDetail | null> {
  if (note.source.kind === "module_note") {
    const result = await writePersonalNote({ moduleId: note.source.moduleId, version: detail.version, body, editId })
    if ("error" in result) {
      const message = result.error ?? "Unable to confirm this save. Your draft is still here."
      throw new NoteSaveError(message, !("conflict" in result) && message.includes("confirm"))
    }
    return body === null ? null : { ...result, updatedAt: result.body.updatedAt, lesson: detail.lesson }
  }
  const particle = detail.particle
  if (!particle || particle.type !== "activity") throw new Error("Reload this note before saving.")
  const operation = body === null
    ? { kind: "remove_particle", id: particle.id, expectedRevision: particle.revision }
    : { kind: "put_particle", expectedRevision: particle.revision, particle: {
      ...particle, data: { ...particle.data, widget: { kind: "notes", source: { kind: "workspace", ...body } } },
    } }
  const response = await fetch("/api/account/workspace-notes", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: editId, workspaceId: particle.workspaceId, baseRevision: detail.revision, operations: [operation] }) })
  if (body === null && response.status === 404) return null
  const payload: unknown = await response.json()
  const result = saveSchema.safeParse(payload)
  if (!response.ok || !result.success) {
    const failure = z.object({ error: z.string() }).safeParse(payload)
    throw new NoteSaveError(failure.success ? failure.data.error : "Unable to confirm this save. Your draft is still here.", response.status >= 500)
  }
  if (body === null) return null
  const saved = result.data.value.graph.particles.find((item) => item.id === particle.id)
  if (!saved) throw new Error("This note was removed elsewhere. Copy your draft before closing.")
  return workspaceDetail(saved, result.data.value.graph.revision)
}
