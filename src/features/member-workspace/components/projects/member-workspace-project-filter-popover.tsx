"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ChartBar,
  Funnel,
  HandHeart,
  Spinner,
  Tag,
  User,
} from "@phosphor-icons/react/dist/ssr"

import type { PlatformAdminDashboardLabProject } from "@/features/platform-admin-dashboard"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import type { OrganizationCoachOption } from "@/features/organization-coach-assignments"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { MemberWorkspaceProjectFilterCounts as FilterCounts } from "./member-workspace-project-filters"
import type { MemberWorkspaceProjectFilterChip as FilterChip } from "./member-workspace-project-view-options"
import {
  MEMBER_WORKSPACE_FISCAL_SPONSORSHIP_STATUS_OPTIONS,
  MEMBER_WORKSPACE_ORGANIZATION_STATUS_OPTIONS,
  normalizeMemberWorkspaceOrganizationStatusFilterValue,
} from "./member-workspace-project-status"

type FilterTemp = {
  status: Set<string>
  fiscalSponsorship: Set<string>
  priority: Set<string>
  tags: Set<string>
  members: Set<string>
}

type MemberWorkspaceProjectFilterPopoverProps = {
  coachOptions?: OrganizationCoachOption[]
  coachFilter?: string
  onCoachFilterChange?: (value: string) => void
  projects: PlatformAdminDashboardLabProject[]
  initialChips?: FilterChip[]
  onApply: (chips: FilterChip[]) => void
  onClear: () => void
  counts?: FilterCounts
}

function CoachFilter({ coachOptions = [], coachFilter = "all", onCoachFilterChange }: Pick<MemberWorkspaceProjectFilterPopoverProps, "coachOptions" | "coachFilter" | "onCoachFilterChange">) {
  return (
    <>
        {onCoachFilterChange && coachOptions.length ? (
          <div className="border-border/40 flex items-center gap-3 border-b px-4 py-3">
            <span className="text-muted-foreground text-sm">Coach</span>
            <Select value={coachFilter} onValueChange={onCoachFilterChange}>
              <SelectTrigger className="h-11 w-full min-w-0 sm:h-8 sm:w-56" aria-label="Filter organizations by coach">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All organizations</SelectItem>
                <SelectItem value="unassigned">Unassigned organizations</SelectItem>
                {coachOptions.map((coach) => <SelectItem key={coach.id} value={coach.id}>{coach.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ) : null}
    </>
  )
}

const FILTER_CATEGORIES = [
  { id: "status", label: "Organization status", icon: Spinner },
  {
    id: "fiscalSponsorship",
    label: "Fiscal Sponsorship",
    icon: HandHeart,
  },
  { id: "priority", label: "Priority", icon: ChartBar },
  { id: "tags", label: "Tags", icon: Tag },
  { id: "members", label: "Members", icon: User },
] as const

function toggleSet(current: Set<string>, value: string) {
  const next = new Set(current)
  if (next.has(value)) {
    next.delete(value)
  } else {
    next.add(value)
  }
  return next
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function MemberWorkspaceProjectFilterPopover({
  projects,
  coachOptions = [],
  coachFilter = "all",
  onCoachFilterChange,
  initialChips,
  onApply,
  onClear,
  counts,
}: MemberWorkspaceProjectFilterPopoverProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [tagSearch, setTagSearch] = useState("")
  const [active, setActive] = useState<
    "status" | "fiscalSponsorship" | "priority" | "tags" | "members"
  >("status")
  const [temp, setTemp] = useState<FilterTemp>({
    status: new Set<string>(),
    fiscalSponsorship: new Set<string>(),
    priority: new Set<string>(),
    tags: new Set<string>(),
    members: new Set<string>(),
  })

  const memberOptions = useMemo(() => {
    const values = new Map<string, { id: string; label: string }>()
    for (const project of projects) {
      if (project.members.length === 0) {
        values.set("no-member", { id: "No member", label: "No member" })
      }
      for (const member of project.members) {
        if (!values.has(member.toLowerCase())) {
          values.set(member.toLowerCase(), { id: member, label: member })
        }
      }
    }
    return Array.from(values.values()).sort((left, right) =>
      left.label.localeCompare(right.label)
    )
  }, [projects])

  const tagOptions = useMemo(() => {
    const values = new Set<string>()
    for (const project of projects) {
      for (const tag of project.tags) {
        values.add(tag.toLowerCase())
      }
    }
    return Array.from(values).sort((left, right) => left.localeCompare(right))
  }, [projects])

  useEffect(() => {
    if (!open) return

    const next: FilterTemp = {
      status: new Set<string>(),
      fiscalSponsorship: new Set<string>(),
      priority: new Set<string>(),
      tags: new Set<string>(),
      members: new Set<string>(),
    }

    for (const chip of initialChips ?? []) {
      const key = chip.key.toLowerCase()
      if (key === "status") {
        const status = normalizeMemberWorkspaceOrganizationStatusFilterValue(
          chip.value
        )
        if (status) next.status.add(status)
      }
      if (key === "fiscal sponsorship") {
        next.fiscalSponsorship.add(
          chip.value.toLowerCase().replaceAll(" ", "_")
        )
      }
      if (key === "priority") next.priority.add(chip.value.toLowerCase())
      if (key === "tag" || key === "tags")
        next.tags.add(chip.value.toLowerCase())
      if (key === "member" || key === "members" || key === "pic")
        next.members.add(chip.value)
    }

    setTemp(next)
  }, [initialChips, open])

  const filteredCategories = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return FILTER_CATEGORIES
    return FILTER_CATEGORIES.filter((category) =>
      category.label.toLowerCase().includes(normalizedQuery)
    )
  }, [query])

  const handleApply = () => {
    const chips: FilterChip[] = (initialChips ?? []).filter(
      (chip) => chip.key.toLowerCase() === "search"
    )
    temp.status.forEach((value) =>
      chips.push({ key: "Status", value: capitalize(value) })
    )
    temp.fiscalSponsorship.forEach((value) =>
      chips.push({
        key: "Fiscal Sponsorship",
        value: value.split("_").map(capitalize).join(" "),
      })
    )
    temp.priority.forEach((value) =>
      chips.push({ key: "Priority", value: capitalize(value) })
    )
    temp.tags.forEach((value) => chips.push({ key: "Tag", value }))
    temp.members.forEach((value) => chips.push({ key: "Member", value }))
    onApply(chips)
    setOpen(false)
  }

  const handleClear = () => {
    setTemp({
      status: new Set<string>(),
      fiscalSponsorship: new Set<string>(),
      priority: new Set<string>(),
      tags: new Set<string>(),
      members: new Set<string>(),
    })
    onClear()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-border/60 h-11 gap-2 sm:h-8 rounded-lg bg-transparent px-3"
        >
          <Funnel className="h-4 w-4" />
          Filter
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[calc(100vw-2rem)] max-w-[720px] rounded-xl p-0"
      >
        <CoachFilter coachOptions={coachOptions} coachFilter={coachFilter} onCoachFilterChange={onCoachFilterChange} />
        <div className="grid grid-cols-1 sm:grid-cols-[260px_minmax(0,1fr)]">
          <div className="border-border/40 border-r p-3">
            <div className="px-1 pb-2">
              <Input
                aria-label="Search filter categories"
                placeholder="Search filters…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              {filteredCategories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={cn(
                    "hover:bg-accent flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm",
                    active === category.id && "bg-accent"
                  )}
                  onClick={() => setActive(category.id)}
                >
                  <category.icon className="h-4 w-4" />
                  <span className="flex-1 text-left">{category.label}</span>
                  {counts?.[category.id] ? (
                    <span className="text-muted-foreground text-xs">
                      {Object.values(counts[category.id] ?? {}).reduce(
                        (sum, value) =>
                          sum + (typeof value === "number" ? value : 0),
                        0
                      )}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3">
            {active === "priority" ? (
              <div className="grid grid-cols-2 gap-2">
                {["urgent", "high", "medium", "low"].map((priority) => (
                  <label
                    key={priority}
                    className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded-lg border p-2"
                  >
                    <Checkbox
                      checked={temp.priority.has(priority)}
                      onCheckedChange={() =>
                        setTemp((current) => ({
                          ...current,
                          priority: toggleSet(current.priority, priority),
                        }))
                      }
                    />
                    <span className="flex-1 text-sm">
                      {capitalize(priority)}
                    </span>
                    {counts?.priority?.[priority] != null ? (
                      <span className="text-muted-foreground text-xs">
                        {counts.priority[priority]}
                      </span>
                    ) : null}
                  </label>
                ))}
              </div>
            ) : null}

            {active === "status" ? (
              <div className="grid grid-cols-2 gap-2">
                {MEMBER_WORKSPACE_ORGANIZATION_STATUS_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded-lg border p-2"
                  >
                    <Checkbox
                      checked={temp.status.has(option.value)}
                      onCheckedChange={() =>
                        setTemp((current) => ({
                          ...current,
                          status: toggleSet(current.status, option.value),
                        }))
                      }
                    />
                    <span className="flex-1 text-sm">{option.label}</span>
                    {counts?.status?.[option.value] != null ? (
                      <span className="text-muted-foreground text-xs">
                        {counts.status[option.value]}
                      </span>
                    ) : null}
                  </label>
                ))}
              </div>
            ) : null}

            {active === "fiscalSponsorship" ? (
              <div className="grid grid-cols-2 gap-2">
                {MEMBER_WORKSPACE_FISCAL_SPONSORSHIP_STATUS_OPTIONS.map(
                  (option) => (
                    <label
                      key={option.value}
                      className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded-lg border p-2"
                    >
                      <Checkbox
                        checked={temp.fiscalSponsorship.has(option.value)}
                        onCheckedChange={() =>
                          setTemp((current) => ({
                            ...current,
                            fiscalSponsorship: toggleSet(
                              current.fiscalSponsorship,
                              option.value
                            ),
                          }))
                        }
                      />
                      <span className="flex-1 text-sm">{option.label}</span>
                      {counts?.fiscalSponsorship?.[option.value] != null ? (
                        <span className="text-muted-foreground text-xs">
                          {counts.fiscalSponsorship[option.value]}
                        </span>
                      ) : null}
                    </label>
                  )
                )}
              </div>
            ) : null}

            {active === "members" ? (
              <div className="space-y-2">
                {memberOptions.map((member) => (
                  <label
                    key={member.id}
                    className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded-lg border p-2"
                  >
                    <Checkbox
                      checked={temp.members.has(member.id)}
                      onCheckedChange={() =>
                        setTemp((current) => ({
                          ...current,
                          members: toggleSet(current.members, member.id),
                        }))
                      }
                    />
                    <span className="flex-1 text-sm">{member.label}</span>
                    {counts?.members?.[member.id.toLowerCase()] != null ? (
                      <span className="text-muted-foreground text-xs">
                        {counts.members[member.id.toLowerCase()]}
                      </span>
                    ) : null}
                  </label>
                ))}
              </div>
            ) : null}

            {active === "tags" ? (
              <div>
                <div className="pb-2">
                  <Input
                    placeholder="Search tags…"
                    value={tagSearch}
                    onChange={(event) => setTagSearch(event.target.value)}
                    className="h-8"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {tagOptions
                    .filter((tag) => tag.includes(tagSearch.toLowerCase()))
                    .map((tag) => (
                      <label
                        key={tag}
                        className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded-lg border p-2"
                      >
                        <Checkbox
                          checked={temp.tags.has(tag)}
                          onCheckedChange={() =>
                            setTemp((current) => ({
                              ...current,
                              tags: toggleSet(current.tags, tag),
                            }))
                          }
                        />
                        <span className="flex-1 text-sm">{tag}</span>
                        {counts?.tags?.[tag] != null ? (
                          <span className="text-muted-foreground text-xs">
                            {counts.tags[tag]}
                          </span>
                        ) : null}
                      </label>
                    ))}
                </div>
              </div>
            ) : null}

            <div className="border-border/40 mt-4 flex items-center justify-end gap-2 border-t pt-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
              >
                Clear
              </Button>
              <Button type="button" size="sm" onClick={handleApply}>
                Apply filters
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
