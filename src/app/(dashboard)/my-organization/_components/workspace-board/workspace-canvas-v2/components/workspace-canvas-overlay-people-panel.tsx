"use client"

import {
  memo,
  useCallback,
  useDeferredValue,
  useMemo,
  useState,
  useTransition,
  type DragEvent,
} from "react"

import type { OrgPersonWithImage } from "@/components/people/supporters-showcase"
import type { PersonRoleFilterValue } from "@/lib/people/roles"
import type { OrganizationPeopleSegment } from "@/lib/people/segments"
import type { OrganizationPeopleTag } from "@/lib/people/tags"
import { cn } from "@/lib/utils"

import type { WorkspaceBoardUiPreferenceScope } from "../../workspace-board-ui-preferences"
import {
  readWorkspaceCanvasPersonDragPayload,
  type WorkspacePeopleCanvasActions,
  WORKSPACE_PERSON_DRAG_TYPE,
  writeWorkspaceCanvasPersonDragPayload,
} from "./workspace-canvas-people-dnd"
import type { WorkspacePeopleSegment } from "./workspace-canvas-people-segment-types"
import {
  buildPeopleSegments,
  resolveSegmentPeople,
  segmentShowsReportsTo,
  useFilteredWorkspacePeople,
} from "./workspace-canvas-overlay-people-filtering"
import { WorkspacePeopleDrawerControls } from "./workspace-canvas-overlay-people-controls"
import { WorkspacePeopleDrawerTable } from "./workspace-canvas-overlay-people-table"
import { WorkspacePeopleAddMenu } from "./workspace-canvas-people-add-menu"
import { WorkspacePeopleSegmentRail } from "./workspace-canvas-people-segment-rail"
import { useWorkspacePeopleSegments } from "./use-workspace-people-segments"
import { useWorkspacePeopleTags } from "./use-workspace-people-tags"

type WorkspacePeopleDrawerPanelProps = {
  people: OrgPersonWithImage[]
  initialSegments: OrganizationPeopleSegment[]
  initialTags: OrganizationPeopleTag[]
  viewerId: string
  uiPreferencesScope: WorkspaceBoardUiPreferenceScope
  placedPersonIds: ReadonlySet<string>
  canEdit: boolean
  canvasActions: WorkspacePeopleCanvasActions
}

export const WorkspacePeopleDrawerPanel = memo(
  function WorkspacePeopleDrawerPanel({
    people,
    initialSegments,
    initialTags,
    viewerId,
    uiPreferencesScope,
    placedPersonIds,
    canEdit,
    canvasActions,
  }: WorkspacePeopleDrawerPanelProps) {
    const [selectedSegmentId, setSelectedSegmentId] = useState("all")
    const {
      addPeopleToSegment,
      createSegment,
      customSegments,
      removePersonFromSegment,
      removeSegment,
      renameSegment,
    } = useWorkspacePeopleSegments(initialSegments)
    const tagState = useWorkspacePeopleTags(initialTags)
    const [editingSegmentId, setEditingSegmentId] = useState<string | null>(
      null
    )
    const [draggingPersonIds, setDraggingPersonIds] = useState<string[]>([])
    const [activeSegmentDropId, setActiveSegmentDropId] = useState<
      string | null
    >(null)
    const [peopleSearch, setPeopleSearch] = useState("")
    const [peopleCategoryFilter, setPeopleCategoryFilter] =
      useState<PersonRoleFilterValue>("all")
    const [, startSegmentTransition] = useTransition()
    const deferredPeopleSearch = useDeferredValue(peopleSearch)
    const normalizedPeopleSearch = deferredPeopleSearch.trim().toLowerCase()
    const draggingPersonIdSet = useMemo(
      () => new Set(draggingPersonIds),
      [draggingPersonIds]
    )

    const segments = useMemo(
      () => buildPeopleSegments({ people, customSegments }),
      [customSegments, people]
    )
    const selectedSegment = useMemo(
      () =>
        segments.find((segment) => segment.id === selectedSegmentId) ??
        segments[0],
      [segments, selectedSegmentId]
    )
    const selectedPeople = useMemo(
      () =>
        resolveSegmentPeople({
          people,
          segment: selectedSegment,
        }),
      [people, selectedSegment]
    )
    const filteredSelectedPeople = useFilteredWorkspacePeople({
      categoryFilter: peopleCategoryFilter,
      people: selectedPeople,
      query: normalizedPeopleSearch,
      tags: tagState.tags,
    })
    const selectedCustomSegment =
      selectedSegment.kind === "custom" ? selectedSegment : null
    const showReportsTo = segmentShowsReportsTo(selectedSegment)
    const availablePeople = useMemo(() => {
      if (!selectedCustomSegment) return []
      const selectedIds = new Set(selectedCustomSegment.memberIds)
      return people.filter((person) => !selectedIds.has(person.id))
    }, [people, selectedCustomSegment])

    const handleSegmentChange = useCallback(
      (segmentId: string) => {
        startSegmentTransition(() => {
          setSelectedSegmentId(segmentId)
          setPeopleSearch("")
          setPeopleCategoryFilter("all")
        })
      },
      [startSegmentTransition]
    )

    const handleCreateSegment = useCallback(() => {
      const nextLabel = `Segment ${customSegments.length + 1}`
      createSegment(nextLabel, (nextSegment) => {
        setSelectedSegmentId(nextSegment.id)
        setEditingSegmentId(nextSegment.id)
        setPeopleSearch("")
        setPeopleCategoryFilter("all")
      })
    }, [createSegment, customSegments.length])

    const handleRenameSegment = useCallback(
      (segmentId: string, label: string) => {
        renameSegment(segmentId, label)
        setEditingSegmentId(null)
      },
      [renameSegment]
    )

    const handleRemoveSegment = useCallback(
      (segmentId: string) => {
        removeSegment(segmentId)
        setSelectedSegmentId((current) =>
          current === segmentId ? "all" : current
        )
        setEditingSegmentId((current) =>
          current === segmentId ? null : current
        )
      },
      [removeSegment]
    )

    const handleAddPeople = useCallback(
      (personIds: string[]) => {
        if (!selectedCustomSegment) return
        setPeopleCategoryFilter("all")
        addPeopleToSegment(selectedCustomSegment.id, personIds)
      },
      [addPeopleToSegment, selectedCustomSegment]
    )

    const handleAddPerson = useCallback(
      (personId: string) => handleAddPeople([personId]),
      [handleAddPeople]
    )

    const handleRemovePerson = useCallback(
      (personId: string) => {
        if (!selectedCustomSegment) return
        removePersonFromSegment(selectedCustomSegment.id, personId)
      },
      [removePersonFromSegment, selectedCustomSegment]
    )

    const handleAddPersonToSegment = useCallback(
      (segmentId: string, personId: string) =>
        addPeopleToSegment(segmentId, [personId]),
      [addPeopleToSegment]
    )

    const handleCreateSegmentForPerson = useCallback(
      (label: string, personId: string) =>
        createSegment(label, () => undefined, [personId]),
      [createSegment]
    )

    const handlePersonDragStart = useCallback(
      (personIds: string[], event: DragEvent<HTMLElement>) => {
        const normalizedPersonIds = Array.from(
          new Set(personIds.map((personId) => personId.trim()).filter(Boolean))
        )
        const primaryPersonId = normalizedPersonIds[0]
        if (!primaryPersonId) return

        event.dataTransfer.effectAllowed = "copy"
        event.dataTransfer.setData(WORKSPACE_PERSON_DRAG_TYPE, primaryPersonId)
        writeWorkspaceCanvasPersonDragPayload(
          event.dataTransfer,
          normalizedPersonIds
        )
        setDraggingPersonIds(normalizedPersonIds)
      },
      []
    )
    const handlePersonDragEnd = useCallback(() => {
      setDraggingPersonIds([])
      setActiveSegmentDropId(null)
    }, [])

    const handlePersonDrop = useCallback(
      (segmentId: string, event: DragEvent<HTMLElement>) => {
        event.preventDefault()
        event.stopPropagation()
        const droppedPersonIds = readWorkspaceCanvasPersonDragPayload(
          event.dataTransfer
        )
        const personIds =
          droppedPersonIds.length > 0 ? droppedPersonIds : draggingPersonIds
        if (personIds.length === 0) return
        addPeopleToSegment(segmentId, personIds)
        setPeopleCategoryFilter("all")
        setDraggingPersonIds([])
        setActiveSegmentDropId(null)
      },
      [addPeopleToSegment, draggingPersonIds]
    )

    const handleSegmentDragOver = useCallback(
      (segment: WorkspacePeopleSegment, event: DragEvent<HTMLElement>) => {
        if (segment.kind !== "custom") return
        event.preventDefault()
        event.stopPropagation()
        event.dataTransfer.dropEffect = "copy"
      },
      []
    )

    const handleSegmentDragEnter = useCallback(
      (segment: WorkspacePeopleSegment, event: DragEvent<HTMLElement>) => {
        if (segment.kind !== "custom" || draggingPersonIds.length === 0) return
        event.preventDefault()
        event.stopPropagation()
        setActiveSegmentDropId(segment.id)
      },
      [draggingPersonIds.length]
    )

    const handleSegmentDragLeave = useCallback(
      (segmentId: string, event: DragEvent<HTMLElement>) => {
        const nextTarget = event.relatedTarget
        if (
          nextTarget instanceof Node &&
          event.currentTarget.contains(nextTarget)
        ) {
          return
        }
        setActiveSegmentDropId((current) =>
          current === segmentId ? null : current
        )
      },
      []
    )

    return (
      <div
        className={cn(
          "flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden",
          draggingPersonIds.length > 0 && "select-none"
        )}
      >
        <WorkspacePeopleDrawerTable
          addControls={
            canEdit ? (
              <WorkspacePeopleAddMenu
                people={people}
                onCreateSegment={handleCreateSegment}
              />
            ) : null
          }
          segmentControls={
            <>
              <WorkspacePeopleSegmentRail
                segments={segments}
                selectedSegmentId={selectedSegment.id}
                editingSegmentId={editingSegmentId}
                draggingPersonCount={draggingPersonIds.length}
                activeDropSegmentId={activeSegmentDropId}
                canManageSegments={canEdit}
                onSegmentChange={handleSegmentChange}
                onRenameSegment={handleRenameSegment}
                onEditSegment={setEditingSegmentId}
                onRemoveSegment={handleRemoveSegment}
                onCancelEditSegment={() => setEditingSegmentId(null)}
                onSegmentDragOver={handleSegmentDragOver}
                onSegmentDragEnter={handleSegmentDragEnter}
                onSegmentDragLeave={handleSegmentDragLeave}
                onPersonDrop={handlePersonDrop}
              />
            </>
          }
          people={filteredSelectedPeople}
          allPeople={people}
          viewerId={viewerId}
          uiPreferencesScope={uiPreferencesScope}
          placedPersonIds={placedPersonIds}
          customSegment={selectedCustomSegment}
          segments={customSegments}
          tags={tagState.tags}
          draggingPersonIds={draggingPersonIdSet}
          canEdit={canEdit}
          showReportsTo={showReportsTo}
          label={`${selectedSegment.label} people`}
          emptyMessage={
            people.length === 0
              ? "No people yet. Add someone to get started."
              : selectedCustomSegment && selectedPeople.length === 0
                ? `No people in ${selectedCustomSegment.label} yet. Use Add people above to build this segment.`
                : normalizedPeopleSearch
                  ? "No people match your search."
                  : "No people match these filters."
          }
          controls={
            <WorkspacePeopleDrawerControls
              canEdit={canEdit}
              searchValue={peopleSearch}
              onSearchChange={setPeopleSearch}
              categoryFilter={peopleCategoryFilter}
              onCategoryFilterChange={setPeopleCategoryFilter}
              customSegment={selectedCustomSegment}
              people={people}
              availablePeople={availablePeople}
              onAddPeopleToSegment={handleAddPeople}
            />
          }
          onDragStart={handlePersonDragStart}
          onDragEnd={handlePersonDragEnd}
          onAdd={handleAddPerson}
          onRemove={handleRemovePerson}
          onAddPersonToSegment={handleAddPersonToSegment}
          onCreateSegment={handleCreateSegmentForPerson}
          onRemovePersonFromSegment={removePersonFromSegment}
          onAddPersonToTag={tagState.addPersonToTag}
          onCreateTag={tagState.createTag}
          onDeleteTag={tagState.deleteTag}
          onRemovePersonFromTag={tagState.removePersonFromTag}
          onUpdateTag={tagState.updateTag}
          onAddPeopleToCanvas={canvasActions.add}
          onRemovePersonFromCanvas={canvasActions.remove}
        />
      </div>
    )
  }
)
