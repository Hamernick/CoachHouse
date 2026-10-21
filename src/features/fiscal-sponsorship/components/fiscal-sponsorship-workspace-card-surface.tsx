import Link from "next/link"
import ArrowUpRightIcon from "lucide-react/dist/esm/icons/arrow-up-right"
import PlusIcon from "lucide-react/dist/esm/icons/plus"

import { Button } from "@/components/ui/button"
import {
  WorkspaceNodeFrameRoot,
  WorkspaceNodeFrameHeader,
  WorkspaceNodeFrameBody,
  WorkspaceNodeFrameFooter,
} from "@/components/workspace/workspace-node-frame"
import { WORKSPACE_PARTICLE_CHROME } from "@/components/workspace/workspace-particle-chrome"
import { cn } from "@/lib/utils"
import { FISCAL_SPONSORSHIP_HANDBOOK_HREF } from "../lib/application-data"
import {
  fiscalWorkspaceApplicationStatus,
  type FiscalWorkspaceApplication,
} from "../lib/workspace-applications"
import { FiscalSponsorshipMark } from "./fiscal-sponsorship-mark"

type FiscalSponsorshipWorkspaceCardSurfaceProps = {
  className?: string
  draggable?: boolean
  applications?: FiscalWorkspaceApplication[]
  loading?: boolean
  error?: string | null
  busyProjectId?: string | null
  onRetry?: () => void
  onStart?: () => void
  onOpenApplication?: (application: FiscalWorkspaceApplication) => void
  onOpenProgress?: (application: FiscalWorkspaceApplication) => void
  openFlowHref?: string
}

export function FiscalSponsorshipWorkspaceCardSurface({
  className,
  draggable = false,
  applications = [],
  loading = false,
  error = null,
  busyProjectId = null,
  onRetry,
  onStart,
  onOpenApplication,
  onOpenProgress,
  openFlowHref,
}: FiscalSponsorshipWorkspaceCardSurfaceProps) {
  return (
    <WorkspaceNodeFrameRoot
      data-workspace-card="fiscal-sponsorship"
      data-fiscal-sponsorship-surface="workspace-card"
      className={cn(
        "border-border/60 bg-muted relative w-full max-w-[42rem] min-w-0",
        WORKSPACE_PARTICLE_CHROME.root,
        className
      )}
    >
      <WorkspaceNodeFrameHeader className={cn(
        WORKSPACE_PARTICLE_CHROME.header,
        draggable && "workspace-card-drag-handle cursor-grab touch-manipulation select-none active:cursor-grabbing"
      )}>
        <FiscalSponsorshipMark className="size-5 rounded-md text-[10px]" />
        <h3 className={WORKSPACE_PARTICLE_CHROME.title}>Fiscal Sponsorship</h3>
      </WorkspaceNodeFrameHeader>
      <WorkspaceNodeFrameBody className={cn("nodrag nopan nowheel", WORKSPACE_PARTICLE_CHROME.body)}>
        {loading ? (
          <p className="text-muted-foreground py-3 text-sm" role="status">Loading applications…</p>
        ) : applications.length ? (
          <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto" aria-label="Sponsorship applications">
            {applications.map((application) => {
              const status = fiscalWorkspaceApplicationStatus(application.status)
              return (
                <li key={application.projectId} className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    className="h-auto min-h-11 min-w-0 flex-1 justify-start rounded-xl px-2 py-2.5 text-left whitespace-normal hover:bg-muted/60"
                    onClick={() => onOpenApplication?.(application)}
                    disabled={Boolean(busyProjectId) || !onOpenApplication}
                    aria-label={`${application.name}: ${status.action}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm leading-snug font-medium break-words">{application.name}</span>
                      <span className="text-muted-foreground mt-1 block text-xs font-normal">
                        {busyProjectId === application.projectId ? "Opening…" : status.label}
                      </span>
                    </span>
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    className="size-8 shrink-0 rounded-full text-muted-foreground [@media(pointer:coarse)]:size-11"
                    onClick={() => onOpenProgress?.(application)}
                    disabled={Boolean(busyProjectId) || !onOpenProgress}
                    aria-label={`View progress for ${application.name}`}
                    title="View progress"
                  >
                    <ArrowUpRightIcon className="size-4" aria-hidden />
                  </Button>
                </li>
              )
            })}
          </ul>
        ) : !error ? (
          <p className="text-muted-foreground px-1 py-3 text-sm leading-relaxed">
            Apply for fiscal sponsorship for a new or existing activity.
          </p>
        ) : null}
        {error ? (
          <div className="space-y-2 px-1 py-2">
            <p role="alert" className="text-destructive text-xs">{error}</p>
            {onRetry ? <Button variant="ghost" size="sm" className="rounded-full" onClick={onRetry}>Try again</Button> : null}
          </div>
        ) : null}
      </WorkspaceNodeFrameBody>
      <WorkspaceNodeFrameFooter className={cn("nodrag nopan flex-wrap", WORKSPACE_PARTICLE_CHROME.footer)}>
        <Button asChild variant="ghost" size="sm" className={cn("rounded-full", WORKSPACE_PARTICLE_CHROME.action)}>
          <a href={FISCAL_SPONSORSHIP_HANDBOOK_HREF}>Handbook</a>
        </Button>
        <Button
          asChild={Boolean(openFlowHref)}
          size="sm"
          variant="secondary"
          className={cn("rounded-full", WORKSPACE_PARTICLE_CHROME.action)}
          disabled={!openFlowHref && (!onStart || loading || Boolean(busyProjectId))}
          onClick={openFlowHref ? undefined : onStart}
        >
          {openFlowHref ? <Link href={openFlowHref}>Start application</Link> : <><PlusIcon aria-hidden />Start application</>}
        </Button>
      </WorkspaceNodeFrameFooter>
    </WorkspaceNodeFrameRoot>
  )
}
