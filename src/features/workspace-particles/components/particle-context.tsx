"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DropAnimationFunction,
} from "@dnd-kit/core"
import type { WorkspaceParticlesController } from "../hooks/use-workspace-particles-controller"
import { particleSourceKey } from "../lib"
import {
  captureParticleDragPreview,
  ParticleDragPreview,
  type ParticleDragSnapshot,
} from "./particle-drag-preview"
import { animateParticleDrop } from "../lib/particle-motion"

type WorkspaceParticlesContextValue = Pick<
  WorkspaceParticlesController,
  | "state"
  | "sources"
  | "canEdit"
  | "setCanvas"
  | "driveStatus"
  | "refreshDrive"
  | "updateRoadmapSection"
  | "pickDriveFiles"
  | "add"
  | "remove"
  | "resize"
  | "uploadImage"
  | "uploading"
  | "editingPlan"
  | "setEditingPlan"
  | "savePlan"
  | "completePlanStep"
  | "updateDecision"
  | "announcement"
> & {
  addFromSourceClick: WorkspaceParticlesController["add"]
}

const ParticleContext = createContext<WorkspaceParticlesContextValue | null>(
  null
)
export function useWorkspaceParticles() {
  return useContext(ParticleContext)
}

export function WorkspaceParticlesProvider({
  controller,
  children,
  preview = false,
}: {
  controller: WorkspaceParticlesController
  children: ReactNode
  preview?: boolean
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    })
  )
  const [dragSnapshot, setDragSnapshot] = useState<ParticleDragSnapshot | null>(
    null
  )
  const sourceDragActiveRef = useRef(false)
  const sourceDragEndedAtRef = useRef(0)
  const dropAcceptedRef = useRef(false)
  const dropAnimation = useCallback<DropAnimationFunction>(
    (args) => animateParticleDrop(args, dropAcceptedRef.current),
    []
  )
  const addParticle = controller.add
  const addFromSourceClick = useCallback<WorkspaceParticlesController["add"]>(
    (...args) => {
      if (
        sourceDragActiveRef.current ||
        performance.now() - sourceDragEndedAtRef.current < 250
      )
        return false
      return addParticle(...args)
    },
    [addParticle]
  )
  const contextValue = useMemo<WorkspaceParticlesContextValue>(
    () => ({
      state: controller.state,
      sources: controller.sources,
      canEdit: controller.canEdit,
      setCanvas: controller.setCanvas,
      driveStatus: controller.driveStatus,
      refreshDrive: controller.refreshDrive,
      updateRoadmapSection: controller.updateRoadmapSection,
      pickDriveFiles: controller.pickDriveFiles,
      add: controller.add,
      addFromSourceClick,
      remove: controller.remove,
      resize: controller.resize,
      uploadImage: controller.uploadImage,
      uploading: controller.uploading,
      editingPlan: controller.editingPlan,
      setEditingPlan: controller.setEditingPlan,
      savePlan: controller.savePlan,
      completePlanStep: controller.completePlanStep,
      updateDecision: controller.updateDecision,
      announcement: controller.announcement,
    }),
    [
      addFromSourceClick,
      controller.add,
      controller.announcement,
      controller.canEdit,
      controller.completePlanStep,
      controller.driveStatus,
      controller.editingPlan,
      controller.pickDriveFiles,
      controller.refreshDrive,
      controller.remove,
      controller.resize,
      controller.savePlan,
      controller.setCanvas,
      controller.setEditingPlan,
      controller.sources,
      controller.state,
      controller.updateDecision,
      controller.updateRoadmapSection,
      controller.uploadImage,
      controller.uploading,
    ]
  )
  return (
    <ParticleContext.Provider value={contextValue}>
      <DndContext
        sensors={sensors}
        autoScroll={false}
        onDragStart={({ active, activatorEvent }) => {
          sourceDragActiveRef.current = true
          dropAcceptedRef.current = false
          const tile =
            activatorEvent.target instanceof Element
              ? activatorEvent.target.closest<HTMLElement>(
                  "[data-particle-tile]"
                )
              : null
          const handle = active.rect.current.initial
          setDragSnapshot(
            tile && handle ? captureParticleDragPreview(tile, handle) : null
          )
        }}
        onDragCancel={() => {
          sourceDragActiveRef.current = false
          sourceDragEndedAtRef.current = performance.now()
          setDragSnapshot(null)
        }}
        onDragEnd={({ active, delta, activatorEvent }) => {
          sourceDragActiveRef.current = false
          sourceDragEndedAtRef.current = performance.now()
          setDragSnapshot(null)
          const selected = controller.sources.find(
            (entry) =>
              particleSourceKey(entry.ref) === active.data.current?.sourceKey
          )
          const initial =
            "touches" in activatorEvent
              ? (activatorEvent as TouchEvent).touches[0]
              : (activatorEvent as MouseEvent)
          if (!selected || !initial || !controller.canvas.current) return
          const point = {
            x: initial.clientX + delta.x,
            y: initial.clientY + delta.y,
          }
          const rect = controller.canvas.current.getBoundingClientRect()
          const target = document.elementFromPoint(point.x, point.y)
          if (
            !target?.closest("[data-workspace-canvas-flow-frame]") ||
            target.closest("[data-workspace-data-drawer-body]")
          )
            return
          if (
            point.x < rect.left ||
            point.x > rect.right ||
            point.y < rect.top ||
            point.y > rect.bottom
          )
            return
          dropAcceptedRef.current = controller.add(selected.ref, point)
        }}
      >
        {children}
        {typeof document !== "undefined"
          ? createPortal(
              <DragOverlay
                adjustScale={false}
                dropAnimation={dropAnimation}
                style={{ pointerEvents: "none" }}
              >
                {dragSnapshot ? (
                  <ParticleDragPreview snapshot={dragSnapshot} />
                ) : null}
              </DragOverlay>,
              document.body
            )
          : null}
      </DndContext>
      <span className="sr-only" role="status" aria-live="polite">
        {controller.announcement}
      </span>
    </ParticleContext.Provider>
  )
}
