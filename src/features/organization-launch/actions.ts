"use server"

import { setOrganizationPublicationAction as setPublication } from "./server/publication-actions"
import { loadOrganizationPublicationReview } from "./server/load-publication-review"
import { publicSharingEnabled } from "@/lib/feature-flags"

export async function loadLaunchPublicationReviewAction() {
  return { review: await loadOrganizationPublicationReview(), available: publicSharingEnabled }
}

export async function setOrganizationPublicationAction(input: { revision: string; isPublic: boolean }) {
  return setPublication(input)
}
