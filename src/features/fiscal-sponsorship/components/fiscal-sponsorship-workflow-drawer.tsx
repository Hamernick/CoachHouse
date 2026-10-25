"use client"

import * as React from "react"
import PanelRightOpenIcon from "lucide-react/dist/esm/icons/panel-right-open"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import type { FiscalSponsorshipProjectWorkbenchData } from "../types"
import { FiscalSponsorshipApplicationReviewNote } from "./fiscal-sponsorship-application-review-note"
import { FiscalSponsorshipMark } from "./fiscal-sponsorship-mark"
import { FiscalSponsorshipRequiredDocumentsUploadPanel } from "./fiscal-sponsorship-required-documents-upload-panel"
import {
  DocumentsAndSigning,
  RequiredDataSummary,
  SigningActions,
  type WorkflowTab,
  WorkflowPhases,
  resolveWorkflowTabForPhase,
} from "./fiscal-sponsorship-workflow-drawer-sections"
import { FiscalSponsorshipWorkflowTimeline } from "./fiscal-sponsorship-workflow-timeline"

type FiscalSponsorshipWorkflowDrawerProps = {
  data: FiscalSponsorshipProjectWorkbenchData
  onClose: () => void
  onOpenApplication: () => void
  selectedPhaseId?: string
}

export function FiscalSponsorshipWorkflowDrawer({
  data,
  onClose,
  onOpenApplication,
  selectedPhaseId,
}: FiscalSponsorshipWorkflowDrawerProps) {
  const selectedTab = resolveWorkflowTabForPhase(selectedPhaseId)
  const [activeTab, setActiveTab] = React.useState<WorkflowTab>(selectedTab)

  React.useEffect(() => {
    setActiveTab(selectedTab)
  }, [selectedTab])

  return (
    <SheetContent className="w-[min(100vw,34rem)] gap-0 p-0 sm:max-w-[34rem]">
      <SheetHeader className="border-b p-5">
        <div className="flex items-start gap-3 pr-8">
          <FiscalSponsorshipMark />
          <div className="min-w-0">
            <SheetTitle className="text-lg break-words">{data.projectName}</SheetTitle>
            <SheetDescription>{data.nextStep}</SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as WorkflowTab)}
        className="min-h-0 flex-1"
      >
        <TabsList className="bg-muted mx-4 mt-3 grid grid-cols-3 rounded-full p-1">
          <TabsTrigger
            value="work"
            className="data-[state=active]:bg-background rounded-full"
          >
            Work
          </TabsTrigger>
          <TabsTrigger
            value="docs"
            className="data-[state=active]:bg-background rounded-full"
          >
            Docs
          </TabsTrigger>
          <TabsTrigger
            value="sign"
            className="data-[state=active]:bg-background rounded-full"
          >
            Sign
          </TabsTrigger>
        </TabsList>

        <ScrollArea
          className="text-card-foreground border-border/60 bg-muted relative mx-3 mt-3 min-h-0 min-w-0 flex-1 overflow-hidden rounded-[2rem] border p-3 shadow-sm"
          viewportClassName="max-h-[calc(100svh-15rem)] max-w-full overflow-x-hidden rounded-none scroll-fade-effect-y [--mask-height:2rem] [--scroll-buffer:1.5rem] [&>div]:!block [&>div]:!w-full [&>div]:!max-w-full [&>div]:!min-w-0"
          contentClassName="min-w-0 max-w-full overflow-hidden [&>*]:min-w-0 [&>*]:max-w-full"
        >
          <TabsContent value="work" className="mt-0 flex flex-col gap-4">
            <FiscalSponsorshipApplicationReviewNote
              notes={data.workflowSummary?.reviewNotes}
              status={data.workflowSummary?.applicationStatus}
            />
            <WorkflowPhases
              data={data}
              selectedPhaseId={selectedPhaseId}
              setActiveTab={setActiveTab}
              onOpenApplication={onOpenApplication}
            />
            <FiscalSponsorshipWorkflowTimeline
              events={data.timelineEvents}
              emptyLabel="Updates from Coach House and document activity appear here."
            />
            <RequiredDataSummary data={data} />
          </TabsContent>
          <TabsContent value="docs" className="mt-0 flex flex-col gap-4">
            <FiscalSponsorshipRequiredDocumentsUploadPanel
              applicationReady={Boolean(data.workflowSummary?.applicationId)}
              canCompleteW9={data.workflowSummary?.canCompleteW9 ?? false}
              documents={data.workflowSummary?.requiredDocuments ?? []}
              legalEntityType={data.workflowSummary?.legalEntityType ?? null}
              projectId={data.projectId}
              showGrantRequestSupport={
                data.workflowSummary?.latestSignaturePacket?.status ===
                "completed"
              }
              onOpenApplication={onOpenApplication}
            />
            <DocumentsAndSigning data={data} />
          </TabsContent>
          <TabsContent value="sign" className="mt-0 flex flex-col gap-4">
            <SigningActions signingActions={data.signingActions} />
            <DocumentsAndSigning data={data} />
          </TabsContent>
        </ScrollArea>

        <SheetFooter className="border-t">
          <Button
            variant="outline"
            className="w-full rounded-full"
            onClick={onClose}
          >
            <PanelRightOpenIcon data-icon="inline-start" aria-hidden />
            Back to applications
          </Button>
        </SheetFooter>
      </Tabs>
    </SheetContent>
  )
}
