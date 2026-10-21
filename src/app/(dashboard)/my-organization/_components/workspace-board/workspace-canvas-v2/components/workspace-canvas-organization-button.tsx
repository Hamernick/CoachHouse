"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import styles from "./workspace-dock.module.css"
import type { WorkspaceDrawerTabsProps } from "./workspace-drawer-content-types"

export function WorkspaceCanvasOrganizationButton({
  organizationEditorData,
  tab,
  drawerCollapsed,
  bodyOverride,
  handleTabChange,
}: Pick<WorkspaceDrawerTabsProps, "organizationEditorData" | "tab" | "drawerCollapsed" | "bodyOverride" | "handleTabChange">) {
  const profile = organizationEditorData.initialProfile
  const name = profile.name?.trim() || "Organization"
  const initials = name.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase()
  const selected = tab === "organization" && !bodyOverride

  return (
    <Button
      {...getReactGrabOwnerProps({
        ownerId: "workspace-canvas:organization-profile",
        component: "WorkspaceCanvasOrganizationButton",
        source: "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-organization-button.tsx",
        slot: "trigger",
        primitiveImport: "@/components/ui/button",
      })}
      type="button"
      variant="ghost"
      data-workspace-organization-trigger="true"
      data-setup-guide-tab="organization"
      data-state={selected ? "active" : "inactive"}
      aria-label={`Open organization: ${name}`}
      aria-expanded={selected && !drawerCollapsed}
      title={name}
      onClick={() => handleTabChange("organization")}
      className={`${styles.organizationTrigger} nodrag nopan pointer-events-auto absolute top-2 left-2 h-[42px] w-fit justify-start gap-2 rounded-xl border border-border/70 bg-card/95 py-1 pr-2 pl-1 text-left shadow-none backdrop-blur-xl transition-[background-color,box-shadow] hover:bg-muted focus-visible:ring-2 after:absolute after:-inset-1.5 md:after:hidden motion-reduce:transition-none`}
    >
      <Avatar className="size-8 rounded-lg">
        <AvatarImage src={profile.logoUrl ?? undefined} alt="" className="object-cover" />
        <AvatarFallback className="rounded-lg bg-muted text-xs font-medium text-foreground">{initials}</AvatarFallback>
      </Avatar>
      <span className="line-clamp-2 min-w-0 whitespace-normal break-words text-sm font-medium leading-4">{name}</span>
    </Button>
  )
}
