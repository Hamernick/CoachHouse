import "server-only"

import { buildFiscalSignatureEmail } from "../lib/signature-email"
import { loadGuestNotificationRecipients } from "./guest-notification-recipients"

import type { SupabaseClient } from "@supabase/supabase-js"

import { sendResendEmail } from "@/lib/email/resend"
import { env } from "@/lib/env"
import { createNotification, type NotificationTone } from "@/lib/notifications"
import type { Database } from "@/lib/supabase"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { formatFiscalSponsorshipDocumentKey } from "../lib/required-documents"
import { selectFiscalReviewerRecipientIds } from "../lib/reviewer-recipients"
import type {
  FiscalSponsorshipDocumentKey,
  FiscalSponsorshipDocumentReviewStatus,
  FiscalSponsorshipReviewDecision,
} from "../types"
import type { FiscalApplicationRow } from "./workflow-support"

type FiscalNotificationClient = SupabaseClient<Database, "public">

type FiscalNotificationPayload = {
  actorId?: string | null
  application: FiscalApplicationRow
  description: string
  href: string
  metadata?: Record<string, unknown>
  title: string
  tone?: NotificationTone
  type: string
}

type FiscalNotificationCopy = Pick<
  FiscalNotificationPayload,
  "description" | "title" | "tone"
>

type FiscalDocuSealCompletionNotificationInput = {
  actorId?: string | null
  applicationId: string
  auditDocumentId?: string | null
  executedDocumentId?: string | null
  orgId: string
  projectId: string
  projectName?: string | null
  submissionId: string
}

const FISCAL_NOTIFICATION_ORG_ROLES = new Set(["owner", "admin", "staff"])

function getFiscalNotificationClient() {
  try {
    return createSupabaseAdminClient()
  } catch (error) {
    console.error("[fiscal-sponsorship] Notifications unavailable.", error)
    return null
  }
}

function getFiscalProjectName(application: FiscalApplicationRow) {
  return application.project_name?.trim() || "Fiscal sponsorship project"
}

function uniqueUserIds(userIds: Array<string | null | undefined>) {
  return [
    ...new Set(userIds.filter((userId): userId is string => Boolean(userId))),
  ]
}

function resolveFiscalSiteUrl() {
  return (
    env.NEXT_PUBLIC_SITE_URL?.trim() ||
    env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000"
  ).replace(/\/$/, "")
}

async function loadFiscalReviewerRecipientIds({
  excludeUserId,
  orgId,
  supabase,
}: {
  excludeUserId?: string | null
  orgId: string
  supabase: Pick<FiscalNotificationClient, "from">
}) {
  const [staffResult, assignmentsResult] = await Promise.all([
    supabase
      .from("platform_staff_members")
      .select("user_id, access_level")
      .returns<
        Array<{
          access_level: "developer" | "coach"
          user_id: string
        }>
      >(),
    supabase
      .from("organization_coach_assignments")
      .select("coach_user_id")
      .eq("organization_id", orgId)
      .returns<Array<{ coach_user_id: string }>>(),
  ])

  if (staffResult.error) {
    console.error(
      "[fiscal-sponsorship] Unable to load fiscal reviewer recipients.",
      staffResult.error
    )
    return []
  }

  if (assignmentsResult.error) {
    console.error(
      "[fiscal-sponsorship] Unable to load assigned coach recipients.",
      assignmentsResult.error
    )
  }

  return selectFiscalReviewerRecipientIds({
    assignments: assignmentsResult.error ? [] : (assignmentsResult.data ?? []),
    excludeUserId,
    staff: staffResult.data ?? [],
  })
}

async function loadOrganizationEditorRecipientIds({
  excludeUserId,
  orgId,
  supabase,
}: {
  excludeUserId?: string | null
  orgId: string
  supabase: Pick<FiscalNotificationClient, "from">
}) {
  const { data, error } = await supabase
    .from("organization_memberships")
    .select("member_id, role")
    .eq("org_id", orgId)
    .returns<Array<{ member_id: string; role: string }>>()

  if (error) {
    console.error(
      "[fiscal-sponsorship] Unable to load organization notification recipients.",
      error
    )
    return uniqueUserIds([orgId]).filter((userId) => userId !== excludeUserId)
  }

  return uniqueUserIds([
    orgId,
    ...(data ?? [])
      .filter((membership) =>
        FISCAL_NOTIFICATION_ORG_ROLES.has(membership.role)
      )
      .map((membership) => membership.member_id),
  ]).filter((userId) => userId !== excludeUserId)
}

async function createFiscalNotifications({
  payload,
  recipientIds,
  supabase,
}: {
  payload: FiscalNotificationPayload
  recipientIds: string[]
  supabase: FiscalNotificationClient
}) {
  await Promise.all(
    recipientIds.map(async (userId) => {
      const result = await createNotification(supabase, {
        actorId: payload.actorId ?? null,
        description: payload.description,
        href: payload.href,
        metadata: {
          applicationId: payload.application.id,
          orgId: payload.application.org_id,
          projectId: payload.application.project_id,
          ...(payload.metadata ?? {}),
        },
        orgId: payload.application.org_id,
        title: payload.title,
        tone: payload.tone ?? "info",
        type: payload.type,
        userId,
      })

      if ("error" in result) {
        console.error(
          "[fiscal-sponsorship] Unable to create notification.",
          result.error
        )
      }
    })
  )
}

async function notifyFiscalReviewers(payload: FiscalNotificationPayload) {
  const supabase = getFiscalNotificationClient()
  if (!supabase) return

  const guestRecipients = await loadGuestNotificationRecipients(supabase, payload.application.project_id, payload.actorId)
  const recipientIds = guestRecipients ?? await loadFiscalReviewerRecipientIds({
    excludeUserId: payload.actorId,
    orgId: payload.application.org_id,
    supabase,
  })
  if (recipientIds.length === 0) return

  await createFiscalNotifications({
    payload: guestRecipients === null ? payload : { ...payload, href: `/projects/${payload.application.project_id}` },
    recipientIds,
    supabase,
  })
}

async function notifyOrganizationEditors(payload: FiscalNotificationPayload) {
  const supabase = getFiscalNotificationClient()
  if (!supabase) return

  const guestRecipients = await loadGuestNotificationRecipients(supabase, payload.application.project_id, payload.actorId)
  const recipientIds = guestRecipients ?? await loadOrganizationEditorRecipientIds({
    excludeUserId: payload.actorId,
    orgId: payload.application.org_id,
    supabase,
  })
  if (recipientIds.length === 0) return

  await createFiscalNotifications({
    payload: guestRecipients === null ? payload : { ...payload, href: `/projects/${payload.application.project_id}` },
    recipientIds,
    supabase,
  })
}

function reviewDecisionNotificationCopy({
  application,
  decision,
}: {
  application: FiscalApplicationRow
  decision: FiscalSponsorshipReviewDecision
}): FiscalNotificationCopy {
  const projectName = getFiscalProjectName(application)

  if (decision === "approved") {
    return {
      description: `${projectName} was approved for fiscal sponsorship. Agreement steps are next.`,
      title: "Fiscal sponsorship approved",
      tone: "success" satisfies NotificationTone,
    }
  }

  if (decision === "needs_info") {
    return {
      description: `Coach House needs more information for ${projectName}. Open the fiscal sponsorship flow to respond.`,
      title: "Fiscal sponsorship needs info",
      tone: "warning" satisfies NotificationTone,
    }
  }

  return {
    description: `${projectName} was declined for fiscal sponsorship. Review the notes in the fiscal sponsorship flow.`,
    title: "Fiscal sponsorship declined",
    tone: "warning" satisfies NotificationTone,
  }
}

function documentReviewNotificationCopy({
  decision,
  documentKey,
}: {
  decision: Exclude<FiscalSponsorshipDocumentReviewStatus, "pending">
  documentKey: FiscalSponsorshipDocumentKey | null
}): FiscalNotificationCopy {
  const documentLabel = documentKey
    ? formatFiscalSponsorshipDocumentKey(documentKey)
    : "Fiscal sponsorship document"

  if (decision === "accepted") {
    return {
      description: `${documentLabel} was accepted by Coach House.`,
      title: "Fiscal document accepted",
      tone: "success" satisfies NotificationTone,
    }
  }

  if (decision === "needs_info") {
    return {
      description: `${documentLabel} needs more information. Upload a new version when ready.`,
      title: "Fiscal document needs info",
      tone: "warning" satisfies NotificationTone,
    }
  }

  if (decision === "not_required") {
    return {
      description: `${documentLabel} was marked not required for this fiscal sponsorship flow.`,
      title: "Fiscal document not required",
      tone: "info" satisfies NotificationTone,
    }
  }

  return {
    description: `${documentLabel} was rejected. Upload a new version when ready.`,
    title: "Fiscal document rejected",
    tone: "warning" satisfies NotificationTone,
  }
}

export async function notifyFiscalApplicationSubmitted({
  actorId,
  application,
}: {
  actorId: string
  application: FiscalApplicationRow
}) {
  await notifyFiscalReviewers({
    actorId,
    application,
    description: `${getFiscalProjectName(application)} is ready for Coach House review.`,
    href: `/organizations/${application.project_id}`,
    title: "Fiscal sponsorship application submitted",
    tone: "info",
    type: "fiscal_sponsorship_application_submitted",
  })
}

export async function notifyFiscalApplicationReviewed({
  actorId,
  application,
  decision,
}: {
  actorId: string
  application: FiscalApplicationRow
  decision: FiscalSponsorshipReviewDecision
}) {
  const copy = reviewDecisionNotificationCopy({ application, decision })

  await notifyOrganizationEditors({
    actorId,
    application,
    href: "/my-organization",
    metadata: { decision },
    type: `fiscal_sponsorship_application_${decision}`,
    ...copy,
  })
}

export async function notifyFiscalDocumentConnected({
  actorId,
  application,
  documentId,
  documentKey,
}: {
  actorId: string
  application: FiscalApplicationRow
  documentId: string
  documentKey: FiscalSponsorshipDocumentKey
}) {
  await notifyFiscalReviewers({
    actorId,
    application,
    description: `${formatFiscalSponsorshipDocumentKey(documentKey)} for ${getFiscalProjectName(
      application
    )} is ready for review.`,
    href: `/organizations/${application.project_id}`,
    metadata: { documentId, documentKey },
    title: "Fiscal document uploaded",
    tone: "info",
    type: "fiscal_sponsorship_document_connected",
  })
}

export async function notifyFiscalDocumentReviewed({
  actorId,
  application,
  decision,
  documentId,
  documentKey,
}: {
  actorId: string
  application: FiscalApplicationRow
  decision: Exclude<FiscalSponsorshipDocumentReviewStatus, "pending">
  documentId: string
  documentKey: FiscalSponsorshipDocumentKey | null
}) {
  const copy = documentReviewNotificationCopy({ decision, documentKey })

  await notifyOrganizationEditors({
    actorId,
    application,
    href: "/my-organization",
    metadata: { decision, documentId, documentKey },
    type: `fiscal_sponsorship_document_${decision}`,
    ...copy,
  })
}

export async function notifyFiscalAgreementGenerated({
  actorId,
  application,
  documentId,
}: {
  actorId: string
  application: FiscalApplicationRow
  documentId: string
}) {
  await notifyOrganizationEditors({
    actorId,
    application,
    description: `Coach House prepared the fiscal sponsorship agreement for ${getFiscalProjectName(
      application
    )}.`,
    href: "/my-organization",
    metadata: { documentId },
    title: "Fiscal agreement prepared",
    tone: "info",
    type: "fiscal_sponsorship_agreement_generated",
  })
}

export async function notifyFiscalAgreementSent({
  actorId,
  application,
  applicantSignerEmail,
  applicantSignerId,
  packetId,
  providerSubmissionId,
}: {
  actorId: string
  application: FiscalApplicationRow
  applicantSignerEmail: string
  applicantSignerId: string
  packetId: string
  providerSubmissionId: string | null
}) {
  const payload: FiscalNotificationPayload = {
    actorId,
    application,
    description: `The fiscal sponsorship agreement for ${getFiscalProjectName(
      application
    )} was sent for signature.`,
    href: "/my-organization",
    metadata: { packetId, providerSubmissionId },
    title: "Fiscal agreement sent for signature",
    tone: "info",
    type: "fiscal_sponsorship_agreement_sent",
  }
  const supabase = getFiscalNotificationClient()
  const signingPath = `/fiscal-sponsorship/sign/${packetId}`
  const signingUrl = `${resolveFiscalSiteUrl()}${signingPath}`
  const projectName = getFiscalProjectName(application)

  await Promise.all([
    supabase
      ? createFiscalNotifications({
          payload: {
            ...payload,
            description: `${projectName} is ready for your signature.`,
            href: signingPath,
            title: "Fiscal agreement ready to sign",
          },
          recipientIds: [applicantSignerId],
          supabase,
        })
      : Promise.resolve(),
    sendResendEmail({
      ...buildFiscalSignatureEmail({ siteUrl: resolveFiscalSiteUrl(), projectName, signingUrl }),
      idempotencyKey: `fiscal-agreement-signing-${packetId}`,
      tags: [
        { name: "category", value: "fiscal-signature" },
        { name: "packet", value: packetId },
      ],
      to: applicantSignerEmail,
    }).then((result) => {
      if (!result.ok) {
        console.error(
          "[fiscal-sponsorship] Unable to send signing email.",
          result.error
        )
      }
    }),
  ])
}

export async function notifyFiscalApplicantSigned({
  actorId,
  applicationId,
  orgId,
  packetId,
  projectId,
  projectName,
}: {
  actorId: string
  applicationId: string
  orgId: string
  packetId: string
  projectId: string
  projectName: string
}) {
  await notifyFiscalReviewers({
    actorId,
    application: {
      id: applicationId,
      org_id: orgId,
      project_id: projectId,
      project_name: projectName,
    } as FiscalApplicationRow,
    description: `${projectName} was signed by the applicant and is ready for Coach House countersignature.`,
    href: `/fiscal-sponsorship/sign/${packetId}`,
    metadata: { packetId },
    title: "Fiscal agreement ready to countersign",
    tone: "info",
    type: "fiscal_sponsorship_applicant_signed",
  })
}

export async function notifyFiscalDocuSealCompleted({
  actorId = null,
  applicationId,
  auditDocumentId,
  executedDocumentId,
  orgId,
  projectId,
  projectName,
  submissionId,
}: FiscalDocuSealCompletionNotificationInput) {
  const application = {
    id: applicationId,
    org_id: orgId,
    project_id: projectId,
    project_name: projectName ?? null,
  } as FiscalApplicationRow
  const payload: FiscalNotificationPayload = {
    actorId,
    application,
    description: `DocuSeal completed signing for ${projectName?.trim() || "the fiscal sponsorship agreement"}. Final files are ready.`,
    href: "/my-organization",
    metadata: {
      auditDocumentId,
      executedDocumentId,
      submissionId,
    },
    title: "Fiscal agreement fully signed",
    tone: "success" satisfies NotificationTone,
    type: "fiscal_sponsorship_agreement_completed",
  }

  await Promise.all([
    notifyOrganizationEditors(payload),
    notifyFiscalReviewers({
      ...payload,
      href: `/organizations/${projectId}`,
    }),
  ])
}

export async function notifyFiscalNativeAgreementCompleted({
  actorId,
  applicationId,
  auditDocumentId,
  executedDocumentId,
  orgId,
  packetId,
  projectId,
  projectName,
}: {
  actorId: string
  applicationId: string
  auditDocumentId: string
  executedDocumentId: string
  orgId: string
  packetId: string
  projectId: string
  projectName: string
}) {
  const payload: FiscalNotificationPayload = {
    actorId,
    application: {
      id: applicationId,
      org_id: orgId,
      project_id: projectId,
      project_name: projectName,
    } as FiscalApplicationRow,
    description: `Signing is complete for ${projectName}. Final files are ready.`,
    href: "/my-organization",
    metadata: { auditDocumentId, executedDocumentId, packetId },
    title: "Fiscal agreement fully signed",
    tone: "success",
    type: "fiscal_sponsorship_agreement_completed",
  }

  await Promise.all([
    notifyOrganizationEditors(payload),
    notifyFiscalReviewers({
      ...payload,
      href: `/organizations/${projectId}`,
    }),
  ])
}
