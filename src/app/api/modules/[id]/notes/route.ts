import { resolveOrganizationLearningContext } from "@/lib/accelerator/organization-context"
import { NextResponse, type NextRequest } from "next/server"

import { isSupabaseAuthSessionMissingError } from "@/lib/supabase/auth-errors"
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route"
import type { Json } from "@/lib/supabase/schema/json"

type NotesPayload = {
  content: string
  format: "markdown"
}

function parsePayload(value: unknown): NotesPayload | null {
  if (typeof value !== "string") return null
  const content = value.trim()
  if (!content) return null
  return {
    content,
    format: "markdown",
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: moduleId } = await context.params
  if (!moduleId) {
    return NextResponse.json({ error: "Missing module id." }, { status: 400 })
  }

  const response = NextResponse.next()
  const supabase = createSupabaseRouteHandlerClient(request, response)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error && !isSupabaseAuthSessionMissingError(error)) {
    return NextResponse.json({ error: "Unable to load user." }, { status: 500 })
  }
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  let body: { content?: unknown; organizationId?: string; revision?: Json | null } = {}
  try {
    body = (await request.json()) as { content?: unknown }
  } catch {
    return NextResponse.json({ error: "Invalid notes." }, { status: 400 })
  }

  if (!body || typeof body.content !== "string") return NextResponse.json({ error: "Invalid notes." }, { status: 400 })

  let learningUserId: string
  try {
    ;({ learningUserId } = await resolveOrganizationLearningContext(supabase, user.id, body.organizationId))
  } catch {
    return NextResponse.json({ error: "Organization access changed." }, { status: 403 })
  }
  const notesPayload = parsePayload(body.content)

  if (body.revision !== undefined) {
    const { data, error: saveError } = await supabase.rpc("save_module_notes_if_current", {
      p_user_id: learningUserId, p_module_id: moduleId,
      p_notes: notesPayload as Json | null, p_expected_notes: body.revision,
    })
    if (saveError) return NextResponse.json({ error: "Unable to save notes." }, { status: 500 })
    if (!data || typeof data !== "object" || Array.isArray(data) || data.ok !== true) {
      return NextResponse.json({ error: "Notes changed elsewhere." }, { status: 409 })
    }
  } else {
    const { error: upsertError } = await supabase.from("module_progress").upsert({
      user_id: learningUserId, module_id: moduleId, notes: notesPayload as Json | null,
    }, { onConflict: "user_id,module_id" })
    if (upsertError) return NextResponse.json({ error: "Unable to save notes." }, { status: 500 })
  }

  return NextResponse.json({ ok: true, notes: notesPayload })
}
