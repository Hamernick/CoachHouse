"use client"

import { memo } from "react"
import EllipsisIcon from "lucide-react/dist/esm/icons/ellipsis"
import MonitorUpIcon from "lucide-react/dist/esm/icons/monitor-up"
import MonitorXIcon from "lucide-react/dist/esm/icons/monitor-x"
import PlusIcon from "lucide-react/dist/esm/icons/plus"
import UserMinusIcon from "lucide-react/dist/esm/icons/user-minus"
import UserPlusIcon from "lucide-react/dist/esm/icons/user-plus"

import { updatePersonCategoryAction } from "@/actions/people"
import { PersonSocialBrandIcon } from "@/components/people/person-social-brand-icon"
import type { OrgPersonWithImage } from "@/components/people/supporters-showcase"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PersonRolePicker } from "@/features/people-roles/client"
import { PERSON_CATEGORY_META } from "@/lib/people/categories"
import { personRoleLabel } from "@/lib/people/roles"
import {
  PERSON_SOCIAL_PLATFORMS,
  readPersonSocialLinks,
  resolvePersonSocialHref,
} from "@/lib/people/social-links"
import { toast } from "@/lib/toast"
import { cn } from "@/lib/utils"

import type { WorkspaceCustomPeopleSegment } from "./workspace-canvas-people-segment-types"
import type {
  WorkspacePeopleTableContentMode,
  WorkspacePeopleTableRowHeight,
} from "./workspace-canvas-overlay-people-table-sizing"

function getInitials(name?: string | null) {
  if (!name?.trim()) return "?"
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase()
}

const WorkspacePersonAvatar = memo(function WorkspacePersonAvatar({
  person,
}: {
  person: OrgPersonWithImage
}) {
  const isSupporter = person.category === "supporters"

  return (
    <Avatar
      className={cn(
        "border-border/70 bg-muted/70 size-8 border",
        isSupporter && "rounded-xl"
      )}
    >
      <AvatarImage
        src={person.displayImage ?? person.image ?? undefined}
        alt={person.name}
        className={cn(isSupporter && "object-contain p-1.5")}
      />
      <AvatarFallback
        className={cn("text-xs font-semibold", isSupporter && "rounded-xl")}
      >
        {getInitials(person.name)}
      </AvatarFallback>
    </Avatar>
  )
})

export function WorkspacePeopleDrawerPersonCell({
  person,
  contentMode = "wrap",
  rowHeight = "standard",
  onOpenPerson,
}: {
  person: OrgPersonWithImage
  contentMode?: WorkspacePeopleTableContentMode
  rowHeight?: WorkspacePeopleTableRowHeight
  onOpenPerson: (person: OrgPersonWithImage) => void
}) {
  const title = person.title || "No title"
  const wrapName = contentMode === "wrap"
  const wrapTitle = contentMode === "wrap" && rowHeight !== "compact"

  return (
    <Button
      type="button"
      variant="ghost"
      className="h-auto w-full min-w-0 justify-start gap-3 p-0 text-left font-normal hover:bg-transparent"
      onClick={() => onOpenPerson(person)}
    >
      <WorkspacePersonAvatar person={person} />
      <div className="min-w-0">
        <p
          className={cn(
            "text-foreground text-sm font-semibold",
            wrapName
              ? "line-clamp-2 break-words whitespace-normal"
              : "truncate"
          )}
          title={person.name}
        >
          {person.name}
        </p>
        <p
          className={cn(
            "text-muted-foreground text-xs",
            wrapTitle
              ? "line-clamp-2 text-pretty break-words whitespace-normal"
              : "truncate"
          )}
          title={title}
        >
          {title}
        </p>
      </div>
    </Button>
  )
}

export function WorkspacePeopleDrawerRelationshipCell({
  person,
  canEdit = false,
}: {
  person: OrgPersonWithImage
  canEdit?: boolean
}) {
  if (!canEdit) {
    return <span className="border-border bg-muted/40 text-muted-foreground inline-flex h-6 items-center gap-2 rounded-lg border px-2 text-xs font-medium">
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", person.customRole ? "bg-muted-foreground" : PERSON_CATEGORY_META[person.category].dotClass)} />
      {personRoleLabel(person)}
    </span>
  }
  return <PersonRolePicker value={person} label={`Change role for ${person.name}`}
    className="border-border bg-muted/40 text-muted-foreground h-6 w-fit min-w-0 gap-2 rounded-lg px-2 text-xs font-medium shadow-none [&>svg]:size-3"
    onChange={async (role) => {
      const result = await updatePersonCategoryAction(person.id, role.category, role.customRole ?? null)
      if ("error" in result) throw new Error(result.error)
    }} />
}

export function WorkspacePeopleDrawerReportsToCell({
  person,
  peopleById,
}: {
  person: OrgPersonWithImage
  peopleById: ReadonlyMap<string, OrgPersonWithImage>
}) {
  if (person.category !== "staff") {
    return <span className="text-muted-foreground">-</span>
  }

  const manager = person.reportsToId ? peopleById.get(person.reportsToId) : null

  return manager ? (
    <span className="text-foreground text-sm">{manager.name}</span>
  ) : (
    <span className="text-muted-foreground">-</span>
  )
}

export function WorkspacePeopleDrawerEmailCell({
  person,
}: {
  person: OrgPersonWithImage
}) {
  const email = person.email?.trim()
  if (!email) return <span className="text-muted-foreground">-</span>

  return (
    <a
      href={`mailto:${email}`}
      className="text-foreground underline-offset-4 hover:underline"
    >
      {email}
    </a>
  )
}

export function WorkspacePeopleDrawerSocialMediaCell({
  person,
  canEdit,
  onEditPerson,
}: {
  person: OrgPersonWithImage
  canEdit: boolean
  onEditPerson: (person: OrgPersonWithImage) => void
}) {
  const socialLinks = readPersonSocialLinks(person)
  const visiblePlatforms = PERSON_SOCIAL_PLATFORMS.filter((platform) =>
    resolvePersonSocialHref(platform.key, socialLinks[platform.key])
  )
  const platformLabel = visiblePlatforms
    .map((platform) => platform.label)
    .join(", ")
  const actionLabel = canEdit
    ? platformLabel
      ? `View and edit ${platformLabel} for ${person.name}`
      : `Add social media for ${person.name}`
    : `${platformLabel || "No social media"} for ${person.name}`

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-full justify-start gap-1 rounded-lg px-1"
      aria-label={actionLabel}
      title={actionLabel}
      draggable={false}
      onClick={() => onEditPerson(person)}
      onDragStart={(event) => event.stopPropagation()}
    >
      {visiblePlatforms.length > 0 ? (
        visiblePlatforms.map((platform) => (
          <PersonSocialBrandIcon
            key={platform.key}
            platform={platform.key}
            className="shrink-0"
            aria-hidden
          />
        ))
      ) : (
        <PlusIcon className="text-muted-foreground/45" aria-hidden />
      )}
    </Button>
  )
}

export function WorkspacePeopleDrawerActionCell({
  person,
  placed,
  customSegment,
  customSegmentMemberIds,
  onAddToCanvas,
  onRemoveFromCanvas,
  onAddToSegment,
  onRemoveFromSegment,
}: {
  person: OrgPersonWithImage
  placed: boolean
  customSegment: WorkspaceCustomPeopleSegment | null
  customSegmentMemberIds: ReadonlySet<string> | null
  onAddToCanvas: (personIds: string[]) => number
  onRemoveFromCanvas: (personId: string) => void
  onAddToSegment: (personId: string) => void
  onRemoveFromSegment: (personId: string) => void
}) {
  const includedInCustomSegment = Boolean(
    customSegmentMemberIds?.has(person.id)
  )

  const handleAddToCanvas = () => {
    const placedCount = onAddToCanvas([person.id])
    if (placedCount > 0) {
      toast.success("Added to canvas")
      return
    }
    toast.error("Unable to add person to canvas.")
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={`Actions for ${person.name}`}
          title={`Actions for ${person.name}`}
        >
          <EllipsisIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          {placed ? (
            <DropdownMenuItem onSelect={() => onRemoveFromCanvas(person.id)}>
              <MonitorXIcon aria-hidden />
              Remove from canvas
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={handleAddToCanvas}>
              <MonitorUpIcon aria-hidden />
              Add to canvas
            </DropdownMenuItem>
          )}
          {customSegment ? (
            includedInCustomSegment ? (
              <DropdownMenuItem onSelect={() => onRemoveFromSegment(person.id)}>
                <UserMinusIcon aria-hidden />
                Remove from segment
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => onAddToSegment(person.id)}>
                <UserPlusIcon aria-hidden />
                Add to segment
              </DropdownMenuItem>
            )
          ) : null}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { WorkspacePeopleDrawerCanvasCell } from "./workspace-people-drawer-canvas-cell"
