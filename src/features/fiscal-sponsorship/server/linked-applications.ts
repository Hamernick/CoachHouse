import "server-only"

import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { guestApplicationPayload } from "../lib/guest-submission-schema"
import { FISCAL_SPONSORSHIP_APPLICATION_STATUS_OPTIONS } from "../lib/application-draft"
import type { guestFollowupRequestSchema } from "../lib/guest-followup"

const applicationsSchema = z.array(z.object({
  reference: z.string().uuid(), projectName: z.string(),
  status: z.enum(FISCAL_SPONSORSHIP_APPLICATION_STATUS_OPTIONS.map((item) => item.value)),
  submittedAt: z.string(),
}).strict()).max(100)
export type LinkedFiscalApplication = z.infer<typeof applicationsSchema>[number]

async function applicantClient() {
  if (process.env.FISCAL_GUEST_PROFILE_IMPORT_ENABLED !== "true") return null
  const client = await createSupabaseServerClient()
  const { data: { user }, error } = await client.auth.getUser()
  return error || !user?.email_confirmed_at ? null : client
}

export async function loadLinkedFiscalApplications(): Promise<{ applications: LinkedFiscalApplication[]; error?: string }> {
  if (process.env.FISCAL_GUEST_PROFILE_IMPORT_ENABLED !== "true") return { applications: [] }
  try {
    const client = await applicantClient()
    if (!client) return { applications: [] }
    const { data, error } = await client.rpc("list_linked_fiscal_applications")
    if (error) throw new Error("applications_unavailable")
    return { applications: applicationsSchema.parse(data) }
  } catch {
    return { applications: [], error: "Your saved applications couldn’t load. Please retry." }
  }
}

export async function loadLinkedFiscalFollowup(input: z.infer<typeof guestFollowupRequestSchema>) {
  const client = await applicantClient()
  if (!client) return null
  const result = input.operation === "read"
    ? await client.rpc("read_linked_fiscal_application", { p_reference: input.reference })
    : await client.rpc("resubmit_linked_fiscal_application", {
      p_reference: input.reference, p_request_id: input.requestId, p_version: input.version,
      p_application: guestApplicationPayload(input.application),
    })
  if (result.error) throw new Error("application_unavailable")
  return result.data
}

export async function loadFiscalOrganizationApplications(organizationId: string): Promise<{ applications: LinkedFiscalApplication[]; error?: string }> {
  if (!z.string().uuid().safeParse(organizationId).success) return { applications: [], error: "Organization unavailable." }
  if (process.env.FISCAL_GUEST_PROFILE_IMPORT_ENABLED !== "true") return { applications: [] }
  try {
    const client = await applicantClient()
    if (!client) return { applications: [] }
    const { data, error } = await client.rpc("list_fiscal_organization_applications", { p_org_id: organizationId })
    if (error) throw new Error("applications_unavailable")
    return { applications: applicationsSchema.parse(data) }
  } catch { return { applications: [], error: "Your organization's application couldn’t load. Please retry." } }
}
