import "server-only"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { fiscalOrganizationLinkInputSchema, fiscalOrganizationSearchSchema } from "../lib/organization-link"

export async function searchFiscalOrganizationLink(projectId: string, query: string) {
  if (!z.string().uuid().safeParse(projectId).success || typeof query !== "string" || query.length > 100) {
    return { error: "Check the organization search." } as const
  }
  try {
    const client = await createSupabaseServerClient()
    const { data, error } = await client.rpc("search_fiscal_organization_link", { p_project_id: projectId, p_query: query.trim() })
    if (error || !data) return { error: "Unable to access this application's organization link." } as const
    return { result: fiscalOrganizationSearchSchema.parse(data) }
  } catch { return { error: "Unable to search organizations. Try again." } as const }
}

export async function linkFiscalOrganization(input: unknown) {
  const parsed = fiscalOrganizationLinkInputSchema.safeParse(input)
  if (!parsed.success) return { error: "Reload the organization search before linking." } as const
  const { projectId, organizationId, requestId, version } = parsed.data
  try {
    const client = await createSupabaseServerClient()
    const { data, error } = await client.rpc("link_fiscal_organization", {
      p_project_id: projectId, p_org_id: organizationId, p_request_id: requestId, p_version: version,
    })
    if (error) return { error: "Couldn’t confirm the link. Retry the same request.", retryable: true } as const
    const result = z.object({ state: z.enum(["linked", "denied", "conflict"]), organizationId: z.string().uuid().optional() }).strict().parse(data)
    if (result.state === "conflict") return { error: "The application or organization changed, or already has a fiscal application. Reload the search; nothing was moved." } as const
    if (result.state !== "linked" || result.organizationId !== organizationId) return { error: "This link requires an authorized fiscal reviewer and a confirmed organization owner using the application email." } as const
    // Independent readback: never show success from an unverified mutation response.
    const readback = await client.rpc("search_fiscal_organization_link", { p_project_id: projectId, p_query: "" })
    const confirmed = fiscalOrganizationSearchSchema.safeParse(readback.data)
    if (readback.error || !confirmed.success || confirmed.data.linked?.organizationId !== organizationId) {
      return { error: "Couldn’t confirm the link. Retry the same request.", retryable: true } as const
    }
    revalidatePath(`/organizations/${projectId}`)
    revalidatePath("/workspace")
    revalidatePath("/my-organization")
    return { linked: confirmed.data.linked }
  } catch { return { error: "Couldn’t confirm the link. Retry the same request.", retryable: true } as const }
}
