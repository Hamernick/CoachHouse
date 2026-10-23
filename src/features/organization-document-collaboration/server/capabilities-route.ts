import { createSupabaseServerClient } from "@/lib/supabase/server"
import { resolveDocumentCapabilities } from "@/lib/organization/document-capabilities"

export async function handleDocumentCapabilitiesGet(request: Request) {
  const respond = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } })
  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? ""
  if (!/^[0-9a-f-]{36}$/i.test(organizationId)) return respond({ error: "Invalid organization." }, 400)
  try {
    const client = await createSupabaseServerClient()
    const { data: { user }, error } = await client.auth.getUser()
    if (error || !user) return respond({ error: "Sign in again to access this document." }, 401)
    const result = await resolveDocumentCapabilities(client, user.id, organizationId)
    if ("error" in result) return respond({ error: "Document access could not be verified." }, 403)
    return respond({ capabilities: result.capabilities })
  } catch { return respond({ error: "Unable to check document access. Try again." }, 503) }
}
