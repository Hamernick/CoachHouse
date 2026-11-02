"use client"

import { useId, useMemo, useState, type DragEvent } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down"
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left"
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right"
import Users from "lucide-react/dist/esm/icons/users"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useWorkspacePeopleNetworkController } from "../hooks/use-workspace-people-network-controller"
import { layoutNetworkRings, networkRings, NETWORK_UNGROUPED } from "../lib"
import type { NetworkMode, WorkspacePeopleNetworkProps } from "../types"
import { NetworkGroupDetails } from "./network-group-details"
import { NetworkPerson } from "./network-person"

export function WorkspacePeopleNetworkPanel(
  props: WorkspacePeopleNetworkProps
) {
  const [mode, setMode] = useState<NetworkMode>("segments")
  const [page, setPage] = useState(0)
  const [localExpanded, setExpanded] = useState(true)
  const expanded = props.expanded ?? localExpanded
  const [drag, setDrag] = useState<{
    personId: string
    from: string
    mode: NetworkMode
  } | null>(null)
  const [dropId, setDropId] = useState<string | null>(null)
  const { containerRef, size, pendingId, status, move } =
    useWorkspacePeopleNetworkController(props)
  const reducedMotion = useReducedMotion()
  const regionId = useId()
  const groups = props[mode]
  const pageSize = size < 280 ? 1 : 2
  const pageCount = Math.max(1, Math.ceil(groups.length / pageSize))
  const currentPage = Math.min(page, pageCount - 1)
  const peopleById = useMemo(
    () => new Map(props.people.map((person) => [person.id, person])),
    [props.people]
  )
  const rings = useMemo(
    () =>
      layoutNetworkRings(
        networkRings(
          groups,
          props.people.map((person) => person.id),
          currentPage,
          pageSize
        ),
        size
      ),
    [groups, props.people, currentPage, pageSize, size]
  )
  const dragEnd = () => {
    setDrag(null)
    setDropId(null)
    props.onDragEnd()
  }
  const targetAt = (event: DragEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const distance = Math.hypot(
      event.clientX - rect.left - size / 2,
      event.clientY - rect.top - size / 2
    )
    return rings.reduce(
      (nearest, ring) =>
        Math.abs(ring.radius - distance) < Math.abs(nearest.radius - distance)
          ? ring
          : nearest,
      rings[0]
    )
  }
  const movePerson = (personId: string, from: string, to: string | null) =>
    move({
      mode,
      personId,
      from: from === NETWORK_UNGROUPED ? null : from,
      to: to === NETWORK_UNGROUPED ? null : to,
    })
  const renderPerson = (personId: string, groupId: string) => {
    const person = peopleById.get(personId)
    if (!person) return null
    return (
      <NetworkPerson
        person={person}
        groupId={groupId}
        groups={groups}
        pending={pendingId === personId}
        busy={pendingId !== null}
        canEdit={props.canEdit}
        placed={props.placedPersonIds.has(personId)}
        onEdit={() => props.onEdit(person)}
        onMove={(target) => movePerson(personId, groupId, target)}
        onAdd={() => props.onAddToCanvas([personId])}
        onDragStart={(event) => {
          props.onDragStart([personId], event)
          event.dataTransfer.effectAllowed = "copyMove"
          setDrag({ personId, from: groupId, mode })
        }}
        onDragEnd={dragEnd}
      />
    )
  }

  return (
    <section
      aria-label="People network"
      className="flex h-full min-h-0 flex-col overflow-hidden"
    >
      <div className="flex shrink-0 flex-wrap items-center gap-2 px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="mr-auto gap-2 rounded-lg px-2"
          aria-expanded={expanded}
          aria-controls={regionId}
          onClick={() => {
            setExpanded(!expanded)
            props.onExpandedChange?.(!expanded)
          }}
        >
          <ChevronDown
            className={cn(
              "size-4 transition-transform motion-reduce:transition-none",
              !expanded && "-rotate-90"
            )}
            aria-hidden
          />
          Network{" "}
          <span className="text-muted-foreground tabular-nums">
            ({props.people.length})
          </span>
        </Button>
        {expanded && (
          <Tabs
            value={mode}
            onValueChange={(value) => {
              if (value === "segments" || value === "tags") {
                setMode(value)
                setPage(0)
              }
            }}
          >
            <TabsList
              aria-label="Network grouping"
              className="h-8 rounded-full p-0.5"
            >
              <TabsTrigger
                value="segments"
                disabled={!!pendingId}
                className="rounded-full text-xs"
              >
                Segments
              </TabsTrigger>
              <TabsTrigger
                value="tags"
                disabled={!!pendingId}
                className="rounded-full text-xs"
              >
                Tags
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>
      <div
        id={regionId}
        hidden={!expanded}
        className={cn(
          "flex min-h-0 flex-1 flex-col px-3 pb-3",
          !expanded && "hidden"
        )}
      >
        {props.loading ? (
          <div
            role="status"
            aria-label="Loading people network"
            className="grid min-h-0 flex-1 place-items-center overflow-hidden"
          >
            <Skeleton className="size-48 rounded-full" />
          </div>
        ) : (
          <>
            <div
              ref={containerRef}
              className="grid min-h-0 flex-1 place-items-center"
            >
              {size < 120 && (
                <p className="text-muted-foreground shrink-0 text-center text-xs">
                  Drag the divider down to expand the network.
                </p>
              )}
              <div
                hidden={size < 120}
                className="relative mx-auto"
                style={{ width: size, height: size }}
                onDragOver={(event) => {
                  if (
                    !props.canEdit ||
                    pendingId ||
                    !props.hasDragPeople(event.dataTransfer)
                  )
                    return
                  event.preventDefault()
                  event.stopPropagation()
                  event.dataTransfer.dropEffect = drag ? "move" : "copy"
                  setDropId(targetAt(event).id)
                }}
                onDragLeave={(event) => {
                  if (
                    !(event.relatedTarget instanceof Node) ||
                    !event.currentTarget.contains(event.relatedTarget)
                  )
                    setDropId(null)
                }}
                onDrop={async (event) => {
                  if (
                    !props.canEdit ||
                    pendingId ||
                    !props.hasDragPeople(event.dataTransfer)
                  )
                    return
                  event.preventDefault()
                  event.stopPropagation()
                  const target = targetAt(event).id
                  const personIds = [
                    ...new Set(props.readDragPeople(event.dataTransfer)),
                  ].filter((id) => peopleById.has(id))
                  const sourceDrag = drag
                  dragEnd()
                  for (const personId of personIds) {
                    const source =
                      sourceDrag?.personId === personId &&
                      sourceDrag.mode === mode
                        ? sourceDrag.from
                        : NETWORK_UNGROUPED
                    await movePerson(personId, source, target)
                  }
                }}
              >
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <Users className="text-muted-foreground size-5" aria-hidden />
                </div>
                {rings.map((ring) => (
                  <div
                    key={ring.id}
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute rounded-full border transition-colors motion-reduce:transition-none",
                      ring.id === NETWORK_UNGROUPED && "border-dashed",
                      dropId === ring.id &&
                        "border-primary bg-primary/5 ring-primary/20 ring-2"
                    )}
                    style={{
                      width: ring.radius * 2,
                      height: ring.radius * 2,
                      left: size / 2 - ring.radius,
                      top: size / 2 - ring.radius,
                    }}
                  />
                ))}
                <AnimatePresence initial={false}>
                  {rings.flatMap((ring) =>
                    ring.visibleIds.map((personId, index) => (
                      <motion.div
                        key={`${mode}:${ring.id}:${personId}`}
                        className="absolute top-0 left-0 z-10"
                        initial={reducedMotion ? false : { opacity: 0 }}
                        animate={{
                          x: ring.points[index].x - 22,
                          y: ring.points[index].y - 22,
                          opacity: 1,
                        }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: reducedMotion ? 0 : 0.2 }}
                      >
                        {renderPerson(personId, ring.id)}
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
                {rings.map((ring) => (
                  <NetworkGroupDetails
                    key={`${mode}:${ring.id}`}
                    ring={ring}
                    center={size / 2}
                    peopleById={peopleById}
                    canEdit={props.canEdit}
                    renderPerson={renderPerson}
                    onEdit={props.onEdit}
                  />
                ))}
              </div>
            </div>
            {groups.length === 0 && (
              <p className="text-muted-foreground shrink-0 text-center text-xs">
                No {mode} yet. Create one from the People controls.
              </p>
            )}
            {pageCount > 1 && (
              <div className="flex shrink-0 items-center justify-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  disabled={currentPage === 0 || !!pendingId}
                  aria-label="Previous network groups"
                  onClick={() => setPage(currentPage - 1)}
                >
                  <ChevronLeft aria-hidden />
                </Button>
                <span className="text-muted-foreground text-xs">
                  Groups {currentPage * pageSize + 1}–
                  {Math.min(groups.length, currentPage * pageSize + pageSize)}{" "}
                  of {groups.length}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  disabled={currentPage + 1 >= pageCount || !!pendingId}
                  aria-label="Next network groups"
                  onClick={() => setPage(currentPage + 1)}
                >
                  <ChevronRight aria-hidden />
                </Button>
              </div>
            )}
          </>
        )}
        <p
          role="status"
          className={cn(
            "text-muted-foreground text-center text-xs",
            status ? "pt-2" : "sr-only"
          )}
        >
          {status}
        </p>
      </div>
    </section>
  )
}
