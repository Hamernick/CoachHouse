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

  let body: { content?: unknown; organizationId?: string } = {}
  try {
    body = (await request.json()) as { content?: unknown }
  } catch {
    // keep default empty payload
  }

  let learningUserId: string
  try {
    ;({ learningUserId } = await resolveOrganizationLearningContext(supabase, user.id, body.organizationId))
  } catch {
    return NextResponse.json({ error: "Organization access changed." }, { status: 403 })
  }
  const notesPayload = parsePayload(body.content)

  const { error: upsertError } = await supabase
    .from("module_progress")
    .upsert(
      {
        user_id: learningUserId,
        module_id: moduleId,
        notes: notesPayload as Json | null,
      },
      { onConflict: "user_id,module_id" },
    )

  if (upsertError) {
    return NextResponse.json({ error: "Unable to save notes." }, { status: 500 })
  }

  return NextResponse.json({ ok: true, notes: notesPayload })
}
