import { AdminCoachingCreditsPanel, loadAdminCoachingCredits, loadCoachingCreditsAction, issueCoachingCreditsAction, manageStaffCoachingBookingAction } from "@/features/coaching-booking"
import { loadOrganizationCoachAssignmentData, OrganizationCoachAssignmentControl, updateOrganizationCoachAssignmentAction } from "@/features/organization-coach-assignments"

import { notFound } from "next/navigation"

import { Empty } from "@/components/ui/empty"
import {
  AdminOrganizationBillingPanel,
  changeAdminOrganizationBillingPlanAction,
  loadAdminOrganizationBilling,
  refundLatestAdminOrganizationPaymentAction,
} from "@/features/admin-organization-billing"
import {
  FiscalGuestProjectReview,
  loadGuestFiscalProjectReview,
  canManageFiscalSponsorshipForOrganization,
  connectFiscalSponsorshipDocumentAsset,
  generateFiscalSponsorshipAgreement,
  loadFiscalSponsorshipProjectWorkflowSummary,
  reviewFiscalSponsorshipApplication,
  reviewFiscalSponsorshipDocument,
  sendFiscalSponsorshipAgreementForSignature,
} from "@/features/fiscal-sponsorship"
import {
  createMemberWorkspaceProjectNoteAction,
  createMemberWorkspaceProjectQuickLinkAction,
  createMemberWorkspaceTaskAction,
  deleteMemberWorkspaceProjectAction,
  deleteMemberWorkspaceTaskAction,
  deleteMemberWorkspaceProjectNoteAction,
  deleteMemberWorkspaceProjectQuickLinkAction,
  loadPlatformAdminOrganizationProjectDetailPage,
  loadOrganizationPrograms,
  MemberWorkspaceProjectDetailPage,
  updateMemberWorkspaceProjectAction,
  updateMemberWorkspaceProjectScheduleAction,
  updateMemberWorkspaceProjectNoteAction,
  updateMemberWorkspaceProjectQuickLinkAction,
  updateMemberWorkspaceTaskAction,
  updateMemberWorkspaceTaskOrderAction,
  updateMemberWorkspaceTaskStatusAction,
} from "@/features/member-workspace"
import { requirePlatformCapability } from "@/lib/admin/auth"
import type { ProjectDetails } from "@/features/platform-admin-dashboard"

type PageProps = {
  params: Promise<{ id: string }>
}

type OrganizationAdminProjectKind = "standard" | "organization_admin"

function getOrganizationAdminProjectKind(
  source: ProjectDetails["source"]
): OrganizationAdminProjectKind | undefined {
  if (!source || !("projectKind" in source)) return undefined

  return source.projectKind === "standard" ||
    source.projectKind === "organization_admin"
    ? source.projectKind
    : undefined
}

export default async function OrganizationDetailPage({ params }: PageProps) {
  const staff = await requirePlatformCapability("organizations", {
    loginRedirect: "/organizations",
  })

  const { id } = await params
  const result = await loadPlatformAdminOrganizationProjectDetailPage({
    projectId: id,
    userId: staff.userId,
  })

  if (result.state === "not-found") {
    notFound()
  }

  if (result.state === "schema-unavailable") {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-10">
        <Empty
          title="Organizations unavailable"
          description="Organizations cannot open until the latest workspace database migrations are applied."
          variant="subtle"
        />
      </div>
    )
  }

  if (result.state === "fiscal-intake") {
    const review = await loadGuestFiscalProjectReview(result.projectId)
    if (!review) notFound()
    if ("error" in review) {
      return <div className="px-6 py-10"><Empty title="Application unavailable" description={review.error} variant="subtle" /></div>
    }
    return <FiscalGuestProjectReview {...review} />
  }

  const canManageProject =
    result.scope === "organization" || result.scope === "platform-admin"
  const canManageProjectAssets =
    result.scope === "organization" || result.scope === "platform-admin"
  const canEditProjectDetails =
    result.scope === "organization" || result.scope === "platform-admin"
  const projectKind = getOrganizationAdminProjectKind(result.project.source)
  const canManageProjectTasks =
    result.scope === "organization" || result.scope === "platform-admin"
  const canDeleteProject =
    canEditProjectDetails && projectKind !== "organization_admin"
  const [
    canManageFiscalSponsorship,
    fiscalSponsorshipWorkflowSummary,
    adminBilling,
    coachAssignmentData,
    coachingCredits,
    organizationPrograms,
  ] = await Promise.all([
    result.scope === "platform-admin"
      ? canManageFiscalSponsorshipForOrganization({
          accessLevel: staff.accessLevel,
          organizationId: result.organizationSummary.orgId,
          projectId: result.project.id,
          supabase: staff.supabase,
          userId: staff.userId,
        })
      : Promise.resolve(false),
    loadFiscalSponsorshipProjectWorkflowSummary(result.project.id),
    staff.accessLevel === "developer"
      ? loadAdminOrganizationBilling(result.organizationSummary.orgId)
      : Promise.resolve(null),
    loadOrganizationCoachAssignmentData({
      organizationIds: [result.organizationSummary.orgId],
    }).catch(() => null),
    projectKind === "organization_admin"
      ? loadAdminCoachingCredits(result.organizationSummary.orgId)
      : Promise.resolve(null),
    loadOrganizationPrograms(result.organizationSummary.orgId),
  ])
  const fiscalSponsorshipWorkflowData =
    "error" in fiscalSponsorshipWorkflowSummary
      ? null
      : fiscalSponsorshipWorkflowSummary

  return (
    <MemberWorkspaceProjectDetailPage
      organizationPrograms={organizationPrograms}
      coachControl={coachAssignmentData?.available && staff.accessLevel === "developer" ? (
        <OrganizationCoachAssignmentControl
          assignments={coachAssignmentData.assignmentsByOrganizationId.get(result.organizationSummary.orgId) ?? []}
          canManage
          coachOptions={coachAssignmentData.coachOptions}
          organizationId={result.organizationSummary.orgId}
          organizationName={result.organizationSummary.name}
          updateAssignmentAction={updateOrganizationCoachAssignmentAction}
          className="h-7 rounded-full text-xs md:h-7 [&_[data-slot=avatar]]:size-5"
        />
      ) : undefined}
      assignedCoaches={
        coachAssignmentData?.available
          ? (
              coachAssignmentData.assignmentsByOrganizationId.get(
                result.organizationSummary.orgId
              ) ?? []
            ).map(({ coach }) => ({ id: coach.id, name: coach.name, imageUrl: coach.avatarUrl }))
          : null
      }
      coachingCredits={coachingCredits ? (
        <AdminCoachingCreditsPanel
          initialData={coachingCredits}
          loadAction={loadCoachingCreditsAction}
          issueAction={issueCoachingCreditsAction}
          manageAction={manageStaffCoachingBookingAction}
        />
      ) : null}
      adminBilling={adminBilling ? (
        <AdminOrganizationBillingPanel
          billing={adminBilling}
          changePlanAction={changeAdminOrganizationBillingPlanAction}
          refundLatestPaymentAction={refundLatestAdminOrganizationPaymentAction}
        />
      ) : null}
      project={result.project}
      assigneeOptions={result.assigneeOptions}
      currentUser={result.currentUser}
      organizationSummary={result.organizationSummary}
      fiscalSponsorshipWorkflowSummary={fiscalSponsorshipWorkflowData}
      canManageProject={canManageProject}
      canManageProjectAssets={canManageProjectAssets}
      canEditProjectDetails={canEditProjectDetails}
      connectFiscalSponsorshipDocumentAssetAction={
        canEditProjectDetails
          ? connectFiscalSponsorshipDocumentAsset
          : undefined
      }
      createTaskAction={
        canManageProjectTasks ? createMemberWorkspaceTaskAction : undefined
      }
      updateTaskAction={
        canManageProjectTasks ? updateMemberWorkspaceTaskAction : undefined
      }
      deleteTaskAction={
        canManageProjectTasks ? deleteMemberWorkspaceTaskAction : undefined
      }
      updateScheduleAction={canEditProjectDetails ? updateMemberWorkspaceProjectScheduleAction : undefined}
      updateProjectAction={
        canEditProjectDetails ? updateMemberWorkspaceProjectAction : undefined
      }
      deleteProjectAction={
        canDeleteProject ? deleteMemberWorkspaceProjectAction : undefined
      }
      updateTaskStatusAction={
        canManageProjectTasks
          ? updateMemberWorkspaceTaskStatusAction
          : undefined
      }
      updateTaskOrderAction={
        canManageProjectTasks ? updateMemberWorkspaceTaskOrderAction : undefined
      }
      createNoteAction={
        canManageProject ? createMemberWorkspaceProjectNoteAction : undefined
      }
      updateNoteAction={
        canManageProject ? updateMemberWorkspaceProjectNoteAction : undefined
      }
      deleteNoteAction={
        canManageProject ? deleteMemberWorkspaceProjectNoteAction : undefined
      }
      createQuickLinkAction={
        canManageProject
          ? createMemberWorkspaceProjectQuickLinkAction
          : undefined
      }
      updateQuickLinkAction={
        canManageProject
          ? updateMemberWorkspaceProjectQuickLinkAction
          : undefined
      }
      deleteQuickLinkAction={
        canManageProject
          ? deleteMemberWorkspaceProjectQuickLinkAction
          : undefined
      }
      generateFiscalSponsorshipAgreementAction={
        canManageFiscalSponsorship
          ? generateFiscalSponsorshipAgreement
          : undefined
      }
      reviewFiscalSponsorshipApplicationAction={
        canManageFiscalSponsorship
          ? reviewFiscalSponsorshipApplication
          : undefined
      }
      reviewFiscalSponsorshipDocumentAction={
        canManageFiscalSponsorship ? reviewFiscalSponsorshipDocument : undefined
      }
      sendFiscalSponsorshipAgreementForSignatureAction={
        canManageFiscalSponsorship
          ? sendFiscalSponsorshipAgreementForSignature
          : undefined
      }
    />
  )
}
