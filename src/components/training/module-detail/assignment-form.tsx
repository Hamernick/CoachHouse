import { useWorkspaceEditorStatus } from "@/components/workspace/workspace-editor-status"
import { assignmentValuesEqual } from "./utils"
import { useMemo } from "react"
import { usePathname } from "next/navigation"

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

import type { ModuleAssignmentField, ModuleResource } from "../types"
import { AssignmentFieldsContent } from "./assignment-form/assignment-fields-content"
import { AssignmentFormSubmitRow } from "./assignment-form/assignment-form-submit-row"
import { AssignmentProgressPanel } from "./assignment-form/assignment-progress-panel"
import { AssignmentStepNavigation } from "./assignment-form/assignment-step-navigation"
import { useAssignmentFormValues } from "./assignment-form/hooks/use-assignment-form-values"
import { useAssignmentProgress } from "./assignment-form/hooks/use-assignment-progress"
import { useAssignmentSectionNavigation } from "./assignment-form/hooks/use-assignment-section-navigation"
import type { AssignmentFieldRenderContext } from "./assignment-form/types"
import { buildAssignmentSections } from "./assignment-sections"
import type { AssignmentValues } from "./utils"
import type { RoadmapSectionStatus } from "@/lib/roadmap"

type AssignmentFormProps = {
  fields: ModuleAssignmentField[]
  initialValues: AssignmentValues
  pending: boolean
  onSubmit: (
    values: AssignmentValues,
    options?: { silent?: boolean }
  ) => void | Promise<unknown>
  roadmapStatusBySectionId?: Record<string, RoadmapSectionStatus>
  mode?: "standard" | "stepper"
  activeSectionId?: string
  statusLabel?: string | null
  statusVariant?: "default" | "secondary" | "destructive" | "outline"
  helperText?: string | null
  errorMessage?: string | null
  updatedAt?: string | null
  completeOnSubmit: boolean
  statusNote?: string | null
  moduleId: string
  moduleTitle: string
  classTitle: string
  nextHref?: string | null
  currentStep?: number
  totalSteps?: number
  onStepPrevious?: () => void
  onStepNext?: () => void
  overviewResources?: ModuleResource[]
  overviewHasDeck?: boolean
  showStepNavigation?: boolean
  headerSlot?: React.ReactNode
  progressPlacement?: "sidebar" | "header"
}

export function AssignmentForm(props: AssignmentFormProps) {
  if (props.fields.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Homework</CardTitle>
          <CardDescription>
            No assignment data yet — check back soon.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return <AssignmentFormInner {...props} />
}

function AssignmentFormInner({
  fields,
  initialValues,
  pending,
  onSubmit,
  roadmapStatusBySectionId,
  mode = "standard",
  activeSectionId,
  statusLabel,
  helperText,
  errorMessage,
  statusNote,
  moduleId,
  nextHref = null,
  currentStep,
  totalSteps,
  onStepPrevious,
  onStepNext,
  overviewResources = [],
  overviewHasDeck = false,
  showStepNavigation = true,
  headerSlot,
  progressPlacement = "sidebar",
}: AssignmentFormProps) {
  const isStepper = mode === "stepper"
  const pathname = usePathname()
  const isAcceleratorShell = (pathname ?? "").startsWith("/accelerator")
  const richTextMinHeight = isAcceleratorShell ? 560 : 420
  const showStatusBadge = statusLabel && statusLabel !== "Submitted"
  const { values, autoSaving, updateValue } = useAssignmentFormValues({
    initialValues,
    moduleId,
    onSubmit,
  })
  useWorkspaceEditorStatus({
    label: "Accelerator homework",
    dirty: !assignmentValuesEqual(values, initialValues),
    pending: pending || autoSaving,
    error: Boolean(errorMessage),
  })
  const hasMeta = Boolean(
    showStatusBadge || helperText || errorMessage || statusNote || autoSaving
  )

  const { baseSections, tabSections } = useMemo(
    () => buildAssignmentSections(fields),
    [fields]
  )
  const {
    shouldUseTabs,
    useInlineTabs,
    activeSection,
    setActiveSection,
    activeSectionKey,
    tabRefs,
    indicator,
    inlineActiveIndex,
  } = useAssignmentSectionNavigation({
    tabSections,
    isStepper,
    activeSectionId,
  })
  const { fieldAnswered, overall } = useAssignmentProgress(tabSections, values)
  const showProgressPanel = !isStepper && overall.total > 1
  const activeSectionIndex = tabSections.findIndex(
    (section) => section.id === activeSectionKey
  )
  const activeSectionForNavigation =
    activeSectionIndex >= 0 ? tabSections[activeSectionIndex] : null
  const nextSectionForNavigation =
    activeSectionIndex >= 0 ? tabSections[activeSectionIndex + 1] : null
  const canGoPreviousStep =
    typeof currentStep === "number" &&
    currentStep > 1 &&
    Boolean(onStepPrevious)
  const canGoNextStep =
    typeof currentStep === "number" &&
    typeof totalSteps === "number" &&
    currentStep < totalSteps &&
    Boolean(onStepNext)

  const fieldContext = useMemo<AssignmentFieldRenderContext>(
    () => ({
      values,
      pending,
      autoSaving,
      isStepper,
      roadmapStatusBySectionId,
      isAcceleratorShell,
      richTextMinHeight,
      updateValue,
    }),
    [
      values,
      pending,
      autoSaving,
      isStepper,
      roadmapStatusBySectionId,
      isAcceleratorShell,
      richTextMinHeight,
      updateValue,
    ]
  )

  const progressPanel = (
    <AssignmentProgressPanel
      overall={overall}
      useInlineTabs={useInlineTabs}
      activeSection={activeSection}
      onActiveSectionChange={setActiveSection}
      tabSections={tabSections}
      fieldAnswered={fieldAnswered}
      tabRefs={tabRefs}
      indicator={indicator}
    />
  )

  const containerClass = isStepper
    ? "flex h-full min-h-0 flex-1 flex-col gap-6"
    : progressPlacement === "header" || !showProgressPanel
      ? "space-y-6"
      : "grid items-start gap-6 md:grid-cols-[minmax(260px,_320px)_minmax(0,_1fr)]"

  return (
    <div className={containerClass}>
      {!isStepper && progressPlacement === "header" ? (
        headerSlot || showProgressPanel ? (
          <div
            className={cn(
              "grid items-start gap-6",
              headerSlot && showProgressPanel
                ? "md:grid-cols-[minmax(240px,_360px)_minmax(0,_1fr)] xl:grid-cols-[minmax(260px,_420px)_minmax(0,_1fr)]"
                : ""
            )}
          >
            {headerSlot ? (
              <div className="w-full min-w-0 md:max-w-[320px] md:justify-self-start">
                {headerSlot}
              </div>
            ) : null}
            {showProgressPanel ? (
              <div className={`min-w-0 ${headerSlot ? "" : "md:col-span-2"}`}>
                {progressPanel}
              </div>
            ) : null}
          </div>
        ) : null
      ) : !isStepper && showProgressPanel ? (
        progressPanel
      ) : null}

      <div
        className={cn(
          "self-start",
          isStepper
            ? "flex min-h-0 flex-1 flex-col self-stretch overflow-hidden"
            : "space-y-3"
        )}
      >
        <div
          className={cn(
            isStepper &&
              "min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 pb-5"
          )}
        >
          {isStepper ? (
            <AssignmentFormSubmitRow
              isStepper
              hasMeta={hasMeta}
              helperText={helperText}
              errorMessage={errorMessage}
              statusNote={statusNote}
              autoSaving={autoSaving}
              nextHref={null}
              currentStep={currentStep}
              totalSteps={totalSteps}
              pending={pending}
              onRetry={() => onSubmit(values)}
            />
          ) : null}
          <AssignmentFieldsContent
            isStepper={isStepper}
            shouldUseTabs={shouldUseTabs}
            useInlineTabs={useInlineTabs}
            baseSections={baseSections}
            tabSections={tabSections}
            activeSection={activeSection}
            activeSectionKey={activeSectionKey}
            hasDeck={overviewHasDeck}
            moduleId={moduleId}
            onActiveSectionChange={setActiveSection}
            resources={overviewResources}
            inlineActiveIndex={inlineActiveIndex}
            fieldContext={fieldContext}
          />
        </div>

        {!isStepper ? (
          <AssignmentFormSubmitRow
            isStepper={isStepper}
            hasMeta={hasMeta}
            helperText={helperText}
            errorMessage={errorMessage}
            statusNote={statusNote}
            autoSaving={autoSaving}
            nextHref={nextHref}
            currentStep={currentStep}
            totalSteps={totalSteps}
            pending={pending}
            onRetry={() => onSubmit(values)}
          />
        ) : showStepNavigation ? (
          <AssignmentStepNavigation
            canGoPrevious={canGoPreviousStep}
            canGoNext={canGoNextStep}
            currentSection={activeSectionForNavigation}
            nextSection={nextSectionForNavigation}
            onPrevious={onStepPrevious}
            onNext={onStepNext}
          />
        ) : null}
      </div>
    </div>
  )
}

export { deriveAssignmentInitialValues } from "./assignment-form/derive-assignment-initial-values"
