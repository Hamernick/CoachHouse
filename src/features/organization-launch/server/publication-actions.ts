"use server"

import { updateOrganizationProfileAction } from "@/actions/organization"
import { publicSharingEnabled } from "@/lib/feature-flags"
import { loadOrganizationPublicationReview } from "./load-publication-review"

export async function setOrganizationPublicationAction(input: {
  revision: string
  isPublic: boolean
}) {
  if (typeof input?.isPublic !== "boolean" || typeof input.revision !== "string") return { error: "Reload your profile preview and try again." }
  if (input.isPublic && !publicSharingEnabled) return { error: "Public sharing is not available yet. Your profile remains saved privately." }
  const review = await loadOrganizationPublicationReview()
  if ("error" in review) return { error: review.error }
  if (input.revision !== review.revision) return { error: "Your profile or selected programs changed. Reload the preview before publishing." }
  if (input.isPublic && !review.organization.publicSlug) return { error: "Choose a public profile URL in your organization settings first." }
  return updateOrganizationProfileAction({
    isPublic: input.isPublic,
    publicSlug: review.organization.publicSlug,
  }, { organizationId: review.organization.id, updatedAt: review.updatedAt })
}
