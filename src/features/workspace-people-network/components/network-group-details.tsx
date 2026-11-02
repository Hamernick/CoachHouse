"use client"

import { useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { layoutNetworkRings } from "../lib"
import type { WorkspacePeopleNetworkProps } from "../types"

export function NetworkGroupDetails({
  ring,
  center,
  peopleById,
  canEdit,
  renderPerson,
  onEdit,
}: {
  ring: ReturnType<typeof layoutNetworkRings>[number]
  center: number
  peopleById: Map<string, WorkspacePeopleNetworkProps["people"][number]>
  canEdit: boolean
  renderPerson: (personId: string, groupId: string) => ReactNode
  onEdit: WorkspacePeopleNetworkProps["onEdit"]
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [limit, setLimit] = useState(30)
  const matches = ring.memberIds.filter((id) =>
    peopleById
      .get(id)
      ?.name.toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase())
  )
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setQuery("")
          setLimit(30)
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="bg-background absolute z-20 h-7 max-w-32 -translate-x-1/2 -translate-y-1/2 rounded-full px-2 text-xs [@media(pointer:coarse)]:h-11"
          style={{ left: center, top: center + ring.radius }}
          aria-label={`${ring.label}: ${ring.memberIds.length} people`}
        >
          <span className="truncate">{ring.label}</span>
          <span className="text-muted-foreground">
            ({ring.memberIds.length})
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 rounded-xl p-2" align="center">
        <p className="px-2 py-1 text-sm font-medium">{ring.label}</p>
        {ring.memberIds.length === 0 ? (
          <p className="text-muted-foreground p-2 text-xs">
            {canEdit ? "Drop a person here." : "No people in this group."}
          </p>
        ) : (
          <>
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setLimit(30)
              }}
              aria-label={`Search ${ring.label}`}
              placeholder="Search people"
              className="my-1 h-8 rounded-lg"
            />
            <ul className="max-h-60 overflow-y-auto">
              {matches.slice(0, limit).map((id) => (
                <li key={id} className="flex items-center gap-2">
                  {renderPerson(id, ring.id)}
                  <Button
                    variant="ghost"
                    className="h-auto min-w-0 flex-1 justify-start px-1 text-left text-xs whitespace-normal"
                    onClick={() => {
                      const person = peopleById.get(id)
                      if (person) {
                        setOpen(false)
                        onEdit(person)
                      }
                    }}
                  >
                    {peopleById.get(id)?.name}
                  </Button>
                </li>
              ))}
            </ul>
            {matches.length === 0 && (
              <p className="text-muted-foreground p-2 text-xs">No matches.</p>
            )}
            {matches.length > limit && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setLimit(limit + 30)}
              >
                Show more ({matches.length - limit})
              </Button>
            )}
          </>
        )}
      </PopoverContent>
      {ring.hiddenIds.length > 0 && ring.overflowPoint && (
        <Button
          onClick={() => setOpen(true)}
          aria-expanded={open}
          variant="secondary"
          size="icon"
          className="absolute z-10 size-11 rounded-full text-xs"
          style={{
            left: ring.overflowPoint.x - 22,
            top: ring.overflowPoint.y - 22,
          }}
          aria-label={`Show ${ring.hiddenIds.length} more in ${ring.label}`}
        >
          +{ring.hiddenIds.length}
        </Button>
      )}
    </Popover>
  )
}
