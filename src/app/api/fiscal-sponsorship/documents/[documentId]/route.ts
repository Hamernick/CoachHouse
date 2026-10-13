import { createHash } from "node:crypto"

import { NextResponse, type NextRequest } from "next/server"

import {
  resolveProfileAudience,
  resolveTesterMetadata,
} from "@/lib/devtools/audience"
import { canManageFiscalSponsorshipForOrganization } from "@/features/fiscal-sponsorship"
import type { Database } from "@/lib/supabase"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route"

type FiscalDocumentRow = Pick<
  Database["public"]["Tables"]["fiscal_sponsorship_documents"]["Row"],
  | "file_sha256"
  | "mime"
  | "org_id"
  | "project_id"
  | "storage_bucket"
  | "storage_path"
  | "title"
>

function sanitizeFilename(value: string) {
  return `${value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-|-$/g, "") || "fiscal-sponsorship-document"}.pdf`
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const response = NextResponse.next()
  const supabase = createSupabaseRouteHandlerClient(request, response)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { documentId } = await params
  const profileAudience = await resolveProfileAudience({
    fallbackIsTester: resolveTesterMetadata(user.user_metadata ?? null),
    supabase,
    userId: user.id,
  })
  const documentClient =
    profileAudience.isPlatformStaff || profileAudience.isAdmin
      ? createSupabaseAdminClient()
      : supabase
  const { data: document, error } = await documentClient
    .from("fiscal_sponsorship_documents")
    .select("file_sha256, mime, org_id, project_id, storage_bucket, storage_path, title")
    .eq("id", documentId)
    .maybeSingle<FiscalDocumentRow>()
  if (error || !document?.storage_path || !document.file_sha256) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 })
  }
  if (
    (profileAudience.isPlatformStaff || profileAudience.isAdmin) &&
    !(await canManageFiscalSponsorshipForOrganization({
      accessLevel: profileAudience.platformAccessLevel,
      organizationId: document.org_id,
      projectId: document.project_id,
      supabase: documentClient,
      userId: user.id,
    }))
  ) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 })
  }

  const admin = createSupabaseAdminClient()
  const { data, error: downloadError } = await admin.storage
    .from(document.storage_bucket)
    .download(document.storage_path)
  if (downloadError || !data) {
    return NextResponse.json(
      { error: "Document unavailable." },
      { status: 404 }
    )
  }

  const bytes = Buffer.from(await data.arrayBuffer())
  const actualSha256 = createHash("sha256").update(bytes).digest("hex")
  if (actualSha256 !== document.file_sha256) {
    return NextResponse.json(
      { error: "Document integrity verification failed." },
      { status: 409 }
    )
  }

  const disposition =
    new URL(request.url).searchParams.get("download") === "1"
      ? "attachment"
      : "inline"
  return new Response(bytes, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": `${disposition}; filename="${sanitizeFilename(document.title)}"`,
      "Content-Type": document.mime || "application/pdf",
      "X-Content-Type-Options": "nosniff",
      "X-Document-SHA256": actualSha256,
    },
  })
}
