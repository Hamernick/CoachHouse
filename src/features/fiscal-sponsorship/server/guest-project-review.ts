import "server-only"

import { z } from "zod"
import { resolveAuthenticatedAppContext } from "@/lib/auth/request-context"
import { loadFiscalSponsorshipApplicationDraft } from "./actions"
import { loadFiscalSponsorshipProjectWorkflowSummary } from "./workflow-summary"

const emailStatusSchema = z.array(z.object({
  recipient: z.string(), status: z.string(), queuedAt: z.string(), occurredAt: z.string().nullable(),
}))

const summarySchema = z.object({
  projectId: z.string().uuid(),
  projectName: z.string(),
  accountLinked: z.boolean(),
  emailVerified: z.boolean(),
})

export async function loadGuestFiscalProjectReview(projectId: string) {
  if (!z.string().uuid().safeParse(projectId).success) return null
  const context = await resolveAuthenticatedAppContext()
  if (!context.profileAudience.isPlatformStaff) return null
  const { data, error } = await context.supabase.rpc("get_fiscal_guest_project_summary", {
    p_project_id: projectId,
    p_user_id: context.user.id,
  })
  const summary = summarySchema.safeParse(data)
  if (error || !summary.success) return null
  const [draft, workflow] = await Promise.all([
    loadFiscalSponsorshipApplicationDraft(projectId),
    loadFiscalSponsorshipProjectWorkflowSummary(projectId),
  ])
  if ("error" in draft || !draft.application || "error" in workflow) {
    return { error: "The application could not be loaded. Refresh to try again." }
  }
  let emailDelivery = null
  if (process.env.FISCAL_EMAIL_TRACKING_ENABLED === "true") {
    const result = await context.supabase.rpc("get_fiscal_guest_email_status", { p_project_id: projectId, p_user_id: context.user.id })
    const parsed = emailStatusSchema.safeParse(result.data)
    if (!result.error && parsed.success) emailDelivery = parsed.data
  }
  return { ...summary.data, application: draft.application, workflow, emailDelivery }
}
