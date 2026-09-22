"use client"

import { FunnelX } from "@phosphor-icons/react/dist/ssr"

import { Button } from "@/components/ui/button"
import { Empty } from "@/components/ui/empty"

export function MemberWorkspaceProjectsFilteredEmpty({
  directory = "organizations",
  onClear,
}: {
  directory?: "organizations" | "projects"
  onClear: () => void
}) {
  return (
    <div className="p-4">
      <Empty
        icon={<FunnelX className="size-6" aria-hidden />}
        title={`No matching ${directory}`}
        description={`No ${directory} match the active filters.`}
        variant="subtle"
        actions={
          <Button type="button" variant="outline" onClick={onClear}>
            Clear filters
          </Button>
        }
      />
    </div>
  )
}
