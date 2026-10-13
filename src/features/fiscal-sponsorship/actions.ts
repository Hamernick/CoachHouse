"use server"

import { handleGuestFiscalRecovery as guestRecovery, guestFiscalRecoveryAvailable } from "./server/guest-recovery"
export async function handleGuestFiscalRecovery(request: Request) { return guestRecovery(request) }
export async function loadGuestFiscalRecoveryAvailability() { return guestFiscalRecoveryAvailable() }

import { handleGuestFiscalFollowup as guestFollowup } from "./server/guest-followup"
export async function handleGuestFiscalFollowup(request: Request) { return guestFollowup(request) }

import { handleGuestFiscalProfile as guestProfile } from "./server/guest-profile"
export async function handleGuestFiscalProfile(request: Request) { return guestProfile(request) }

import { handleGuestFiscalEmailVerification as guestEmailVerification } from "./server/guest-email-proof"
export async function handleGuestFiscalEmailVerification(request: Request) { return guestEmailVerification(request) }

import { handleGuestFiscalDraft as guestDraft } from "./server/guest-draft"
import { handleGuestFiscalDraftRetention as guestDraftRetention } from "./server/guest-draft-retention"
export async function handleGuestFiscalDraft(request: Request) { return guestDraft(request) }
export async function handleGuestFiscalDraftRetention(request: Request) { return guestDraftRetention(request) }

import { handleGuestFiscalSession as guestSession, handleGuestFiscalSubmission as guestSubmission } from "./server/guest-submission"
import { handleGuestFiscalEmailCron as guestEmailCron } from "./server/guest-email-dispatch"

export async function handleGuestFiscalSession(request: Request) { return guestSession(request) }
export async function handleGuestFiscalSubmission(request: Request) { return guestSubmission(request) }
export async function handleGuestFiscalEmailCron(request: Request) { return guestEmailCron(request) }


import { loadGuestFiscalProjectReview as loadGuestFiscalProjectReviewImpl } from "./server/guest-project-review"

export async function loadGuestFiscalProjectReview(projectId: string) {
  return loadGuestFiscalProjectReviewImpl(projectId)
}

import { handleFiscalEmailCron as handleFiscalEmailCronImpl } from "./server/staff-email-dispatch"

export async function handleFiscalEmailCron(request: Request) {
  return handleFiscalEmailCronImpl(request)
}

import {
  loadPublicFiscalApplicant as loadPublicFiscalApplicantImpl,
  startPublicFiscalIntake as startPublicFiscalIntakeImpl,
} from "./server/public-intake"

import {
  loadFiscalSponsorshipApplicationDraft as loadFiscalSponsorshipApplicationDraftImpl,
  saveFiscalSponsorshipApplicationDraft as saveFiscalSponsorshipApplicationDraftImpl,
} from "./server/actions"
import {
  completeFiscalSponsorshipSignature as completeFiscalSponsorshipSignatureImpl,
  saveFiscalSponsorshipSigningDraft as saveFiscalSponsorshipSigningDraftImpl,
} from "./server/native-signing-actions"
import {
  buildFiscalSponsorshipSigningPreview as buildFiscalSponsorshipSigningPreviewImpl,
  loadFiscalSponsorshipSigningSession as loadFiscalSponsorshipSigningSessionImpl,
} from "./server/native-signing-session-actions"
import { handleFiscalSponsorshipDocuSealWebhook as handleFiscalSponsorshipDocuSealWebhookImpl } from "./server/docuseal-webhook"
import {
  completeFiscalSponsorshipW9 as completeFiscalSponsorshipW9Impl,
  loadFiscalSponsorshipW9Session as loadFiscalSponsorshipW9SessionImpl,
} from "./server/w9-actions"
import {
  connectFiscalSponsorshipDocumentAsset as connectFiscalSponsorshipDocumentAssetImpl,
  reviewFiscalSponsorshipApplication as reviewFiscalSponsorshipApplicationImpl,
  reviewFiscalSponsorshipDocument as reviewFiscalSponsorshipDocumentImpl,
  submitFiscalSponsorshipApplication as submitFiscalSponsorshipApplicationImpl,
} from "./server/workflow-actions"
import {
  generateFiscalSponsorshipAgreement as generateFiscalSponsorshipAgreementImpl,
  sendFiscalSponsorshipAgreementForSignature as sendFiscalSponsorshipAgreementForSignatureImpl,
} from "./server/workflow-agreement-actions"
import { loadFiscalSponsorshipProjectWorkflowSummary as loadFiscalSponsorshipProjectWorkflowSummaryImpl } from "./server/workflow-summary"
import { canManageFiscalSponsorshipForOrganization as canManageFiscalSponsorshipForOrganizationImpl } from "./server/workflow-support"

export async function loadFiscalSponsorshipApplicationDraft(
  ...args: Parameters<typeof loadFiscalSponsorshipApplicationDraftImpl>
) {
  return loadFiscalSponsorshipApplicationDraftImpl(...args)
}

export async function saveFiscalSponsorshipApplicationDraft(
  ...args: Parameters<typeof saveFiscalSponsorshipApplicationDraftImpl>
) {
  return saveFiscalSponsorshipApplicationDraftImpl(...args)
}

export async function connectFiscalSponsorshipDocumentAsset(
  ...args: Parameters<typeof connectFiscalSponsorshipDocumentAssetImpl>
) {
  return connectFiscalSponsorshipDocumentAssetImpl(...args)
}

export async function reviewFiscalSponsorshipDocument(
  ...args: Parameters<typeof reviewFiscalSponsorshipDocumentImpl>
) {
  return reviewFiscalSponsorshipDocumentImpl(...args)
}

export async function reviewFiscalSponsorshipApplication(
  ...args: Parameters<typeof reviewFiscalSponsorshipApplicationImpl>
) {
  return reviewFiscalSponsorshipApplicationImpl(...args)
}

export async function submitFiscalSponsorshipApplication(
  ...args: Parameters<typeof submitFiscalSponsorshipApplicationImpl>
) {
  return submitFiscalSponsorshipApplicationImpl(...args)
}

export async function generateFiscalSponsorshipAgreement(
  ...args: Parameters<typeof generateFiscalSponsorshipAgreementImpl>
) {
  return generateFiscalSponsorshipAgreementImpl(...args)
}

export async function sendFiscalSponsorshipAgreementForSignature(
  ...args: Parameters<typeof sendFiscalSponsorshipAgreementForSignatureImpl>
) {
  return sendFiscalSponsorshipAgreementForSignatureImpl(...args)
}

export async function handleFiscalSponsorshipDocuSealWebhook(
  ...args: Parameters<typeof handleFiscalSponsorshipDocuSealWebhookImpl>
) {
  return handleFiscalSponsorshipDocuSealWebhookImpl(...args)
}

export async function loadFiscalSponsorshipProjectWorkflowSummary(
  ...args: Parameters<typeof loadFiscalSponsorshipProjectWorkflowSummaryImpl>
) {
  return loadFiscalSponsorshipProjectWorkflowSummaryImpl(...args)
}

export async function canManageFiscalSponsorshipForOrganization(
  ...args: Parameters<typeof canManageFiscalSponsorshipForOrganizationImpl>
) {
  return canManageFiscalSponsorshipForOrganizationImpl(...args)
}

export async function completeFiscalSponsorshipSignature(
  ...args: Parameters<typeof completeFiscalSponsorshipSignatureImpl>
) {
  return completeFiscalSponsorshipSignatureImpl(...args)
}

export async function saveFiscalSponsorshipSigningDraft(
  ...args: Parameters<typeof saveFiscalSponsorshipSigningDraftImpl>
) {
  return saveFiscalSponsorshipSigningDraftImpl(...args)
}

export async function buildFiscalSponsorshipSigningPreview(
  ...args: Parameters<typeof buildFiscalSponsorshipSigningPreviewImpl>
) {
  return buildFiscalSponsorshipSigningPreviewImpl(...args)
}

export async function loadFiscalSponsorshipSigningSession(
  ...args: Parameters<typeof loadFiscalSponsorshipSigningSessionImpl>
) {
  return loadFiscalSponsorshipSigningSessionImpl(...args)
}

export async function completeFiscalSponsorshipW9(
  ...args: Parameters<typeof completeFiscalSponsorshipW9Impl>
) {
  return completeFiscalSponsorshipW9Impl(...args)
}

export async function loadFiscalSponsorshipW9Session(
  ...args: Parameters<typeof loadFiscalSponsorshipW9SessionImpl>
) {
  return loadFiscalSponsorshipW9SessionImpl(...args)
}

export async function loadPublicFiscalApplicant() {
  return loadPublicFiscalApplicantImpl()
}

export async function startPublicFiscalIntake(...args: Parameters<typeof startPublicFiscalIntakeImpl>) {
  return startPublicFiscalIntakeImpl(...args)
}
