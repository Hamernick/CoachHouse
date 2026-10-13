"use client"

import * as React from "react"
import Link from "next/link"
import CheckCircle2Icon from "lucide-react/dist/esm/icons/check-circle-2"
import ChevronDownIcon from "lucide-react/dist/esm/icons/chevron-down"
import CircleDashedIcon from "lucide-react/dist/esm/icons/circle-dashed"
import ExternalLinkIcon from "lucide-react/dist/esm/icons/external-link"
import FileTextIcon from "lucide-react/dist/esm/icons/file-text"
import FolderOpenIcon from "lucide-react/dist/esm/icons/folder-open"

import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

import type {
  FiscalSponsorshipProjectAssetOption,
  FiscalSponsorshipProjectWorkbenchAdminActionProps,
  FiscalSponsorshipProjectWorkbenchDocumentActionProps,
  FiscalSponsorshipProjectWorkbenchData,
  FiscalSponsorshipProjectWorkbenchItem,
  FiscalSponsorshipProjectWorkbenchPhase,
} from "../types"
import { FiscalSponsorshipMark } from "./fiscal-sponsorship-mark"
import { FiscalSponsorshipProjectWorkbenchAdminActions } from "./fiscal-sponsorship-project-workbench-admin-actions"
import { FiscalSponsorshipProjectWorkbenchDocuments } from "./fiscal-sponsorship-project-workbench-documents"
import { FiscalSponsorshipProjectWorkbenchRequiredDocuments } from "./fiscal-sponsorship-project-workbench-required-documents"

function WorkbenchItemRow({
  item,
}: {
  item: FiscalSponsorshipProjectWorkbenchItem
}) {
  const Icon = item.complete ? CheckCircle2Icon : CircleDashedIcon

  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          item.complete ? "text-emerald-600" : "text-amber-600"
        )}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="text-foreground truncate text-xs font-medium">
          {item.label}
        </p>
        <p className="text-muted-foreground mt-0.5 line-clamp-2 text-[11px] leading-snug">
          {item.description}
        </p>
      </div>
    </div>
  )
}

function WorkbenchSection({
  title,
  items,
}: {
  title: string
  items: FiscalSponsorshipProjectWorkbenchItem[]
}) {
  return (
    <section className="min-w-0">
      <p className="text-muted-foreground mb-2 text-[11px] font-medium tracking-wide uppercase">
        {title}
      </p>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <WorkbenchItemRow key={item.id} item={item} />
        ))}
      </div>
    </section>
  )
}

function WorkbenchPhaseRow({
  applicationEditor,
  expanded,
  item,
  onExpandedChange,
  onOpenApplication,
  onOpenAssets,
  phaseRef,
}: {
  applicationEditor?: React.ReactNode
  expanded: boolean
  item: FiscalSponsorshipProjectWorkbenchPhase
  onExpandedChange: (expanded: boolean) => void
  onOpenApplication?: () => void
  onOpenAssets?: () => void
  phaseRef?: React.Ref<HTMLDivElement>
}) {
  const complete = item.complete
  const canOpenApplication =
    item.actionType === "application" && Boolean(onOpenApplication)
  const canOpenAssets = item.actionType === "assets" && Boolean(onOpenAssets)
  const canOpenHref =
    (item.actionType === "document" || item.actionType === "signature") &&
    Boolean(item.href)
  const hasAction = canOpenApplication || canOpenAssets || canOpenHref
  const disabled = item.actionType === "waiting" || !hasAction
  const buttonContent = (
    <>
      {canOpenHref ? (
        <ExternalLinkIcon data-icon="inline-start" aria-hidden />
      ) : null}
      {item.actionType === "assets" ? (
        <FolderOpenIcon data-icon="inline-start" aria-hidden />
      ) : null}
      {item.actionLabel}
    </>
  )

  return (
    <Collapsible
      open={expanded}
      onOpenChange={onExpandedChange}
      className="py-1.5"
    >
      <div
        ref={phaseRef}
        id={`fiscal-sponsorship-${item.id}`}
        data-fiscal-sponsorship-workbench-phase={item.id}
        data-state={expanded ? "open" : "closed"}
        className={cn(
          "hover:bg-muted/60 min-w-0 rounded-xl py-1 transition-[background-color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          expanded && "bg-muted/55"
        )}
      >
        <div className="flex min-w-0 items-start gap-2.5 px-2">
          {complete ? (
            <CheckCircle2Icon
              data-fiscal-sponsorship-phase-status="complete"
              className="mt-3.5 size-4 shrink-0 text-emerald-600"
              aria-hidden
            />
          ) : (
            <CollapsibleTrigger asChild>
              <RadioGroupItem
                value={item.id}
                aria-label={`Show ${item.label} details`}
                data-fiscal-sponsorship-phase-status="incomplete"
                className="relative mt-3.5 cursor-pointer touch-manipulation opacity-100 after:absolute after:-inset-3.5 after:content-['']"
              />
            </CollapsibleTrigger>
          )}
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="group focus-visible:ring-ring/50 flex min-h-11 min-w-0 flex-1 cursor-pointer items-center rounded-lg px-1 text-left outline-none focus-visible:ring-2"
            >
              <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                <span className="text-foreground min-w-0 flex-1 truncate text-xs font-medium">
                  {item.label}
                </span>
                <Badge
                  variant="secondary"
                  className={cn(
                    "h-7 rounded-full border-transparent px-2.5 py-1 text-[11px] leading-none transition-[color,box-shadow,background-color]",
                    expanded && "bg-primary/10 text-primary"
                  )}
                >
                  {item.statusLabel}
                  <ChevronDownIcon
                    className="transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-data-[state=open]:rotate-180 motion-reduce:transition-none"
                    aria-hidden
                  />
                </Badge>
              </span>
            </button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent
          forceMount={applicationEditor ? true : undefined}
          className="data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1 overflow-hidden data-[state=closed]:hidden data-[state=open]:duration-200 motion-reduce:data-[state=open]:animate-none"
        >
          <div className="grid grid-cols-[1rem_minmax(0,1fr)] gap-x-2.5 px-2 pb-2">
            <span aria-hidden />
            <div className="flex min-w-0 flex-col items-start gap-2 px-1">
              <p className="text-muted-foreground text-xs leading-snug break-words">
                {item.description}
              </p>
              {applicationEditor ?? (
                <div className="flex">
                  {canOpenHref ? (
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-full px-3"
                      data-fiscal-sponsorship-phase-action={item.actionType}
                    >
                      {item.actionType === "signature" ? (
                        <Link href={item.href ?? "#"}>{buttonContent}</Link>
                      ) : (
                        <a
                          href={item.href ?? "#"}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {buttonContent}
                        </a>
                      )}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-full px-3"
                      disabled={disabled}
                      onClick={
                        canOpenApplication
                          ? onOpenApplication
                          : canOpenAssets
                            ? onOpenAssets
                            : undefined
                      }
                      data-fiscal-sponsorship-phase-action={item.actionType}
                    >
                      {buttonContent}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

function WorkbenchPhaseTimeline({
  applicationPhaseRef,
  applicationEditor,
  expandedPhaseId,
  items,
  onExpandedPhaseChange,
  onOpenApplication,
  onOpenAssets,
}: {
  applicationPhaseRef?: React.Ref<HTMLDivElement>
  applicationEditor?: React.ReactNode
  expandedPhaseId: string | null
  items: FiscalSponsorshipProjectWorkbenchPhase[]
  onExpandedPhaseChange: (phaseId: string | null) => void
  onOpenApplication?: () => void
  onOpenAssets?: () => void
}) {
  const currentPhaseId = items.find((item) => !item.complete)?.id

  return (
    <section className="min-w-0">
      <div>
        <p className="text-sm font-semibold">Fiscal sponsorship progress</p>
        <p className="text-muted-foreground mt-1 text-xs leading-snug">
          Follow the handbook flow: intake, required documents, review,
          agreement, signatures, then grant requests.
        </p>
      </div>
      <RadioGroup
        value={expandedPhaseId ?? currentPhaseId}
        onValueChange={onExpandedPhaseChange}
        aria-label="Fiscal sponsorship phase details"
        className="divide-border/70 mt-2 block divide-y divide-dashed"
      >
        {items.map((item) => (
          <WorkbenchPhaseRow
            key={item.id}
            applicationEditor={
              item.actionType === "application" ? applicationEditor : undefined
            }
            expanded={expandedPhaseId === item.id}
            item={item}
            onExpandedChange={(nextExpanded) =>
              onExpandedPhaseChange(nextExpanded ? item.id : null)
            }
            onOpenApplication={onOpenApplication}
            onOpenAssets={onOpenAssets}
            phaseRef={
              item.actionType === "application"
                ? applicationPhaseRef
                : undefined
            }
          />
        ))}
      </RadioGroup>
    </section>
  )
}

export function FiscalSponsorshipProjectWorkbench({
  applicationActionLabel = "Edit",
  canConnectDocuments = false,
  className,
  connectFiscalSponsorshipDocumentAssetAction,
  data,
  editApplicationDisabled = false,
  generateFiscalSponsorshipAgreementAction,
  onEditApplication,
  onOpenAssets,
  projectAssets = [],
  renderApplicationEditor,
  reviewFiscalSponsorshipApplicationAction,
  reviewFiscalSponsorshipDocumentAction,
  sendFiscalSponsorshipAgreementForSignatureAction,
}: FiscalSponsorshipProjectWorkbenchAdminActionProps &
  FiscalSponsorshipProjectWorkbenchDocumentActionProps & {
    applicationActionLabel?: "Edit" | "View"
    canConnectDocuments?: boolean
    className?: string
    data: FiscalSponsorshipProjectWorkbenchData
    editApplicationDisabled?: boolean
    onEditApplication?: () => void
    onOpenAssets?: () => void
    projectAssets?: FiscalSponsorshipProjectAssetOption[]
    renderApplicationEditor?: (props: {
      open: boolean
      onOpenChange: (open: boolean) => void
    }) => React.ReactNode
  }) {
  const [expandedPhaseId, setExpandedPhaseId] = React.useState<string | null>(
    null
  )
  const applicationPhaseRef = React.useRef<HTMLDivElement>(null)
  const applicationOpen = expandedPhaseId === "application-intake"
  const handleApplicationOpenChange = React.useCallback((open: boolean) => {
    setExpandedPhaseId(open ? "application-intake" : null)
  }, [])
  const handleOpenApplication = React.useCallback(() => {
    if (editApplicationDisabled) return
    setExpandedPhaseId("application-intake")
    onEditApplication?.()
    window.requestAnimationFrame(() => {
      applicationPhaseRef.current?.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      })
    })
  }, [editApplicationDisabled, onEditApplication])
  const applicationEditor =
    !editApplicationDisabled && renderApplicationEditor
      ? renderApplicationEditor({
          open: applicationOpen,
          onOpenChange: handleApplicationOpenChange,
        })
      : undefined

  return (
    <Card
      id="fiscal-sponsorship-project-workbench"
      data-fiscal-sponsorship-project-workbench={data.projectId}
      className={cn(
        "text-card-foreground border-border/60 bg-muted flex w-full max-w-[42rem] flex-col rounded-[2rem] border p-3 shadow-sm",
        className
      )}
    >
      <CardHeader className="px-4 pt-2 pb-3">
        <div className="flex min-w-0 items-start gap-3">
          <FiscalSponsorshipMark className="size-9 rounded-[1.15rem] text-base" />
          <div className="min-w-0">
            <CardTitle className="text-foreground truncate text-[15px] leading-5 font-semibold tracking-tight">
              Fiscal Sponsorship
            </CardTitle>
            <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-snug">
              {data.projectName} for {data.organizationName}
            </p>
          </div>
        </div>
        <CardAction>
          <Badge className="bg-primary/10 text-primary h-7 rounded-full border-transparent px-2.5 py-1 leading-none">
            {data.statusLabel}
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="bg-background border-border/60 rounded-[1.45rem] border p-3">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              Fiscal sponsorship workbench
            </p>
            <p className="text-muted-foreground mt-1 text-xs leading-snug">
              One place for intake, uploads, review, prepared documents,
              signatures, and grant-payment readiness.
            </p>
          </div>
          <div className="text-right">
            <p className="text-foreground text-sm font-semibold tabular-nums">
              {data.readinessPercent}%
            </p>
            <p className="text-muted-foreground text-[11px]">ready</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {data.metrics.map((metric) => (
            <div key={metric.id} className="min-w-0">
              <p className="text-muted-foreground text-[11px]">
                {metric.label}
              </p>
              <p className="text-foreground truncate text-xs font-medium">
                {metric.value}
              </p>
            </div>
          ))}
        </div>

        <Separator className="my-3 border-t border-dashed bg-transparent" />

        <WorkbenchPhaseTimeline
          applicationPhaseRef={applicationPhaseRef}
          applicationEditor={applicationEditor}
          expandedPhaseId={expandedPhaseId}
          items={data.phases}
          onExpandedPhaseChange={setExpandedPhaseId}
          onOpenApplication={
            onEditApplication || renderApplicationEditor
              ? handleOpenApplication
              : undefined
          }
          onOpenAssets={onOpenAssets}
        />

        <Separator className="my-3 border-t border-dashed bg-transparent" />

        <FiscalSponsorshipProjectWorkbenchRequiredDocuments
          assets={projectAssets}
          canCompleteW9={data.workflowSummary?.canCompleteW9 ?? false}
          canConnectDocuments={canConnectDocuments}
          connectFiscalSponsorshipDocumentAssetAction={
            connectFiscalSponsorshipDocumentAssetAction
          }
          documents={data.workflowSummary?.requiredDocuments ?? []}
          legalEntityType={data.workflowSummary?.legalEntityType ?? null}
          projectId={data.projectId}
          reviewFiscalSponsorshipDocumentAction={
            reviewFiscalSponsorshipDocumentAction
          }
        />

        <Separator className="my-3 border-t border-dashed bg-transparent" />

        <FiscalSponsorshipProjectWorkbenchDocuments
          documents={data.documentActions}
          signingActions={data.signingActions}
        />

        <Separator className="my-3 border-t border-dashed bg-transparent" />

        <WorkbenchSection title="Required data" items={data.requiredItems} />
      </CardContent>

      <CardFooter className="items-center justify-between gap-3 px-4 pt-3 pb-1">
        <div className="min-w-0">
          <p className="text-muted-foreground truncate text-[11px]">
            Applicant: {data.applicantName}
          </p>
          <p className="text-muted-foreground truncate text-[11px]">
            Next: {data.nextStep}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 rounded-full px-3"
            disabled={
              (!onEditApplication && !renderApplicationEditor) ||
              editApplicationDisabled
            }
            onClick={handleOpenApplication}
          >
            <FileTextIcon data-icon="inline-start" aria-hidden />
            {applicationActionLabel}
          </Button>
          <FiscalSponsorshipProjectWorkbenchAdminActions
            agreementDocumentId={data.latestAgreementDocumentId}
            canApproveApplication={data.canApproveApplication}
            canGenerateAgreement={data.canGenerateAgreement}
            canSendAgreement={data.canSendAgreement}
            generateFiscalSponsorshipAgreementAction={
              generateFiscalSponsorshipAgreementAction
            }
            projectId={data.projectId}
            reviewFiscalSponsorshipApplicationAction={
              reviewFiscalSponsorshipApplicationAction
            }
            reviewFiscalSponsorshipDocumentAction={
              reviewFiscalSponsorshipDocumentAction
            }
            sendFiscalSponsorshipAgreementForSignatureAction={
              sendFiscalSponsorshipAgreementForSignatureAction
            }
          />
        </div>
      </CardFooter>
    </Card>
  )
}
