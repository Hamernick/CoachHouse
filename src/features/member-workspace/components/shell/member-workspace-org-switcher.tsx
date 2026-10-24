"use client"

import { useRef, useState } from "react"
import ChevronsUpDownIcon from "lucide-react/dist/esm/icons/chevrons-up-down"
import LoaderCircleIcon from "lucide-react/dist/esm/icons/loader-circle"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useIsMobile } from "@/hooks/use-mobile"
import { toast } from "@/lib/toast"
import { switchOrganization } from "../../lib/switch-organization"
import type {
  MemberWorkspaceAccessibleOrganization,
  MemberWorkspaceSetActiveOrganizationResult,
} from "../../types"

import { OrganizationList } from "./member-workspace-org-switcher-list"
import { getOrganizationInitials } from "./member-workspace-org-switcher-utils"

type MemberWorkspaceOrgSwitcherProps = {
  presentation?: "sidebar" | "account-menu"
  canSearchSupport?: boolean
  activeOrganization: MemberWorkspaceAccessibleOrganization
  organizations: MemberWorkspaceAccessibleOrganization[]
  setActiveOrganizationAction?: (
    orgId: string,
  ) => Promise<MemberWorkspaceSetActiveOrganizationResult>
}

export function MemberWorkspaceOrgSwitcher({
  presentation = "sidebar",
  canSearchSupport = false,
  activeOrganization,
  organizations,
  setActiveOrganizationAction = switchOrganization,
}: MemberWorkspaceOrgSwitcherProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [switchingTo, setSwitchingTo] = useState<string | null>(null)
  const switching = useRef(false)
  const isPending = switchingTo !== null

  const handleSelect = async (organization: MemberWorkspaceAccessibleOrganization) => {
    if (switching.current) return
    if (organization.orgId === activeOrganization.orgId) {
      setOpen(false)
      if (presentation === "account-menu") triggerRef.current?.focus()
      return
    }

    // Existing document editors register beforeunload when work is pending.
    // Check before changing the shared selection cookie, not after a reload starts.
    if (!window.dispatchEvent(new Event("beforeunload", { cancelable: true }))) {
      toast.error("Wait for your changes to save before switching organizations.")
      return
    }
    switching.current = true
    setSwitchingTo(organization.name)
    setOpen(false)
    try {
      const result = await setActiveOrganizationAction(organization.orgId)
      if ("error" in result) {
        toast.error(result.error)
        switching.current = false
        setSwitchingTo(null)
        return
      }
      if (result.supportAccess) window.location.assign("/workspace")
      else window.location.reload()
    } catch {
      toast.error("Unable to switch organizations. Please try again.")
      switching.current = false
      setSwitchingTo(null)
    }
  }

  const trigger = (
    <Button
      ref={triggerRef}
      type="button"
      variant="ghost"
      aria-label="Switch organization"
      className="h-auto w-full justify-between gap-2 rounded-xl border border-transparent bg-transparent px-1 py-2 text-left md:py-1 has-[>svg]:px-1 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-xl group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0 group-data-[collapsible=icon]:has-[>svg]:px-0"
      disabled={isPending}
      aria-busy={isPending}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 group-data-[collapsible=icon]:min-w-auto group-data-[collapsible=icon]:gap-0">
        <Avatar className="size-9 rounded-xl border border-transparent group-data-[collapsible=icon]:size-10">
          <AvatarImage alt={activeOrganization.name} src={activeOrganization.imageUrl ?? undefined} />
          <AvatarFallback className="rounded-xl text-[11px] font-semibold">
            {getOrganizationInitials(activeOrganization.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
          <p className="line-clamp-2 whitespace-normal break-words text-sm font-semibold text-foreground" title={activeOrganization.name}>
            {activeOrganization.name}
          </p>
        </div>
      </div>
      {isPending ? <LoaderCircleIcon className="size-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden /> : <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" aria-hidden />}
    </Button>
  )

  if (presentation === "account-menu") {
    return (
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>{trigger}</CollapsibleTrigger>
        <CollapsibleContent className="pt-2" inert={isPending || undefined}>
          <OrganizationList
            canSearchSupport={canSearchSupport}
            activeOrganization={activeOrganization}
            organizations={organizations}
            onSelect={handleSelect}
          />
        </CollapsibleContent>
      </Collapsible>
    )
  }

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent className="rounded-t-[28px]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Switch organization</DrawerTitle>
            <DrawerDescription>
              Move between the organizations you can access on Coach House.
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-4">
            <OrganizationList
              canSearchSupport={canSearchSupport}
              activeOrganization={activeOrganization}
              organizations={organizations}
              onSelect={handleSelect}
            />
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-[22rem] rounded-2xl border-border/70 p-0">
        <div className="border-b border-border/60 px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Switch organization</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {canSearchSupport ? "Your organizations are listed below. Search to help another organization temporarily." : "Change the active organization for Workspace, Admin, and Documents."}
          </p>
        </div>
        <div className="p-3">
          <OrganizationList
              canSearchSupport={canSearchSupport}
            activeOrganization={activeOrganization}
            organizations={organizations}
            onSelect={handleSelect}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
