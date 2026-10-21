"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Sheet } from "@/components/ui/sheet"
import {
  loadFiscalWorkspaceApplications,
  loadFiscalSponsorshipProjectWorkflowSummary,
  startFiscalWorkspaceApplication,
} from "../actions"
import { buildFiscalSponsorshipProjectWorkbenchData } from "../lib/project-workbench-data"
import { buildSelectedProgramPrefill, buildWorkspaceApplicantPrefill } from "../lib/workspace-application-prefill"
import {
  fiscalWorkspaceApplicationStatus,
  workspaceApplicationPrefill,
  type FiscalWorkspaceApplication,
} from "../lib/workspace-applications"
import type {
  FiscalSponsorshipApplicationPrefill,
  FiscalSponsorshipProgramOption,
  FiscalSponsorshipProjectWorkbenchData,
  FiscalSponsorshipProjectWorkflowSummary,
} from "../types"
import { FiscalSponsorshipApplicationDrawer } from "./fiscal-sponsorship-application-drawer"
import { FiscalSponsorshipStartDialog } from "./fiscal-sponsorship-start-dialog"
import { FiscalSponsorshipWorkflowDrawer } from "./fiscal-sponsorship-workflow-drawer"
import { FiscalSponsorshipWorkspaceCardSurface } from "./fiscal-sponsorship-workspace-card-surface"

export { buildSelectedProgramPrefill } from "../lib/workspace-application-prefill"

export function FiscalSponsorshipWorkspaceCardSummary({
  actionRequest = null,
  applicationPrefill = null,
  fiscalSponsorshipProjectId = null,
  organizationName = null,
  programs = [],
}: {
  actionRequest?: { id: number; phaseId: "application-intake" | "required-documents" } | null
  applicationPrefill?: FiscalSponsorshipApplicationPrefill | null
  fiscalSponsorshipProjectId?: string | null
  fiscalSponsorshipWorkflowSummary?: FiscalSponsorshipProjectWorkflowSummary | null
  organizationName?: string | null
  programs?: FiscalSponsorshipProgramOption[]
}) {
  const router = useRouter()
  const [applications, setApplications] = React.useState<FiscalWorkspaceApplication[]>([])
  const [scope, setScope] = React.useState<{ orgId: string; canCreate: boolean } | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [startError, setStartError] = React.useState<string | null>(null)
  const [starterOpen, setStarterOpen] = React.useState(false)
  const [starterVersion, setStarterVersion] = React.useState(0)
  const [creating, setCreating] = React.useState(false)
  const [busyProjectId, setBusyProjectId] = React.useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [applicationOpen, setApplicationOpen] = React.useState(false)
  const [applicationData, setApplicationData] = React.useState<FiscalSponsorshipProjectWorkbenchData | null>(null)
  const [selectedPhaseId, setSelectedPhaseId] = React.useState("application-intake")
  const handledActionRequestIdRef = React.useRef<number | null>(null)
  const operationRef = React.useRef(false)
  const generationRef = React.useRef(0)

  const refreshApplications = React.useCallback(async () => {
    const generation = ++generationRef.current
    setLoading(true)
    try {
      const result = await loadFiscalWorkspaceApplications()
      if (generation !== generationRef.current) return
      if ("error" in result) {
        setError(result.error)
        setScope(null)
        return
      }
      setApplications(result.applications)
      setScope({ orgId: result.orgId, canCreate: result.canCreate })
      setError(null)
    } catch {
      if (generation === generationRef.current) setError("Could not load applications. Try again.")
    } finally {
      if (generation === generationRef.current) setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    setApplications([])
    setScope(null)
    setApplicationData(null)
    setSheetOpen(false)
    setApplicationOpen(false)
    setStarterOpen(false)
    void refreshApplications()
    return () => { generationRef.current += 1 }
  }, [fiscalSponsorshipProjectId, organizationName, refreshApplications])

  const buildData = React.useCallback((
    application: FiscalWorkspaceApplication,
    workflowSummary: FiscalSponsorshipProjectWorkflowSummary | null,
    prefill = workspaceApplicationPrefill(application, applicationPrefill)
  ) => buildFiscalSponsorshipProjectWorkbenchData({
    project: { id: application.projectId, name: application.name, description: application.description },
    organization: {
      name: organizationName?.trim() || "Your organization",
      ownerName: prefill.applicantFullName ?? null,
    },
    applicationPrefill: prefill,
    workflowSummary,
  }), [applicationPrefill, organizationName])

  const openExisting = React.useCallback(async (application: FiscalWorkspaceApplication, phaseId?: string) => {
    if (operationRef.current) return
    operationRef.current = true
    const generation = generationRef.current
    setBusyProjectId(application.projectId)
    setError(null)
    try {
      const workflow = await loadFiscalSponsorshipProjectWorkflowSummary(application.projectId)
      if (generation !== generationRef.current) return
      if ("error" in workflow) { setError(workflow.error); return }
      setApplicationData(buildData(application, workflow))
      setSelectedPhaseId(phaseId ?? "application-intake")
      const edit = phaseId ? phaseId === "application-intake" : fiscalWorkspaceApplicationStatus(workflow.applicationStatus).edit
      setApplicationOpen(edit)
      setSheetOpen(!edit)
    } catch {
      if (generation === generationRef.current) setError("Could not open this application. Try again.")
    } finally {
      operationRef.current = false
      setBusyProjectId(null)
    }
  }, [buildData])

  const startApplication = async ({ name, description, program }: {
    name: string; description: string; program: FiscalSponsorshipProgramOption | null
  }) => {
    if (!scope || operationRef.current) return
    operationRef.current = true
    const generation = generationRef.current
    setCreating(true)
    setStartError(null)
    try {
      const result = await startFiscalWorkspaceApplication({
        orgId: scope.orgId, name, description,
        organizationName,
        prefill: buildSelectedProgramPrefill({
          basePrefill: buildWorkspaceApplicantPrefill(applicationPrefill), program,
        }),
      })
      if (generation !== generationRef.current) return
      if ("error" in result) { setStartError(result.error); return }
      setApplications((current) => [result.application, ...current])
      setApplicationData(buildData(result.application, null, result.prefill))
      setStarterOpen(false)
      setStarterVersion((version) => version + 1)
      setError(result.warning)
      setApplicationOpen(true)
      router.refresh()
    } catch {
      if (generation !== generationRef.current) return
      setStarterOpen(false)
      await refreshApplications()
      setError("Could not confirm creation. Check the applications above before starting again.")
    } finally {
      operationRef.current = false
      setCreating(false)
    }
  }

  React.useEffect(() => {
    if (!actionRequest || loading || !scope || handledActionRequestIdRef.current === actionRequest.id) return
    handledActionRequestIdRef.current = actionRequest.id
    const target = applications.find((item) => item.projectId === fiscalSponsorshipProjectId) ??
      (applications.length === 1 ? applications[0] : null)
    if (target) void openExisting(target, actionRequest.phaseId)
    else if (applications.length === 0 && scope.canCreate) setStarterOpen(true)
    else setError("Choose an application to continue.")
  }, [actionRequest, applications, fiscalSponsorshipProjectId, loading, scope, openExisting])

  const openApplication = () => {
    setSheetOpen(false)
    setApplicationOpen(true)
  }

  return (
    <>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <FiscalSponsorshipWorkspaceCardSurface
          draggable applications={applications} loading={loading} error={error}
          busyProjectId={busyProjectId} onRetry={() => void refreshApplications()}
          onStart={scope?.canCreate ? () => { setStartError(null); setStarterOpen(true) } : undefined}
          onOpenApplication={(application) => void openExisting(application)}
          onOpenProgress={(application) => void openExisting(application, "overview")}
        />
        {applicationData ? <FiscalSponsorshipWorkflowDrawer
          key={applicationData.projectId}
          data={applicationData} selectedPhaseId={selectedPhaseId}
          onClose={() => setSheetOpen(false)} onOpenApplication={openApplication}
        /> : null}
      </Sheet>
      <FiscalSponsorshipStartDialog
        key={`${scope?.orgId ?? "loading"}:${starterVersion}`}
        open={starterOpen} onOpenChange={setStarterOpen} programs={programs}
        pending={creating} error={startError} onStart={(input) => void startApplication(input)}
      />
      {applicationData ? <FiscalSponsorshipApplicationDrawer
        key={applicationData.projectId}
        data={applicationData} open={applicationOpen} onOpenChange={setApplicationOpen}
        onSaved={() => { void refreshApplications(); router.refresh() }}
      /> : null}
    </>
  )
}
