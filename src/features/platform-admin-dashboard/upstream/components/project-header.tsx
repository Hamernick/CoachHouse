"use client"

import { Button } from "@/features/platform-admin-dashboard/upstream/components/ui/button"
import { SidebarTrigger } from "@/features/platform-admin-dashboard/upstream/components/ui/sidebar"
import { FilterChip } from "@/features/platform-admin-dashboard/upstream/components/filter-chip"
import { ViewOptionsPopover } from "@/features/platform-admin-dashboard/upstream/components/view-options-popover"
import { FilterPopover } from "@/features/platform-admin-dashboard/upstream/components/filter-popover"
import { ChipOverflow } from "@/features/platform-admin-dashboard/upstream/components/chip-overflow"
import { Link as LinkIcon, Plus } from "@phosphor-icons/react/dist/ssr"
import type { FilterCounts } from "@/features/platform-admin-dashboard/upstream/lib/data/projects"
import type { FilterChip as FilterChipType, ViewOptions } from "@/features/platform-admin-dashboard/upstream/lib/view-options"

interface ProjectHeaderProps {
  filters: FilterChipType[]
  onRemoveFilter: (key: string, value: string) => void
  onFiltersChange: (chips: FilterChipType[]) => void
  counts?: FilterCounts
  viewOptions: ViewOptions
  onViewOptionsChange: (options: ViewOptions) => void
  onAddProject?: () => void
}

export function ProjectHeader({ filters, onRemoveFilter, onFiltersChange, counts, viewOptions, onViewOptionsChange, onAddProject }: ProjectHeaderProps) {
  return (
    <header className="flex flex-col border-b border-border/40">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="h-8 w-8 rounded-lg hover:bg-accent text-muted-foreground" />
          <p className="text-base font-medium text-foreground">Projects</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
            <LinkIcon className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onAddProject}>
            <Plus className="h-4 w-4" weight="bold" />
            Add Project
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 pb-3 pt-3">
        <div className="flex items-center gap-2">
          <FilterPopover
            initialChips={filters}
            onApply={onFiltersChange}
            onClear={() => onFiltersChange([])}
            counts={counts}
          />
          <ChipOverflow chips={filters} onRemove={onRemoveFilter} maxVisible={6} />
        </div>
        <div className="flex items-center gap-2">
          <ViewOptionsPopover options={viewOptions} onChange={onViewOptionsChange} />
        </div>
      </div>
    </header>
  )
}
