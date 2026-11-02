"use client"

import { useState, type DragEvent } from "react"
import LoaderCircle from "lucide-react/dist/esm/icons/loader-circle"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { NETWORK_UNGROUPED } from "../lib"
import type { NetworkGroup, WorkspacePeopleNetworkProps } from "../types"

export function NetworkPerson({
  person,
  groupId,
  groups,
  pending,
  busy,
  canEdit,
  placed,
  onEdit,
  onMove,
  onAdd,
  onDragStart,
  onDragEnd,
}: {
  person: WorkspacePeopleNetworkProps["people"][number]
  groupId: string
  groups: NetworkGroup[]
  busy: boolean
  pending: boolean
  canEdit: boolean
  placed: boolean
  onEdit: () => void
  onMove: (target: string | null) => void
  onAdd: () => void
  onDragStart: (event: DragEvent<HTMLElement>) => void
  onDragEnd: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <PopoverTrigger asChild>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 rounded-full p-0 hover:bg-transparent focus-visible:ring-2"
              draggable={!busy}
              disabled={busy}
              onDragStart={(event) => {
                setOpen(false)
                onDragStart(event)
              }}
              onDragEnd={onDragEnd}
              aria-label={`Open ${person.name}`}
              aria-description="Drag to a group or the canvas. Open for contact actions."
            >
              {pending ? (
                <LoaderCircle
                  aria-hidden
                  className="size-5 animate-spin motion-reduce:animate-none"
                />
              ) : (
                <Avatar className="border-background pointer-events-none size-10 border-2 shadow-sm">
                  <AvatarImage
                    src={person.displayImage ?? person.image ?? undefined}
                    alt=""
                    draggable={false}
                  />
                  <AvatarFallback className="text-xs">
                    {person.name
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
              )}
            </Button>
          </TooltipTrigger>
        </PopoverTrigger>
        <TooltipContent>
          <p>{person.name}</p>
          {person.title && <p className="opacity-75">{person.title}</p>}
        </TooltipContent>
      </Tooltip>
      <PopoverContent className="w-56 rounded-xl p-2">
        <p className="px-2 py-1 text-sm font-medium">{person.name}</p>
        {person.title && (
          <p className="text-muted-foreground px-2 pb-2 text-xs">
            {person.title}
          </p>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start rounded-lg"
          onClick={() => {
            setOpen(false)
            onEdit()
          }}
        >
          {canEdit ? "Edit contact" : "View contact"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start rounded-lg"
          disabled={placed || busy}
          onClick={() => {
            onAdd()
            setOpen(false)
          }}
        >
          {placed ? "On canvas" : "Add to canvas"}
        </Button>
        {canEdit && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start rounded-lg"
                  disabled={busy || groups.length === 0}
                >
                  Move to group
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="max-h-64 overflow-y-auto rounded-xl">
                {groups.map((group) => (
                  <DropdownMenuItem
                    key={group.id}
                    disabled={group.id === groupId}
                    onSelect={() => {
                      setOpen(false)
                      onMove(group.id)
                    }}
                  >
                    {group.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {groupId !== NETWORK_UNGROUPED && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start rounded-lg"
                disabled={busy}
                onClick={() => {
                  setOpen(false)
                  onMove(null)
                }}
              >
                Remove from this group
              </Button>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
