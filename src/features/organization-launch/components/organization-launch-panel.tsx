"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import ArrowUpRightIcon from "lucide-react/dist/esm/icons/arrow-up-right"
import CheckIcon from "lucide-react/dist/esm/icons/check"
import ChevronRightIcon from "lucide-react/dist/esm/icons/chevron-right"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { LaunchProfileFields } from "./launch-profile-fields"
import { LaunchProgramFields } from "./launch-program-fields"
import { LaunchPublicationFields } from "./launch-publication-fields"
import { Button } from "@/components/ui/button"
import { PaywallOverlay } from "@/components/paywall/paywall-overlay"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { getWorkspaceDrawerPath } from "@/lib/workspace/routes"
import { OrganizationLaunchMap } from "./organization-launch-map"
import { useOrganizationLaunchController } from "../hooks/use-organization-launch-controller"
import { scrollLaunchIntoView } from "../lib/scroll-launch-into-view"
import { resolveLaunchGlobeLocation } from "../lib/globe-location"
import type { OrganizationLaunchInput, OrganizationLaunchStep } from "../types"

const STEP_LABELS: Record<OrganizationLaunchStep["id"], string> = {
  identity: "Name your organization",
  story: "Describe your work",
  location: "Add a location",
  program: "Build a program",
  publish: "Publish your profile",
}

export function OrganizationLaunchPanel({ input, hasAccess }: {
  input: OrganizationLaunchInput
  hasAccess: boolean
}) {
  const canEdit = hasAccess && input.canEdit
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const upgradeTriggerRef = useRef<HTMLButtonElement>(null)
  const launch = useOrganizationLaunchController(input)
  const { profile } = launch
  const completedCount = launch.steps.filter((step) => step.complete).length
  const profileHref = getWorkspaceDrawerPath({ tab: "organization" })
  const [openStep, setOpenStep] = useState("")
  const openLocation = () => {
    setOpenStep("location")
    requestAnimationFrame(() => {
      const form = cardRef.current?.querySelector<HTMLElement>('[data-launch-step="location"]')
      form?.querySelector<HTMLElement>('input, [role="combobox"]')?.focus({ preventScroll: true })
      if (form) scrollLaunchIntoView(form)
    })
  }
  const cardRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const hasEdits = () => Boolean(cardRef.current?.querySelector('[data-launch-dirty="true"]'))
    const warn = (event: BeforeUnloadEvent) => {
      if (hasEdits()) { event.preventDefault(); event.returnValue = "" }
    }
    const guardLink = (event: MouseEvent) => {
      if (event.defaultPrevented || !hasEdits()) return
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null
      if (!anchor || anchor.getAttribute("target") === "_blank") return
      if (!window.confirm("Leave without saving your changes?")) { event.preventDefault(); event.stopPropagation() }
    }
    window.addEventListener("beforeunload", warn)
    document.addEventListener("click", guardLink, true)
    return () => { window.removeEventListener("beforeunload", warn); document.removeEventListener("click", guardLink, true) }
  }, [])
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("focus") === "organization-launch") {
      const frame = requestAnimationFrame(() => {
        if (cardRef.current) scrollLaunchIntoView(cardRef.current)
      })
      return () => cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <>
    <Card
      ref={cardRef}
      data-setup-guide-target="launch"
      style={{ boxShadow: "none" }}
      className="w-full min-w-0 shrink-0 gap-0 overflow-hidden rounded-[22px] border-border/70 py-0 shadow-none"

    >
      <CardHeader className="flex flex-col gap-3 px-5 pt-5 pb-2.5">
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <CardTitle className="whitespace-nowrap text-base font-semibold tracking-tight">
              Build your nfp
            </CardTitle>
          </div>
          <span aria-label={`Profile visibility: ${profile.isPublic ? "Public" : "Private"}`} className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs">
            <span aria-hidden="true" className={cn("size-1.5 rounded-full", profile.isPublic ? "bg-emerald-500" : "bg-muted-foreground/50")} />
            {profile.isPublic ? "Public" : "Private"}
          </span>
        </div>
      </CardHeader>
      <CardContent inert={!hasAccess} className="px-3 pb-3">
        <OrganizationLaunchMap useViewerLocation={hasAccess && profile.locationType === "online"} location={resolveLaunchGlobeLocation(profile)} locationLabel={launch.locationLabel} onAddLocation={canEdit ? openLocation : undefined} />
        <Accordion type="single" collapsible value={openStep} onValueChange={setOpenStep} className="flex flex-col gap-0.5">
          {launch.steps.map((step) => {
            const isNext = !profile.isPublic && step.id === launch.next.id
            const row = (
              <>
                <span aria-hidden="true" className={cn(
                  "flex size-[18px] shrink-0 items-center justify-center rounded-full",
                  step.complete ? "bg-emerald-600 text-white dark:bg-emerald-500" : "border-2 border-muted-foreground/30",
                  isNext && "border-r-emerald-500"
                )}>
                  {step.complete ? <CheckIcon className="size-3" strokeWidth={3} /> : null}
                </span>
                <span className="min-w-0 flex-1 text-sm leading-5">
                  {step.id === "location" && profile.locationType === "online" ? "Add an online destination" : STEP_LABELS[step.id]}
                </span>
                {step.complete ? (
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] leading-4 text-emerald-700 dark:text-emerald-400">{step.id === "publish" ? "Published" : "Done"}</span>
                ) : step.optional ? (
                  <span className="text-muted-foreground text-[11px]">Optional</span>
                ) : <span aria-hidden="true" className="text-muted-foreground text-xs">{isNext ? "Next" : "…"}</span>}
                <span className="sr-only">{step.complete ? "Complete" : "Not complete"}. {step.detail}</span>
              </>
            )
            const className = cn("flex min-h-11 w-full items-center gap-3 rounded-xl px-2.5 py-2 sm:min-h-10", isNext && "bg-muted/65")
            return canEdit ? <AccordionItem key={step.id} value={step.id} className="border-0" data-launch-step={step.id}>
              <AccordionTrigger className={cn(className, "font-normal transition-colors hover:bg-accent hover:text-accent-foreground hover:no-underline")}>{row}</AccordionTrigger>
              <AccordionContent forceMount hidden={openStep !== step.id} className="px-2.5 pt-2 pb-4">
                {step.id === "publish" ? (openStep === "publish" ? <LaunchPublicationFields /> : null)
                  : step.id === "program" ? <LaunchProgramFields programs={input.programs} />
                  : <LaunchProfileFields step={step.id} input={profile} />}
              </AccordionContent>
            </AccordionItem> : <div key={step.id} className={className}>{row}</div>
          })}
        </Accordion>
        <p className="sr-only">Optional steps are not required for publishing.</p>
        {hasAccess && !canEdit ? <p className="text-muted-foreground px-2.5 pt-2 text-xs">An organization editor can update and publish this profile.</p> : null}
      </CardContent>
      <CardFooter className="text-muted-foreground flex min-h-11 items-center justify-between gap-2 border-t border-border/60 px-5 py-3 text-[11px] tabular-nums [.border-t]:pt-3">
        <span>{completedCount} of {launch.steps.length} steps complete</span>
        {!hasAccess ? (
          <Button ref={upgradeTriggerRef} variant="ghost" size="sm" className="-mr-2 gap-1 px-2 text-xs" aria-haspopup="dialog" onClick={() => setUpgradeOpen(true)}>Upgrade to edit<ChevronRightIcon className="size-3.5" aria-hidden="true" /></Button>
        ) : launch.publicHref ? (
          <Button asChild variant="ghost" size="sm" className="-mr-2 gap-1 px-2 text-xs"><Link href={launch.publicHref}>View public profile<ArrowUpRightIcon className="size-3.5" aria-hidden="true" /></Link></Button>
        ) : canEdit ? (
          <Button variant="ghost" size="sm" className="-mr-2 gap-1 px-2 text-xs" onClick={() => setOpenStep(launch.next.id)}>{launch.next.id === "publish" ? "Review profile" : "Continue setup"}<ChevronRightIcon className="size-3.5" aria-hidden="true" /></Button>
        ) : <Link href={profileHref} className="focus-ring rounded-sm py-1 text-xs hover:underline">View profile draft</Link>}
      </CardFooter>
    </Card>
    {!hasAccess ? <PaywallOverlay open={upgradeOpen} onOpenChange={setUpgradeOpen} restoreFocus={() => upgradeTriggerRef.current?.focus({ preventScroll: true })} /> : null}
    </>
  )
}
