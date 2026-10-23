import { NextResponse, type NextRequest } from "next/server"

import { resolveDocumentCapabilities } from "@/lib/organization/document-capabilities"
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route"
import { canEditOrganization, resolveActiveOrganization } from "@/lib/organization/active-org"

const BUCKET = "org-media"
const ROADMAP_INLINE_BUCKET = "roadmap-media"
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 30
const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]) as Set<string>

export async function POST(request: NextRequest) {
  const response = NextResponse.next()
  let supabase = createSupabaseRouteHandlerClient(request, response)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    return NextResponse.json({ error: error?.message ?? "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const kindParam = searchParams.get("kind")
  const kind =
    kindParam === "logo" ||
    kindParam === "logo-mark" ||
    kindParam === "header" ||
    kindParam === "roadmap" ||
    kindParam === "roadmap-inline" ||
    kindParam === "email" ||
    kindParam === "cover"
      ? kindParam
      : "cover"
  let orgId: string
  if (kind === "roadmap" || kind === "roadmap-inline") {
    if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 })
    const target = request.headers.get("x-coach-house-organization-id") ?? (await resolveActiveOrganization(supabase, user.id)).orgId
    const resolved = await resolveDocumentCapabilities(supabase, user.id, target)
    if ("error" in resolved || !resolved.capabilities.canEdit) return NextResponse.json({ error: "Document edit access required." }, { status: 403 })
    orgId = resolved.access.orgId
    supabase = resolved.access.supabase
  } else {
    const active = await resolveActiveOrganization(supabase, user.id)
    if (!canEditOrganization(active.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    orgId = active.orgId
  }
  const bucket = kind === "roadmap-inline" ? ROADMAP_INLINE_BUCKET : BUCKET

  const form = await request.formData()
  const file = form.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 })
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Unsupported image type. Use PNG, JPEG, WebP, or SVG." }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image too large. Max size is 10 MB." }, { status: 400 })
  }

  const ext = file.type === "image/svg+xml" ? "svg" : file.type.split("/").pop() || "png"
  const objectName = `${orgId}/${kind}/${Date.now()}.${ext}`
  const buf = Buffer.from(await file.arrayBuffer())

  const { error: uploadErr } = await supabase.storage.from(bucket).upload(objectName, buf, { contentType: file.type })
  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 })
  }

  if (bucket === ROADMAP_INLINE_BUCKET) {
    const { data: signed, error: signedError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(objectName, SIGNED_URL_TTL_SECONDS)
    if (signedError || !signed?.signedUrl) {
      return NextResponse.json({ error: signedError?.message ?? "Unable to access image" }, { status: 500 })
    }
    return NextResponse.json({ url: signed.signedUrl }, { status: 200 })
  }

  const { data: publicUrl } = supabase.storage.from(bucket).getPublicUrl(objectName)
  return NextResponse.json({ url: publicUrl.publicUrl }, { status: 200 })
}
