import "server-only"
import { randomUUID } from "node:crypto"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import {
  canEditOrganization,
  resolveActiveOrganization,
} from "@/lib/organization/active-org"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route"
import {
  isParticleImagePath,
  PARTICLE_IMAGE_MAX_BYTES,
} from "../lib/particle-state"

const BUCKET = "roadmap-media"
const MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
}
const headers = { "Cache-Control": "private, no-store" }

async function imageContext(
  request: NextRequest,
  edit: boolean
): Promise<
  | { error: NextResponse }
  | {
      supabase: ReturnType<typeof createSupabaseRouteHandlerClient>
      orgId: string
    }
> {
  const supabase = createSupabaseRouteHandlerClient(request, new NextResponse())
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user)
    return {
      error: NextResponse.json(
        { error: "Sign in to access workspace images." },
        { status: 401, headers }
      ),
    }
  const organization = await resolveActiveOrganization(supabase, user.id)
  if (edit && !canEditOrganization(organization.role))
    return {
      error: NextResponse.json(
        { error: "Only organization editors can add images." },
        { status: 403, headers }
      ),
    }
  return { supabase, orgId: organization.orgId }
}

export async function uploadParticleImage(request: NextRequest) {
  const context = await imageContext(request, true)
  if ("error" in context) return context.error
  const form = await request.formData().catch(() => null)
  const file = form?.get("file")
  if (
    !(file instanceof File) ||
    !MIME_EXTENSIONS[file.type] ||
    file.size === 0 ||
    file.size > PARTICLE_IMAGE_MAX_BYTES
  ) {
    return NextResponse.json(
      { error: "Choose a PNG, JPG, or WebP image up to 4 MB." },
      { status: 400, headers }
    )
  }
  const bytes = Buffer.from(await file.arrayBuffer())
  const valid =
    file.type === "image/png"
      ? bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : file.type === "image/jpeg"
        ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : bytes.toString("ascii", 0, 4) === "RIFF" &&
          bytes.toString("ascii", 8, 12) === "WEBP"
  if (!valid)
    return NextResponse.json(
      { error: "This file is not a supported image." },
      { status: 400, headers }
    )
  const id = randomUUID()
  const path = `${context.orgId}/particles/${id}.${MIME_EXTENSIONS[file.type]}`
  const { error } = await context.supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: false })
  if (error)
    return NextResponse.json(
      { error: "The image could not be uploaded. Try again." },
      { status: 500, headers }
    )
  return NextResponse.json(
    {
      image: {
        id,
        path,
        title: file.name.replace(/\.[^.]+$/, "").slice(0, 160) || "Image",
      },
    },
    { status: 201, headers }
  )
}

export async function readParticleImage(request: NextRequest) {
  const context = await imageContext(request, false)
  if ("error" in context) return context.error
  const path = request.nextUrl.searchParams.get("path")
  if (
    !isParticleImagePath(path) ||
    !path.startsWith(`${context.orgId}/particles/`)
  ) {
    return NextResponse.json(
      { error: "Image not found." },
      { status: 404, headers }
    )
  }
  // The legacy bucket's direct read policy excludes board/member roles.
  // Sign only after verified organization membership and the exact path check.
  const { data, error } = await createSupabaseAdminClient()
    .storage.from(BUCKET)
    .createSignedUrl(path, 60)
  if (error || !data?.signedUrl)
    return NextResponse.json(
      { error: "Image unavailable." },
      { status: 404, headers }
    )
  return new NextResponse(null, {
    status: 307,
    headers: { ...headers, Location: data.signedUrl },
  })
}
