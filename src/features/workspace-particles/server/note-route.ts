import { notePreview } from "@/lib/modules/note-content"
import { sanitizeNoteContent } from "@/lib/modules/note-content-server"
import { pageNotes } from "../lib/note-pagination"
import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route"
import type { resolveActiveOrganization } from "@/lib/organization/active-org"
import type { resolveOrganizationDocumentAccess } from "@/lib/organization/document-access"
import { listUserModuleNotesIndex } from "@/lib/modules/notes-index"
import { readWorkspaceNoteDocuments } from "./note-documents"
import { particleBatchSchema } from "../lib/operation-schema"
import { getParticleNotes, type NoteDocument } from "../lib/particle-notes"
import type { ParticleBatch, ParticleCommit, ParticleResult } from "../types"

export async function handleNotesGet(request: NextRequest, accessResolvers: { resolveActiveOrganization: typeof resolveActiveOrganization; resolveOrganizationDocumentAccess: typeof resolveOrganizationDocumentAccess }) {
  const supabase = createSupabaseRouteHandlerClient(
    request,
    NextResponse.next()
  )
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const active = await accessResolvers.resolveActiveOrganization(supabase, user.id)
    const requested = request.nextUrl.searchParams.get("organizationId")
    const access =
      requested && requested !== active.orgId
        ? await accessResolvers.resolveOrganizationDocumentAccess(supabase, user.id, requested)
        : { ...active, supabase }
    if ("error" in access)
      return NextResponse.json({ error: access.error }, { status: 403 })
    const id = request.nextUrl.searchParams.get("id")
    if (id) {
      const detail = await readWorkspaceNoteDocuments(
        access.supabase,
        access.orgId,
        id
      )
      return detail
        ? NextResponse.json(detail, {
            headers: { "Cache-Control": "private, no-store" },
          })
        : NextResponse.json({ error: "Note not found." }, { status: 404 })
    }
    const query = request.nextUrl.searchParams.get("q")?.trim().slice(0, 240) ?? ""
    const [workspace, modules] = await Promise.all([
      query ? readWorkspaceNoteDocuments(access.supabase, access.orgId, undefined, query) : readWorkspaceNoteDocuments(access.supabase, access.orgId),
      listUserModuleNotesIndex({ supabase, userId: user.id, limit: null }),
    ])
    const personal: NoteDocument[] = modules.filter((note) => !query || note.content.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map((note) => ({
      id: `note:${note.moduleId}`,
      ...notePreview(note.content),
      updatedAt: note.updatedAt,
      source: { kind: "module_note", moduleId: note.moduleId },
    }))
    const notes = [...(Array.isArray(workspace) ? workspace : []), ...personal]
    const limit = request.nextUrl.searchParams.get("limit")
    let result
    try {
      const size = limit === null ? Math.max(1, notes.length) : Number(limit)
      if (!Number.isInteger(size) || size < 1 || (limit !== null && size > 50)) throw new Error()
      result = pageNotes(notes, size, request.nextUrl.searchParams.get("cursor"))
    } catch { return NextResponse.json({ error: "Invalid notes page." }, { status: 400 }) }
    return NextResponse.json(
      result,
      { headers: { "Cache-Control": "private, no-store" } }
    )
  } catch {
    return NextResponse.json(
      { error: "Unable to load notes. Try again." },
      { status: 500 }
    )
  }
}

export async function handleNotesPost(request: NextRequest, write: (batch: ParticleBatch, canvasId?: string) => Promise<ParticleResult<ParticleCommit>>, resolveActive: typeof resolveActiveOrganization) {
  const input = particleBatchSchema.safeParse(
    await request.json().catch(() => null)
  )
  if (!input.success || input.data.operations.length !== 1)
    return NextResponse.json({ error: "Invalid note update." }, { status: 400 })
  const operation = input.data.operations[0]
  if (
    (operation.kind !== "remove_particle" && operation.kind !== "put_particle") ||
    (operation.kind === "put_particle" && (operation.expectedRevision === null || getParticleNotes(operation.particle)?.kind !== "workspace"))
  )
    return NextResponse.json(
      { error: "Choose an existing workspace note." },
      { status: 400 }
    )
  try {
    const supabase = createSupabaseRouteHandlerClient(request, NextResponse.next())
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const active = await resolveActive(supabase, user.id)
    const note = await readWorkspaceNoteDocuments(supabase, active.orgId, (operation.kind === "put_particle" ? operation.particle.id : operation.id))
    if (!note || Array.isArray(note) || getParticleNotes(note.particle)?.kind !== "workspace") return NextResponse.json({ error: "Note not found." }, { status: 404 })
    if (input.data.workspaceId !== active.orgId) return NextResponse.json({ error: "Organization changed. Reload before saving." }, { status: 403 })
    if (operation.kind === "put_particle" && operation.particle.type === "activity") {
      const source = getParticleNotes(operation.particle)
      if (source?.kind === "workspace") {
        const clean = sanitizeNoteContent(source)
        operation.particle = { ...operation.particle,
          data: { ...operation.particle.data, widget: { kind: "notes", source: { kind: "workspace", ...clean } } } }
      }
    }
    const result = await write(input.data, note.workspaceCanvasId)
    return NextResponse.json(result, {
      status: result.ok
        ? 200
        : result.code === "unavailable"
          ? 503
        : result.code === "scope"
          ? 403
          : result.code === "conflict"
            ? 409
            : 400,
    })
  } catch {
    return NextResponse.json(
      { error: "Note not saved. Your draft is still here." },
      { status: 500 }
    )
  }
}
