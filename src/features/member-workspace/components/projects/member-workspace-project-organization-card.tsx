"use client"

import Link from "next/link"
import CheckCircle2Icon from "lucide-react/dist/esm/icons/check-circle-2"
import ChevronDownIcon from "lucide-react/dist/esm/icons/chevron-down"
import CircleDashedIcon from "lucide-react/dist/esm/icons/circle-dashed"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { Badge } from "@/features/platform-admin-dashboard"
import type {
  MemberWorkspaceAdminOrganizationSetupItem,
  MemberWorkspaceAdminOrganizationSummary,
} from "../../types"

function toTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function organizationStatusLabel(
  status: MemberWorkspaceAdminOrganizationSummary["organizationStatus"]
) {
  if (status === "approved") return "Approved"
  if (status === "pending") return "Pending"
  return "N/A"
}

function resolveExternalHref(value: unknown) {
  const href = toTrimmedString(value)
  if (!href) return null
  if (href.startsWith("/")) return href
  if (/^https?:\/\//i.test(href)) return href
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(href)) {
    return `https://${href}`
  }
  return null
}

export function resolveMemberWorkspaceOrganizationHref(
  organization: MemberWorkspaceAdminOrganizationSummary
) {
  const website =
    resolveExternalHref(organization.profile.website) ||
    resolveExternalHref(organization.profile.publicUrl) ||
    resolveExternalHref(organization.profile.public_url)

  if (website) return website

  const publicSlug = toTrimmedString(organization.publicSlug)
  return publicSlug ? `/${encodeURIComponent(publicSlug)}` : null
}

export function partitionMemberWorkspaceOrganizationSetupItems(
  items: MemberWorkspaceAdminOrganizationSetupItem[]
) {
  return {
    completedItems: items.filter((item) => item.complete),
    incompleteItems: items.filter((item) => !item.complete),
  }
}

function OrganizationSetupItemList({
  complete,
  items,
  title,
}: {
  complete: boolean
  items: MemberWorkspaceAdminOrganizationSetupItem[]
  title: string
}) {
  const Icon = complete ? CheckCircle2Icon : CircleDashedIcon

  if (items.length === 0) return null

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-foreground text-xs font-medium">{title}</p>
        <Badge variant="secondary" className="tabular-nums">
          {items.length}
        </Badge>
      </div>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item.id} className="flex min-w-0 items-start gap-2">
            <Icon
              className="text-muted-foreground mt-0.5 size-3.5 shrink-0"
              aria-hidden
            />
            <span className="text-muted-foreground min-w-0 text-xs leading-4 break-words">
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function UserCompletenessMemberRows({
  members,
}: {
  members: MemberWorkspaceAdminOrganizationSummary["members"]
}) {
  return members.map((member) => {

    const missingFields = member.profileMissingFields ?? []

    return (
      <HoverCard key={member.userId} openDelay={300} closeDelay={150}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            aria-label={`Preview completeness for ${member.name}`}

            className="bg-muted/35 hover:bg-muted/60 focus-visible:ring-ring/50 flex min-h-11 w-full cursor-pointer flex-col gap-1 rounded-md px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-2 motion-reduce:transition-none"
          >
            <span className="flex w-full items-center justify-between gap-3 text-xs">
              <span className="text-foreground min-w-0 truncate">
                {member.name}
              </span>
              <span className="text-foreground shrink-0 font-medium tabular-nums">
                {member.profileCompletenessPercent}%
              </span>
            </span>
            {missingFields.length ? (
              <span className="text-muted-foreground text-[11px] leading-4 break-words">
                Missing {missingFields.join(", ")}
              </span>
            ) : (
              <span className="text-muted-foreground text-[11px]">
                Profile complete
              </span>
            )}
          </button>
        </HoverCardTrigger>
        <HoverCardContent
          align="start"
          side="left"
          className="w-72 max-w-[calc(100vw-2rem)] p-3"

        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-foreground min-w-0 truncate text-sm font-semibold">
              {member.name}
            </p>
            <Badge variant="outline" className="shrink-0 tabular-nums">
              {member.profileCompletenessPercent}%
            </Badge>
          </div>
          {missingFields.length ? (
            <div className="mt-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <CircleDashedIcon
                  className="text-muted-foreground size-3.5 shrink-0"
                  aria-hidden
                />
                <p className="text-foreground text-xs font-medium">
                  Needs attention
                </p>
              </div>
              <ul className="flex flex-col gap-1 pl-5">
                {missingFields.map((field) => (
                  <li
                    key={field}
                    className="text-muted-foreground text-xs leading-4 break-words"
                  >
                    {field}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2">
              <CheckCircle2Icon
                className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                aria-hidden
              />
              <p className="text-muted-foreground text-xs">Profile complete</p>
            </div>
          )}
        </HoverCardContent>
      </HoverCard>
    )
  })
}

export function MemberWorkspaceProjectOrganizationCard({
  organization,
}: {
  organization: MemberWorkspaceAdminOrganizationSummary
}) {
  const contact =
    organization.members.find((member) => member.isOwner) ??
    organization.members[0] ??
    null
  const href = resolveMemberWorkspaceOrganizationHref(organization)
  const membersWithCompleteness = organization.members.filter(
    (member) => typeof member.profileCompletenessPercent === "number"
  )
  const { completedItems, incompleteItems } =
    partitionMemberWorkspaceOrganizationSetupItems(organization.setupItems)

  const setupDescriptionId = `organization-setup-description-${organization.orgId}`

  const setupDescription = organization.setupItems.length
    ? [
        incompleteItems.length
          ? `Incomplete: ${incompleteItems.map((item) => item.label).join(", ")}.`
          : "No incomplete setup items.",
        completedItems.length
          ? `Complete: ${completedItems.map((item) => item.label).join(", ")}.`
          : "No completed setup items.",
      ].join(" ")
    : "Setup item details are unavailable."

  return (
    <div className="border-border bg-card/80 space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs font-medium">
          Organization
        </p>
        <Badge
          variant="outline"
          className="rounded-full px-2 py-0.5 text-[11px] font-medium capitalize"
        >
          {organizationStatusLabel(organization.organizationStatus)}
        </Badge>
      </div>
      <div className="space-y-1">
        {href ? (
          <Link
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-foreground text-sm font-medium underline-offset-2 hover:underline"
          >
            {organization.name}
          </Link>
        ) : (
          <p className="text-foreground text-sm font-medium">
            {organization.name}
          </p>
        )}
        {contact ? (
          <p className="text-muted-foreground text-xs">
            {contact.name}
            {contact.email ? ` · ${contact.email}` : ""}
          </p>
        ) : null}
      </div>

      <div className="border-border/70 border-t pt-3">
        <HoverCard openDelay={300} closeDelay={150}>
          <HoverCardTrigger asChild>
            <button
              type="button"
              aria-describedby={setupDescriptionId}

              className="focus-visible:ring-ring flex w-full cursor-pointer flex-col gap-2 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              <span className="flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">
                  Organization setup
                </span>
                <span className="text-foreground font-medium tabular-nums">
                  {organization.setupProgress}%
                </span>
              </span>
              <span
                className="bg-muted h-1.5 overflow-hidden rounded-full"
                role="progressbar"
                aria-label="Organization setup completeness"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={organization.setupProgress}
              >
                <span
                  className="bg-primary block h-full rounded-full"
                  style={{ width: `${organization.setupProgress}%` }}
                />
              </span>
              <span className="text-muted-foreground text-[11px]">
                {organization.setupCompletedCount} of{" "}
                {organization.setupTotalCount} setup items complete
              </span>
            </button>
          </HoverCardTrigger>
          <HoverCardContent
            align="start"
            side="left"
            className="w-80 max-w-[calc(100vw-2rem)] p-0"

          >
            <div className="border-border flex flex-col gap-1 border-b p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-foreground text-sm font-semibold">
                  Organization setup
                </p>
                <Badge variant="outline" className="tabular-nums">
                  {organization.setupProgress}%
                </Badge>
              </div>
              <p className="text-muted-foreground text-xs">
                {organization.setupCompletedCount} of{" "}
                {organization.setupTotalCount} items complete
              </p>
            </div>
            {organization.setupItems.length ? (
              <div className="flex max-h-72 flex-col gap-4 overflow-y-auto overscroll-contain p-3">
                <OrganizationSetupItemList
                  complete={false}
                  items={incompleteItems}
                  title="Needs attention"
                />
                {incompleteItems.length === 0 ? (
                  <p className="text-muted-foreground text-xs">
                    All setup items are complete.
                  </p>
                ) : null}
                <OrganizationSetupItemList
                  complete
                  items={completedItems}
                  title="Complete"
                />
              </div>
            ) : (
              <p className="text-muted-foreground p-3 text-xs">
                Setup item details are unavailable.
              </p>
            )}
          </HoverCardContent>
        </HoverCard>
        <span id={setupDescriptionId} className="sr-only">
          {setupDescription}
        </span>
      </div>

      {membersWithCompleteness.length > 0 ? (
        <Collapsible className="border-border/70 border-t pt-3">
          <CollapsibleTrigger asChild>
            <button
              type="button"

              className="group hover:bg-muted/50 focus-visible:ring-ring/50 flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-md px-2 text-left transition-[background-color,color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] outline-none focus-visible:ring-2 motion-reduce:transition-none"
            >
              <span className="text-muted-foreground text-xs font-medium">
                User completeness
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <Badge variant="outline" className="tabular-nums">
                  {membersWithCompleteness.length}{" "}
                  {membersWithCompleteness.length === 1 ? "user" : "users"}
                </Badge>
                <ChevronDownIcon
                  className="text-muted-foreground size-4 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-data-[state=open]:rotate-180 motion-reduce:transition-none"
                  aria-hidden
                />
              </span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent
            forceMount
            className="data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1 overflow-hidden data-[state=closed]:hidden data-[state=open]:duration-200 motion-reduce:data-[state=open]:animate-none"

          >
            <div className="flex flex-col gap-2 px-2 pt-1 pb-1">
              <UserCompletenessMemberRows
                members={membersWithCompleteness}

              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  )
}
