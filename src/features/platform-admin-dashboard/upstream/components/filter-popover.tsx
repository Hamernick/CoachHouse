"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/features/platform-admin-dashboard/upstream/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/features/platform-admin-dashboard/upstream/components/ui/popover"
import { Input } from "@/features/platform-admin-dashboard/upstream/components/ui/input"
import { Checkbox } from "@/features/platform-admin-dashboard/upstream/components/ui/checkbox"
import { Avatar, AvatarFallback, AvatarImage } from "@/features/platform-admin-dashboard/upstream/components/ui/avatar"
import { cn } from "@/features/platform-admin-dashboard/upstream/lib/utils"
import {
  Funnel,
  Spinner,
  Tag,
  User,
  ChartBar,
} from "@phosphor-icons/react/dist/ssr"

export type FilterChip = { key: string; value: string }

type FilterTemp = {
  status: Set<string>
  priority: Set<string>
  tags: Set<string>
  members: Set<string>
}

export type FilterPopoverMemberOption = {
  id: string
  label: string
  avatar?: string | null
  hint?: string
  countKey?: string
  value?: string
}

export type FilterPopoverTagOption = {
  id: string
  label: string
  countKey?: string
  value?: string
}

interface FilterCounts {
  status?: Record<string, number>
  priority?: Record<string, number>
  tags?: Record<string, number>
  members?: Record<string, number>
}

interface FilterPopoverProps {
  applyOnChange?: boolean
  entityType?: "project" | "task"
  initialChips?: FilterChip[]
  onApply: (chips: FilterChip[]) => void
  onClear: () => void
  counts?: FilterCounts
  memberOptions?: FilterPopoverMemberOption[]
  tagOptions?: FilterPopoverTagOption[]
}

const DEFAULT_MEMBER_OPTIONS: FilterPopoverMemberOption[] = [
  { id: "no-member", label: "No member", avatar: undefined, countKey: "no-member" },
  {
    id: "current",
    label: "Current member",
    avatar: undefined,
    hint: "1 projects",
    countKey: "current",
  },
  {
    id: "jason",
    label: "jason duong",
    avatar: "/platform-lab/placeholder-user.jpg",
    hint: "3 projects",
    countKey: "jason",
  },
]

const DEFAULT_TAG_OPTIONS: FilterPopoverTagOption[] = [
  { id: "frontend", label: "frontend", countKey: "frontend" },
  { id: "backend", label: "backend", countKey: "backend" },
  { id: "bug", label: "bug", countKey: "bug" },
  { id: "feature", label: "feature", countKey: "feature" },
  { id: "urgent", label: "urgent", countKey: "urgent" },
]

export function FilterPopover({
  entityType = "project",
  applyOnChange = false,
  initialChips,
  onApply,
  onClear,
  counts,
  memberOptions: memberOptionsProp,
  tagOptions: tagOptionsProp,
}: FilterPopoverProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [active, setActive] = useState<
    "status" | "priority" | "tags" | "members"
  >("status")

  const [temp, setTemp] = useState<FilterTemp>(() => ({
    status: new Set<string>(),
    priority: new Set<string>(),
    tags: new Set<string>(),
    members: new Set<string>(),
  }))

  const [tagSearch, setTagSearch] = useState("")

  // Preselect from chips when opening
  useEffect(() => {
    if (!open) return
    const next: FilterTemp = {
      status: new Set<string>(),
      priority: new Set<string>(),
      tags: new Set<string>(),
      members: new Set<string>(),
    }
    for (const c of initialChips || []) {
      const k = c.key.toLowerCase()
      if (k === "status") next.status.add(c.value.toLowerCase().replace("to do", "todo").replace("in progress", "in-progress"))
      if (k === "priority") next.priority.add(c.value.toLowerCase().replace("no priority", "no-priority"))
      if (k === "member" || k === "pic" || k === "members") next.members.add(c.value)
      if (k === "tag" || k === "tags") next.tags.add(c.value.toLowerCase())
    }
    setTemp(next)
  }, [open, initialChips])

  const categories = [
    { id: "status", label: "Status", icon: Spinner },
    { id: "priority", label: "Priority", icon: ChartBar },
    { id: "tags", label: "Tags", icon: Tag },
    { id: "members", label: "Members", icon: User },
  ] as const

  const statusOptions = entityType === "task" ? [
    { id: "todo", label: "To do", color: "var(--muted-foreground)" },
    { id: "in-progress", label: "In progress", color: "var(--chart-2)" },
    { id: "waiting", label: "Waiting", color: "var(--chart-4)" },
    { id: "done", label: "Done", color: "var(--chart-3)" },
  ] : [
    { id: "backlog", label: "Backlog", color: "var(--chart-2)" },
    { id: "planned", label: "Planned", color: "var(--chart-2)" },
    { id: "active", label: "Active", color: "var(--chart-3)" },
    { id: "cancelled", label: "Cancelled", color: "var(--chart-5)" },
    { id: "completed", label: "Completed", color: "var(--chart-3)" },
  ]

  const priorityOptions = [
    ...(entityType === "task" ? [{ id: "no-priority", label: "No priority" }] : []),
    { id: "urgent", label: "Urgent" },
    { id: "high", label: "High" },
    { id: "medium", label: "Medium" },
    { id: "low", label: "Low" },
  ]

  const memberOptions = memberOptionsProp ?? DEFAULT_MEMBER_OPTIONS
  const tagOptions: FilterPopoverTagOption[] = tagOptionsProp ?? (entityType === "task"
    ? Object.keys(counts?.tags ?? {}).map((tag) => ({ id: tag, label: tag, countKey: tag }))
    : DEFAULT_TAG_OPTIONS)

  const categoryTotal = (category: keyof FilterCounts) => {
    const values = counts?.[category] ?? {}
    const keys = category === "members"
      ? new Set(memberOptions.map((option) => option.countKey ?? option.id))
      : new Set(Object.keys(values))
    return Array.from(keys).reduce((sum, key) => sum + (values[key] ?? 0), 0)
  }

  const filteredCategories = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return categories
    return categories.filter((c) => c.label.toLowerCase().includes(q))
  }, [categories, query])

  const toggleSet = (set: Set<string>, v: string) => {
    const n = new Set(set)
    if (n.has(v)) n.delete(v)
    else n.add(v)
    return n
  }

  const applySelection = (selection: FilterTemp) => {
    const chips: FilterChip[] = []
    selection.status.forEach((v) => chips.push({ key: "Status", value: statusOptions.find((option) => option.id === v)?.label ?? capitalize(v) }))
    selection.priority.forEach((v) => chips.push({ key: "Priority", value: priorityOptions.find((option) => option.id === v)?.label ?? capitalize(v) }))
    selection.members.forEach((v) => chips.push({ key: "Member", value: v }))
    selection.tags.forEach((v) => chips.push({ key: "Tag", value: v }))
    onApply(chips)
  }

  const changeSelection = (category: keyof FilterTemp, value: string) => {
    const next = { ...temp, [category]: toggleSet(temp[category], value) }
    setTemp(next)
    if (applyOnChange) applySelection(next)
  }

  const handleClear = () => {
    setTemp({
      status: new Set<string>(),
      priority: new Set<string>(),
      tags: new Set<string>(),
      members: new Set<string>(),
    })
    onClear()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-2 rounded-lg border-border/60 px-3 bg-transparent">
          <Funnel className="h-4 w-4" />
          Filter
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(45rem,calc(100vw-2rem))] max-h-[var(--radix-popover-content-available-height)] overflow-y-auto p-0 rounded-xl">
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:grid-cols-[260px_minmax(0,1fr)]">
          <div className="p-3 border-r border-border/40">
            <div className="px-1 pb-2">
              <Input placeholder="Search..." value={query} onChange={(e) => setQuery(e.target.value)} className="h-8" />
            </div>
            <div className="space-y-1">
              {filteredCategories.map((cat) => (
                <button
                  key={cat.id}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent",
                    active === cat.id && "bg-accent"
                  )}
                  onClick={() => setActive(cat.id)}
                >
                  <cat.icon className="h-4 w-4" />
                  <span className="flex-1 text-left">{cat.label}</span>
                  {counts && counts[cat.id as keyof FilterCounts] && (
                    <span className="text-xs text-muted-foreground">
                      {categoryTotal(cat.id)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3">
            {active === "priority" && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {priorityOptions.map((opt) => (
                  <label key={opt.id} className="flex items-center gap-2 rounded-lg border p-2 hover:bg-accent cursor-pointer">
                    <Checkbox
                      checked={temp.priority.has(opt.id)}
                      aria-label={opt.label}
                      onCheckedChange={() => changeSelection("priority", opt.id)}
                    />
                    <span className="text-sm flex-1">{opt.label}</span>
                    {counts?.priority && (
                      <span className="text-xs text-muted-foreground">{counts.priority[opt.id] ?? 0}</span>
                    )}
                  </label>
                ))}
              </div>
            )}

            {active === "status" && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {statusOptions.map((opt) => (
                  <label key={opt.id} className="flex items-center gap-2 rounded-lg border p-2 hover:bg-accent cursor-pointer">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: opt.color }} />
                    <Checkbox
                      checked={temp.status.has(opt.id)}
                      aria-label={opt.label}
                      onCheckedChange={() => changeSelection("status", opt.id)}
                    />
                    <span className="text-sm flex-1">{opt.label}</span>
                    {counts?.status && (
                      <span className="text-xs text-muted-foreground">{counts.status[opt.id] ?? 0}</span>
                    )}
                  </label>
                ))}
              </div>
            )}

            {active === "members" && (
              <div className="space-y-2">
                {memberOptions.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 rounded-lg border p-2 hover:bg-accent cursor-pointer">
                    <Checkbox
                      checked={temp.members.has(m.value ?? m.label)}
                      aria-label={m.label}
                      onCheckedChange={() => changeSelection("members", m.value ?? m.label)}
                    />
                    {m.avatar ? (
                      <Avatar className="size-6">
                        <AvatarImage src={m.avatar} alt={m.label} />
                        <AvatarFallback>{m.label.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    ) : null}
                    <span className="text-sm flex-1">{m.label}</span>
                    {counts?.members ? (
                      <span className="text-xs text-muted-foreground">
                        {counts.members[m.countKey ?? m.id] ?? 0}
                      </span>
                    ) : (
                      m.hint && <span className="text-xs text-muted-foreground">{m.hint}</span>
                    )}
                  </label>
                ))}
              </div>
            )}

            {active === "tags" && (
              <div>
                <div className="pb-2">
                  <Input
                    placeholder="Search tags..."
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                    className="h-8"
                  />
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {tagOptions
                    .filter((t) => t.label.toLowerCase().includes(tagSearch.toLowerCase()))
                    .map((t) => (
                      <label key={t.id} className="flex items-center gap-2 rounded-lg border p-2 hover:bg-accent cursor-pointer">
                        <Checkbox
                          checked={temp.tags.has(t.value ?? t.id)}
                          aria-label={t.label}
                          onCheckedChange={() => changeSelection("tags", t.value ?? t.id)}
                        />
                        <span className="text-sm flex-1">{t.label}</span>
                        {counts?.tags && (
                          <span className="text-xs text-muted-foreground">
                            {counts.tags[t.countKey ?? t.id] ?? 0}
                          </span>
                        )}
                      </label>
                    ))}
                </div>
              </div>
            )}

            <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-3">
              <button onClick={handleClear} className="text-sm text-primary hover:underline">
                Clear
              </button>
              <Button size="sm" className="h-8 rounded-lg" onClick={() => { if (!applyOnChange) applySelection(temp); setOpen(false) }}>
                {applyOnChange ? "Done" : "Apply"}
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}
