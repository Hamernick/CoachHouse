"use client"

import CheckIcon from "lucide-react/dist/esm/icons/check"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { mergeSupportSearchResults } from "@/features/organization-workspace-support"
import { useWorkspaceSupportSearch } from "@/features/organization-workspace-support/client"
import { cn } from "@/lib/utils"
import type { MemberWorkspaceAccessibleOrganization } from "../../types"
import { formatRole, getOrganizationInitials } from "./member-workspace-org-switcher-utils"

export function OrganizationList({
  canSearchSupport = false,
  activeOrganization,
  organizations,
  onSelect,
}: {
  canSearchSupport?: boolean
  activeOrganization: MemberWorkspaceAccessibleOrganization
  organizations: MemberWorkspaceAccessibleOrganization[]
  onSelect: (organization: MemberWorkspaceAccessibleOrganization) => void
}) {
  const search = useWorkspaceSupportSearch(canSearchSupport)
  const query = search.query
  const visible = mergeSupportSearchResults(organizations, search.matches, query)
  return (
    <Command
      shouldFilter={false}
      key={activeOrganization.orgId}
      defaultValue={activeOrganization.orgId}
      className="rounded-2xl border border-border/60 bg-background"
    >
      <CommandInput value={query} onValueChange={search.setQuery} placeholder={canSearchSupport ? "Search by organization, name, or email…" : "Search organizations"} />
      <CommandList className="max-h-[18rem]">
        <CommandEmpty>{search.searching ? "Searching…" : search.error ?? "No organizations found."}</CommandEmpty>
        <CommandGroup
          heading="Organizations"
          className="[&_[cmdk-group-items]]:space-y-1"
        >
          {visible.map((organization) => {
            const isActive = organization.orgId === activeOrganization.orgId
            const contact = [organization.contactName, organization.contactEmail].filter(Boolean).join(" · ")
            return (
              <CommandItem
                key={organization.orgId}
                value={organization.orgId}
                keywords={[organization.name, organization.role, organization.contactName ?? "", organization.contactEmail ?? ""]}
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
                    title={contact || undefined}
                    className={cn(
                      "truncate text-xs",
                      isActive ? "text-accent-foreground/80" : "text-muted-foreground",
                    )}
                  >
                    {contact || (organization.supportAccess ? "Coach House support" : formatRole(organization.role))}
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
      {search.active ? (
        <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
          <p className="min-w-0 text-xs text-muted-foreground" role={search.error ? "alert" : "status"}>
            {search.searching ? "Searching…" : search.error ?? `${search.total} ${search.total === 1 ? "match" : "matches"}`}
          </p>
          {search.error ? <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={search.retry}>Retry</Button> : null}
          {search.offset > 0 || search.hasMore ? <div className="flex shrink-0 gap-1">
            <Button type="button" variant="ghost" size="sm" className="min-h-11" disabled={search.searching || search.offset === 0} onClick={search.previous}>Previous</Button>
            <Button type="button" variant="ghost" size="sm" className="min-h-11" disabled={search.searching || !search.hasMore} onClick={search.next}>Next</Button>
          </div> : null}
        </div>
      ) : null}
    </Command>
  )
}

