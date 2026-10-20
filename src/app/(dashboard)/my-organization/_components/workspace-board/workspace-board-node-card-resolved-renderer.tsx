"use client"

import ChevronDownIcon from "lucide-react/dist/esm/icons/chevron-down"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Tabs } from "@/components/ui/tabs"
import type {
  WorkspaceAcceleratorCardInput,
  WorkspaceAcceleratorCardRuntimeActions,
  WorkspaceAcceleratorCardRuntimeSnapshot,
  WorkspaceAcceleratorCardStep,
} from "@/features/workspace-accelerator-card"
import { cn } from "@/lib/utils"

import { WorkspaceBoardAcceleratorCard } from "./workspace-board-accelerator-card"
import { WorkspaceBoardCalendarCard } from "./workspace-board-calendar-card"
import { WorkspaceBoardCardFrame } from "./workspace-board-card-frame"
import { WorkspaceBoardCommunicationsCard } from "./workspace-board-communications-card"
import {
  EconomicEngineCard,
  WorkspaceBoardFiscalSponsorshipCard,
} from "./workspace-board-node-static-cards"
import { WORKSPACE_CARD_META } from "./workspace-board-copy"
import type { WorkspaceBoardNodeData } from "./workspace-board-node-types"
import { WorkspaceBoardProgramsNodeCard } from "./workspace-board-node-card-programs-renderer"
import {
  WorkspaceBoardAtlasCard,
  WorkspaceBoardBrandKitCard,
  WorkspaceBoardExecutionCard,
  WorkspaceBoardRoadmapCard,
} from "./workspace-board-node-tool-cards"
import type { WorkspaceBoardExecutionTab } from "./workspace-board-node-tool-card-execution"
import type {
  WorkspaceCardOverflowAction,
  WorkspaceCardSize,
} from "./workspace-board-types"
import {
  renderAcceleratorTitleIcon,
  resolveAcceleratorHeaderDetails,
  resolveAcceleratorHeaderMeta,
} from "./workspace-board-node-card-accelerator-support"

export function renderWorkspaceBoardResolvedCard({
  cardId,
  cardMeta,
  comingSoonTitleBadge,
  acceleratorCardHref,
  acceleratorCardInput,
  acceleratorHeaderDetails: _acceleratorHeaderDetails,
  acceleratorHeaderMeta: _acceleratorHeaderMeta,
  acceleratorRuntimeActions,
  acceleratorRuntimeSnapshot: _acceleratorRuntimeSnapshot,
  acceleratorTutorialCallout,
  acceleratorTutorialInteractionPolicy,
  canEdit,
  communications,
  communicationsMenuActions,
  contentClassName,
  data,
  effectiveCardSize,
  executionActiveTab,
  executionHeaderMeta,
  frameFullscreenToggle,
  hideHeaderSubtitle,
  isCanvasFullscreen,
  onAcceleratorRuntimeActionsChange,
  onAcceleratorRuntimeChange,
  onAcceleratorTutorialActionComplete,
  onCommunicationsMenuActionsChange,
  onExecutionTabChange,
  onProgramsCreateOpenChange,
  onRequestOpenAcceleratorStep,
  onRoadmapNavigatorCollapsedChange,
  onSizeChange,
  presentationMode,
  programsCreateOpen,
  roadmapNavigatorCollapsed,
  seed,
  shouldTrackEmbeddedAcceleratorRuntime,
}: {
  cardId: WorkspaceBoardNodeData["cardId"]
  cardMeta: (typeof WORKSPACE_CARD_META)[WorkspaceBoardNodeData["cardId"]]
  comingSoonTitleBadge?: ReactNode
  acceleratorCardHref: string
  acceleratorCardInput: WorkspaceAcceleratorCardInput
  acceleratorHeaderDetails: ReturnType<typeof resolveAcceleratorHeaderDetails>
  acceleratorHeaderMeta: ReturnType<typeof resolveAcceleratorHeaderMeta>
  acceleratorRuntimeActions: WorkspaceAcceleratorCardRuntimeActions | null
  acceleratorRuntimeSnapshot: WorkspaceAcceleratorCardRuntimeSnapshot | null
  acceleratorTutorialCallout: WorkspaceBoardNodeData["acceleratorTutorialCallout"]
  acceleratorTutorialInteractionPolicy: WorkspaceBoardNodeData["acceleratorTutorialInteractionPolicy"]
  canEdit: boolean
  communications: WorkspaceBoardNodeData["communications"]
  communicationsMenuActions: WorkspaceCardOverflowAction[]
  contentClassName: string | undefined
  data: WorkspaceBoardNodeData
  effectiveCardSize: WorkspaceCardSize
  executionActiveTab: WorkspaceBoardExecutionTab
  executionHeaderMeta?: ReactNode
  frameFullscreenToggle?: () => void
  hideHeaderSubtitle: boolean
  isCanvasFullscreen: boolean
  onAcceleratorRuntimeActionsChange?: (
    actions: WorkspaceAcceleratorCardRuntimeActions
  ) => void
  onAcceleratorRuntimeChange?: (
    snapshot: WorkspaceAcceleratorCardRuntimeSnapshot
  ) => void
  onAcceleratorTutorialActionComplete?: (
    mode?: "complete" | "complete-and-advance"
  ) => void
  onCommunicationsMenuActionsChange: (
    actions: WorkspaceCardOverflowAction[]
  ) => void
  onExecutionTabChange: (nextValue: string) => void
  onProgramsCreateOpenChange: (open: boolean) => void
  onRequestOpenAcceleratorStep: ({
    step,
    selectedLessonGroupKey,
  }: {
    step: WorkspaceAcceleratorCardStep
    selectedLessonGroupKey: string | null
  }) => boolean
  onRoadmapNavigatorCollapsedChange: (next: boolean) => void
  onSizeChange: WorkspaceBoardNodeData["onSizeChange"]
  presentationMode: boolean
  programsCreateOpen: boolean
  roadmapNavigatorCollapsed: boolean
  seed: WorkspaceBoardNodeData["seed"]
  shouldTrackEmbeddedAcceleratorRuntime: boolean
}) {
  if (cardId === "deck") {
    return (
      <Tabs
        value={executionActiveTab}
        onValueChange={onExecutionTabChange}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <WorkspaceBoardCardFrame
          cardId={cardId}
          title={cardMeta.title}
          subtitle={cardMeta.subtitle}
          titleBadge={comingSoonTitleBadge}
          tone="accelerator"
          titleIcon={renderAcceleratorTitleIcon()}
          hideTitle={false}
          hideSubtitle={hideHeaderSubtitle}
          headerMeta={executionHeaderMeta}
          size={effectiveCardSize}
          presentationMode={presentationMode}
          onSizeChange={(nextSize) => onSizeChange(cardId, nextSize)}
          fullHref={acceleratorCardHref}
          canEdit={canEdit}
          contentClassName={contentClassName}
          menuActions={undefined}
          editorHref={null}
          isCanvasFullscreen={isCanvasFullscreen}
          onToggleCanvasFullscreen={frameFullscreenToggle}
          fullscreenControlMode="overflow"
        >
          <WorkspaceBoardExecutionCard
            roadmapSections={
              data.organizationEditorData?.roadmapSections ??
              seed.roadmapSections
            }
            acceleratorInput={acceleratorCardInput}
            onRuntimeChange={
              shouldTrackEmbeddedAcceleratorRuntime
                ? onAcceleratorRuntimeChange
                : undefined
            }
            onRuntimeActionsChange={
              shouldTrackEmbeddedAcceleratorRuntime
                ? onAcceleratorRuntimeActionsChange
                : undefined
            }
            tutorialCallout={null}
            tutorialInteractionPolicy={null}
            onTutorialActionComplete={undefined}
            onRequestOpenStep={onRequestOpenAcceleratorStep}
          />
        </WorkspaceBoardCardFrame>
      </Tabs>
    )
  }

  if (cardId === "fiscal-sponsorship") {
    const fiscalActionRequest =
      data.ontologyActionRequest?.rootId === "fiscal-sponsorship" &&
      data.ontologyActionRequest.target.kind === "fiscal-phase"
        ? {
            id: data.ontologyActionRequest.id,
            phaseId: data.ontologyActionRequest.target.phaseId,
          }
        : null
    return (
      <WorkspaceBoardFiscalSponsorshipCard
        organizationId={seed.orgId}
        actionRequest={fiscalActionRequest}
        applicationPrefill={
          data.organizationEditorData?.fiscalSponsorshipApplicationPrefill ??
          null
        }
        fiscalSponsorshipProjectId={
          data.organizationEditorData?.fiscalSponsorshipProjectId ?? null
        }
        fiscalSponsorshipWorkflowSummary={
          data.organizationEditorData?.fiscalSponsorshipWorkflowSummary ?? null
        }
        organizationName={
          data.organizationEditorData?.initialProfile.name ??
          seed.organizationTitle
        }
        programs={data.organizationEditorData?.programs}
      />
    )
  }

  if (cardId === "accelerator") {
    return (
      <WorkspaceBoardAcceleratorCard
        input={acceleratorCardInput}
        runtimeActions={acceleratorRuntimeActions}
        runtimeSnapshot={_acceleratorRuntimeSnapshot}
        canEdit={canEdit}
        presentationMode={presentationMode}
        isCanvasFullscreen={isCanvasFullscreen}
        tutorialCallout={acceleratorTutorialCallout}
        tutorialInteractionPolicy={acceleratorTutorialInteractionPolicy}
        shouldTrackEmbeddedRuntime={shouldTrackEmbeddedAcceleratorRuntime}
        onRuntimeActionsChange={onAcceleratorRuntimeActionsChange}
        onRuntimeChange={onAcceleratorRuntimeChange}
        onTutorialActionComplete={onAcceleratorTutorialActionComplete}
        onRequestOpenStep={onRequestOpenAcceleratorStep}
      />
    )
  }

  if (cardId === "programs") {
    return (
      <WorkspaceBoardProgramsNodeCard
        canEdit={canEdit}
        cardMeta={cardMeta}
        contentClassName={contentClassName}
        data={data}
        effectiveCardSize={effectiveCardSize}
        frameFullscreenToggle={frameFullscreenToggle}
        hideHeaderSubtitle={hideHeaderSubtitle}
        isCanvasFullscreen={isCanvasFullscreen}
        onProgramsCreateOpenChange={onProgramsCreateOpenChange}
        presentationMode={presentationMode}
        programsCreateOpen={programsCreateOpen}
      />
    )
  }

  return (
    <WorkspaceBoardCardFrame
      cardId={cardId}
      title={cardMeta.title}
      subtitle={cardMeta.subtitle}
      titleBadge={comingSoonTitleBadge}
      tone="default"
      hideSubtitle={hideHeaderSubtitle}
      headerDetails={undefined}
      headerMeta={undefined}
      headerAction={
        cardId === "roadmap" ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-md"
            aria-label={
              roadmapNavigatorCollapsed
                ? "Expand strategic roadmap"
                : "Collapse strategic roadmap"
            }
            aria-controls="roadmap-section-picker-trigger"
            aria-expanded={!roadmapNavigatorCollapsed}
            onClick={() =>
              onRoadmapNavigatorCollapsedChange(!roadmapNavigatorCollapsed)
            }
          >
            <ChevronDownIcon
              className={cn(
                "text-muted-foreground h-3.5 w-3.5 transition-transform",
                roadmapNavigatorCollapsed && "-rotate-90"
              )}
              aria-hidden
            />
          </Button>
        ) : undefined
      }
      size={effectiveCardSize}
      presentationMode={presentationMode}
      onSizeChange={(nextSize) =>
        onSizeChange(
          cardId,
          cardId === "communications" && nextSize === "sm" ? "md" : nextSize
        )
      }
      fullHref={cardMeta.fullHref}
      canEdit={canEdit}
      contentClassName={contentClassName}
      menuActions={
        cardId === "communications" ? communicationsMenuActions : undefined
      }
      editorHref={null}
      isCanvasFullscreen={isCanvasFullscreen}
      onToggleCanvasFullscreen={frameFullscreenToggle}
      fullscreenControlMode="overflow"
    >
      {cardId === "brand-kit" ? (
        <WorkspaceBoardBrandKitCard
          profile={seed.initialProfile}
          canEdit={canEdit}
          presentationMode={presentationMode}
        />
      ) : null}
      {cardId === "economic-engine" ? (
        <EconomicEngineCard
          size={effectiveCardSize}
          seed={seed}
          presentationMode={presentationMode}
        />
      ) : null}
      {cardId === "calendar" ? (
        <WorkspaceBoardCalendarCard
          actionRequest={data.ontologyActionRequest ?? null}
          calendar={seed.calendar}
          canEdit={canEdit}
          formationStatus={seed.initialProfile.formationStatus ?? null}
          cardSize={effectiveCardSize}
          isCanvasFullscreen={isCanvasFullscreen}
          presentationMode={presentationMode}
        />
      ) : null}
      {cardId === "communications" ? (
        <WorkspaceBoardCommunicationsCard
          canEdit={canEdit}
          presentationMode={presentationMode}
          cardSize={effectiveCardSize}
          isCanvasFullscreen={isCanvasFullscreen}
          communications={communications}
          activityFeed={seed.activityFeed}
          profile={seed.initialProfile}
          onChange={data.onCommunicationsChange}
          onMenuActionsChange={onCommunicationsMenuActionsChange}
        />
      ) : null}
      {cardId === "roadmap" ? (
        <WorkspaceBoardRoadmapCard
          collapsed={roadmapNavigatorCollapsed}
          sections={
            data.organizationEditorData?.roadmapSections ?? seed.roadmapSections
          }
        />
      ) : null}
      {cardId === "atlas" ? (
        <WorkspaceBoardAtlasCard
          size={effectiveCardSize}
          presentationMode={presentationMode}
          seed={seed}
          profile={
            data.organizationEditorData?.initialProfile ?? seed.initialProfile
          }
          tutorialStepId={data.tutorialStepId ?? null}
        />
      ) : null}
    </WorkspaceBoardCardFrame>
  )
}
