"use client"

import { useRef, useState, useTransition } from "react"
import CheckIcon from "lucide-react/dist/esm/icons/check"
import ChevronsUpDownIcon from "lucide-react/dist/esm/icons/chevrons-up-down"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
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
import { cn } from "@/lib/utils"
import type {
  MemberWorkspaceAccessibleOrganization,
  MemberWorkspaceSetActiveOrganizationResult,
} from "../../types"

function formatRole(role: MemberWorkspaceAccessibleOrganization["role"]) {
  if (role === "owner") return "Owner"
  if (role === "admin") return "Admin"
  if (role === "staff") return "Staff"
  if (role === "board") return "Board"
  return "Member"
}

function getOrganizationInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

type MemberWorkspaceOrgSwitcherProps = {
  presentation?: "sidebar" | "account-menu"
  activeOrganization: MemberWorkspaceAccessibleOrganization
  organizations: MemberWorkspaceAccessibleOrganization[]
  setActiveOrganizationAction: (
    orgId: string,
  ) => Promise<MemberWorkspaceSetActiveOrganizationResult>
}

function OrganizationList({
  activeOrganization,
  organizations,
  onSelect,
}: {
  activeOrganization: MemberWorkspaceAccessibleOrganization
  organizations: MemberWorkspaceAccessibleOrganization[]
  onSelect: (organization: MemberWorkspaceAccessibleOrganization) => void
}) {
  return (
    <Command
      key={activeOrganization.orgId}
      defaultValue={activeOrganization.orgId}
      className="rounded-2xl border border-border/60 bg-background"
    >
      <CommandInput placeholder="Search organizations" />
      <CommandList className="max-h-[18rem]">
        <CommandEmpty>No organizations found.</CommandEmpty>
        <CommandGroup
          heading="Organizations"
          className="[&_[cmdk-group-items]]:space-y-1"
        >
          {organizations.map((organization) => {
            const isActive = organization.orgId === activeOrganization.orgId
            return (
              <CommandItem
                key={organization.orgId}
                value={organization.orgId}
                keywords={[organization.name, organization.role]}
                onSelect={() => onSelect(organization)}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "gap-3 rounded-xl px-3 py-2",
                  isActive && "bg-accent text-accent-foreground",
                )}
              >
                <Avatar className="size-8 rounded-xl border border-border/70">
                  <AvatarImage alt={organization.name} src={organization.imageUrl ?? undefined} />
                  <AvatarFallback className="rounded-xl text-[10px] font-semibold">
                    {getOrganizationInitials(organization.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "truncate text-sm font-medium",
                      isActive ? "text-accent-foreground" : "text-foreground",
                    )}
                  >
                    {organization.name}
                  </p>
                  <p
                    className={cn(
                      "truncate text-xs",
                      isActive ? "text-accent-foreground/80" : "text-muted-foreground",
                    )}
                  >
                    {formatRole(organization.role)}
                  </p>
                </div>
                <CheckIcon
                  className={cn(
                    "size-4 transition-opacity",
                    isActive ? "text-accent-foreground" : "text-primary",
                    isActive ? "opacity-100" : "opacity-0",
                  )}
                  aria-hidden
                />
              </CommandItem>
            )
          })}
        </CommandGroup>
      </CommandList>
    </Command>
  )
}

export function MemberWorkspaceOrgSwitcher({
  presentation = "sidebar",
  activeOrganization,
  organizations,
  setActiveOrganizationAction,
}: MemberWorkspaceOrgSwitcherProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleSelect = (organization: MemberWorkspaceAccessibleOrganization) => {
    if (organization.orgId === activeOrganization.orgId) {
      setOpen(false)
      if (presentation === "account-menu") triggerRef.current?.focus()
      return
    }

    startTransition(async () => {
      const result = await setActiveOrganizationAction(organization.orgId)
      if ("error" in result) {
        toast.error(result.error)
        return
      }

      setOpen(false)
      window.location.reload()
    })
  }

  const trigger = (
    <Button
      ref={triggerRef}
      type="button"
      variant="ghost"
      aria-label="Switch organization"
      className="h-auto w-full justify-between gap-2 rounded-xl border border-transparent bg-transparent px-1 py-2 text-left md:py-1 has-[>svg]:px-1 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-xl group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0 group-data-[collapsible=icon]:has-[>svg]:px-0"
      disabled={isPending}
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
      <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" aria-hidden />
    </Button>
  )

  if (presentation === "account-menu") {
    return (
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>{trigger}</CollapsibleTrigger>
        <CollapsibleContent className="pt-2" inert={isPending || undefined}>
          <OrganizationList
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
            Change the active organization for Workspace, Admin, and Documents.
          </p>
        </div>
        <div className="p-3">
          <OrganizationList
            activeOrganization={activeOrganization}
            organizations={organizations}
            onSelect={handleSelect}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
