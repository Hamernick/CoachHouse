import "server-only"
import { resolveDevtoolsAudience, resolveTesterMetadata } from "@/lib/devtools/audience"
import { resolveStripeRuntimeConfigForAudience } from "@/lib/billing/stripe-runtime"
import { requireCreditOrganization } from "./credit-context"

export async function creditBillingContext(organizationId: string) {
  const { supabase, user, orgId } = await requireCreditOrganization(organizationId)
  const audience = await resolveDevtoolsAudience({ supabase, userId: user.id, fallbackIsTester: resolveTesterMetadata(user.user_metadata ?? null) })
  const runtime = resolveStripeRuntimeConfigForAudience({ isTester: audience.isTester })
  return { orgId, actorId: user.id, runtime }
}
