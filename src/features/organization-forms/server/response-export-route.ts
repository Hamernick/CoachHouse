import "server-only"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { exportFormResponsePage, FormResponseExportSizeError } from "../lib/form-response-export"
import { FormIntakeError, runFormIntake } from "./intake-service"

const querySchema = z.strictObject({ versionId: z.uuid(), before: z.uuid().optional() })
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", Vary: "Cookie, Origin, Sec-Fetch-Site" }
const failed = (status: number, error: string) => Response.json({ error }, { status, headers })

export async function handleFormResponseExport(request: Request) {
  const url = new URL(request.url)
  // Only the application initiates downloads. No public or cross-site export URLs.
  if (request.headers.get("sec-fetch-site") !== "same-origin" ||
    (request.headers.has("origin") && request.headers.get("origin") !== url.origin))
    return failed(403, "Open responses to export this page.")
  const query = querySchema.safeParse(Object.fromEntries(url.searchParams))
  if (!query.success || url.searchParams.size !== Object.keys(query.data).length)
    return failed(400, "Invalid export request.")
  try {
    const session = await createSupabaseServerClient()
    const { data, error } = await session.auth.getUser()
    if (error || !data.user) return failed(401, "Sign in to export responses.")
    // This canonical reader locks and checks the current form-specific authority.
    // No organization-owner shortcut, client answer upload, or cached browser data.
    const page = await runFormIntake(data.user.id, { action: "responses", ...query.data })
    const csv = exportFormResponsePage(page, query.data.versionId)
    return new Response(csv, { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="responses-${query.data.versionId}-${query.data.before ?? "latest"}.csv"` } })
  } catch (error) {
    if (error instanceof FormResponseExportSizeError) return failed(413, "This page is too large to export.")
    if (error instanceof FormIntakeError && [400, 401, 403].includes(error.status))
      return failed(error.status, error.status === 400 ? "Refresh responses before exporting." : "Response access is no longer available.")
    // No answers, identifiers from the body, or provider errors in logs/errors.
    return failed(503, "Unable to export this page. Try again.")
  }
}
