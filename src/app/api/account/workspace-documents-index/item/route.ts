import { NextResponse, type NextRequest } from "next/server"

import { listUserModuleNotesIndex } from "@/lib/modules/notes-index"
import { resolveActiveOrganization } from "@/lib/organization/active-org"
import { resolveOrganizationDocumentAccess } from "@/lib/organization/document-access"
import { resolveRoadmapSections } from "@/lib/roadmap"
import { sanitizeHtml } from "@/lib/markdown/sanitize"
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route"

type WorkspaceDocumentDetail = {
  id: string
  source: "roadmap" | "note"
  title: string
  subtitle: string | null
  updatedAt: string | null
  previewType: "roadmap_html" | "markdown"
  contentHtml: string | null
  contentMarkdown: string | null
}

export async function GET(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = createSupabaseRouteHandlerClient(request, response)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json(
      { error: error?.message ?? "Unauthorized" },
      { status: 401 },
    )
  }

  const { searchParams } = new URL(request.url)
  const rawId = searchParams.get("id")?.trim() ?? ""
  if (!rawId || !rawId.includes(":")) {
    return NextResponse.json({ error: "Item id is required." }, { status: 400 })
  }

  try {
    if (rawId.startsWith("roadmap:")) {
      const sectionKey = rawId.slice("roadmap:".length).trim()
      if (!sectionKey) {
        return NextResponse.json({ error: "Roadmap item id is required." }, { status: 400 })
      }

      const organizationId = searchParams.get("organizationId")
      const access = organizationId
        ? await resolveOrganizationDocumentAccess(
            supabase,
            user.id,
            organizationId
          )
        : { ...(await resolveActiveOrganization(supabase, user.id)), supabase }
      if ("error" in access)
        return NextResponse.json({ error: access.error }, { status: 403 })
      const { orgId } = access
      const { data: orgRow, error: orgError } = await access.supabase
        .from("organizations")
        .select("profile")
        .eq("user_id", orgId)
        .maybeSingle<{ profile: Record<string, unknown> | null }>()

      if (orgError) {
        return NextResponse.json({ error: orgError.message }, { status: 500 })
      }

      const profile = (orgRow?.profile ?? {}) as Record<string, unknown>
      const section =
        resolveRoadmapSections(profile).find(
          (entry) => entry.id === sectionKey || entry.slug === sectionKey,
        ) ?? null

      if (!section) {
        return NextResponse.json({ error: "Roadmap item not found." }, { status: 404 })
      }

      const detail: WorkspaceDocumentDetail = {
        id: rawId,
        source: "roadmap",
        title: section.title,
        subtitle: section.subtitle,
        updatedAt: section.lastUpdated,
        previewType: "roadmap_html",
        contentHtml: sanitizeHtml(section.content || ""),
        contentMarkdown: null,
      }

      return NextResponse.json({ detail }, { status: 200 })
    }

    if (rawId.startsWith("note:")) {
      const moduleId = rawId.slice("note:".length).trim()
      if (!moduleId) {
        return NextResponse.json({ error: "Note item id is required." }, { status: 400 })
      }

      const notes = await listUserModuleNotesIndex({
        supabase,
        userId: user.id,
        limit: 320,
      })
      const note = notes.find((entry) => entry.moduleId === moduleId) ?? null
      if (!note) {
        return NextResponse.json({ error: "Note item not found." }, { status: 404 })
      }

      const detail: WorkspaceDocumentDetail = {
        id: rawId,
        source: "note",
        title: `${note.moduleTitle} notes`,
        subtitle: note.classTitle ? `${note.classTitle} · Accelerator` : "Accelerator",
        updatedAt: note.updatedAt,
        previewType: "markdown",
        contentHtml: null,
        contentMarkdown: note.content,
      }

      return NextResponse.json({ detail }, { status: 200 })
    }

    return NextResponse.json({ error: "Unsupported item type." }, { status: 400 })
  } catch (loadError: unknown) {
    return NextResponse.json(
      {
        error:
          loadError instanceof Error
            ? loadError.message
            : "Unable to load workspace document item",
      },
      { status: 500 },
    )
  }
}
