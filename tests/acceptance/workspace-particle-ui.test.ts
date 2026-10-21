import { useParticleCloseGuard } from "@/features/workspace-particles/hooks/use-particle-close-guard"
import { ParticleLibraryTile } from "@/features/workspace-particles/components/particle-library-tile"
import { ParticleAddControl } from "@/features/workspace-particles/components/particle-add-control"
import { ParticlePresetGallery } from "@/features/workspace-particles/components/particle-preset-gallery"
import { ReactGrabPreview } from "@/components/dev/react-grab-preview"
import { WorkspaceWindowControls } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-window-controls"
import { ParticleConnections } from "@/features/workspace-particles/components/particle-connections"
import { Position, ReactFlowProvider, type EdgeProps } from "@xyflow/react"
import {
  ParticleEdge,
  type ParticleFlowEdge,
} from "@/features/workspace-particles/components/particle-edge"
import { ParticleLayoutActions } from "@/features/workspace-particles/components/particle-layout-controls"
import {
  createWorkspaceWindowMotionDriver,
  WORKSPACE_WINDOW_MOTION,
  workspaceWindowTransition,
  resolveWorkspaceWindowOrigin,
  readWorkspaceReducedMotion,
  subscribeWorkspaceReducedMotion,
  workspaceReducedMotionServerSnapshot,
} from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-content-window-motion"
import { spring } from "motion"
import {
  Children,
  createElement,
  isValidElement,
  type ReactNode,
} from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import {
  ParticleFrame,
  ParticleHeader,
  ParticleBody,
  ParticleFooter,
} from "@/features/workspace-particles/components/particle-frame"
import { PARTICLE_PREVIEWS } from "@/features/workspace-particles/components/particle-preview"
import { ParticleComposer } from "@/features/workspace-particles/components/particle-composer"
import { ParticleCreateActions } from "@/features/workspace-particles/components/particle-create-actions"
import { ParticleInspector } from "@/features/workspace-particles/components/particle-inspector"
import { parseParticleCreateCommand } from "@/features/workspace-particles/lib/particle-command"
import {
  particleInspectorMaxWidth,
  replaceParticleSteps,
} from "@/features/workspace-particles/lib/particle-editing"
import { particleConnectionsToFlow } from "@/features/workspace-particles/lib/particle-flow-adapters"
import { particleSchema } from "@/features/workspace-particles/lib/particle-schema"
import { graph, particle, edge, ID } from "./fixtures/particle-fixtures"

import { ParticleLibrary } from "@/features/workspace-particles/components/particle-library"
import { filterParticleLibrary } from "@/features/workspace-particles/lib/particle-library"
import {
  normalizeWorkspaceDrawerTab,
  getWorkspaceDrawerPath,
} from "@/lib/workspace/routes"
import { requestWorkspaceDrawerNavigation } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-drawer-navigation"
import { useWorkspaceDrawerNavigation } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/use-workspace-drawer-navigation"

import { resolveWorkspaceContentWindowGeometry } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-content-window-geometry"
import { useWorkspaceContentWindow } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/use-workspace-content-window"
import { WorkspaceContentWindow } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-content-window"
import { Tabs } from "@/components/ui/tabs"
import { WorkspaceRetainedPanel } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-retained-panel"

const libraryProps = {
  editable: true,
  canEdit: true,
  pending: false,
  error: null,
  onCreate: async () => true,
  onRetry: () => {},
}

describe("Particle library and guarded navigation", () => {
  it.each(["people", "documents", "particles", "tools", "accelerator"])(
    "selects %s synchronously before reopening a closed window",
    (destination) => {
      const updates: unknown[] = []
      let navigate: (value: string) => void = () => {
        throw new Error("Navigation not mounted")
      }
      function NavigationHarness() {
        navigate = useWorkspaceDrawerNavigation({
          tab: "organization",
          activeSnapPoint: "68px",
          setTab: (value) => {
            updates.push(["tab", value])
          },
          onSnap: (value) => {
            updates.push(["snap", value])
          },
          uiPreferencesScope: { orgId: "navigation-test", viewerId: "viewer" },
          retainOnParticleClear: () => {},
        }).handleTabChange
        return null
      }
      renderToStaticMarkup(createElement(NavigationHarness))
      navigate(destination)
      expect(updates).toEqual([
        ["tab", destination],
        ["snap", 0.48],
      ])
    }
  )

  it("toggles the selected panel closed and restores it on the next click", () => {
    for (const snapPoint of [0.48, "68px"] as const) {
      const onSnap = vi.fn()
      let navigation: ReturnType<typeof useWorkspaceDrawerNavigation> | undefined
      function Harness() {
        navigation = useWorkspaceDrawerNavigation({ tab: "tools", activeSnapPoint: snapPoint, setTab: vi.fn(), onSnap,
          uiPreferencesScope: { orgId: "test", viewerId: "viewer" }, retainOnParticleClear: vi.fn() })
        return null
      }
      renderToStaticMarkup(createElement(Harness))
      navigation!.handleTabOpen("tools", true)
      expect(onSnap).toHaveBeenCalledWith(snapPoint === "68px" ? 0.48 : "68px")
    }
  })
  it("defers the complete destination until the custom discard dialog accepts", () => {
    const onSnap = vi.fn(), setTab = vi.fn(), retain = vi.fn()
    let resume: (() => void) | undefined
    let navigation: ReturnType<typeof useWorkspaceDrawerNavigation> | undefined
    function Harness() {
      navigation = useWorkspaceDrawerNavigation({ tab: "tools", activeSnapPoint: 0.48, setTab, onSnap,
        uiPreferencesScope: { orgId: "test", viewerId: "viewer" }, retainOnParticleClear: retain, particleSelectionId: "editing",
        onCloseParticleInspector: (accepted) => { resume = accepted; return false } })
      return null
    }
    renderToStaticMarkup(createElement(Harness))
    navigation!.handleTabChange("documents")
    expect(setTab).not.toHaveBeenCalled()
    expect(onSnap).not.toHaveBeenCalled()
    expect(retain).not.toHaveBeenCalled()
    resume!()
    expect(setTab).toHaveBeenCalledWith("documents")
    expect(onSnap).toHaveBeenCalledWith(0.48)
    expect(retain).toHaveBeenCalledOnce()
  })

  it("does not mount an unseen or collapsed module before it is opened", () => {
    let renders = 0
    function ModuleDraft() {
      renders++
      return createElement("input", { defaultValue: "Draft" })
    }
    const render = (
      activeTab: "particles" | "organization",
      visible: boolean
    ) =>
      renderToStaticMarkup(
        createElement(
          Tabs,
          { value: activeTab },
          createElement(
            WorkspaceRetainedPanel,
            { activeTab, visible, value: "particles" },
            createElement(ModuleDraft)
          )
        )
      )
    expect(render("organization", true)).not.toContain("Draft")
    expect(render("particles", false)).not.toContain("Draft")
    expect(renders).toBe(0)
    expect(render("particles", true)).toContain("Draft")
    expect(renders).toBe(1)
  })

  it("registers the canonical destination without enabling Finance", () => {
    expect(normalizeWorkspaceDrawerTab(" particles ")).toBe("particles")
    expect(getWorkspaceDrawerPath({ tab: "particles" })).toBe(
      "/workspace?drawer=particles"
    )
    expect(normalizeWorkspaceDrawerTab("finance")).toBeNull()
  })

  it("keeps canceled navigation atomic and does not prompt for invalid destinations", () => {
    const current = { tab: "organization" as const, snapPoint: "68px" }
    let prompts = 0
    const reject = () => {
      prompts++
      return false
    }
    expect(requestWorkspaceDrawerNavigation(current, "particles", reject)).toBe(
      current
    )
    expect(prompts).toBe(1)
    expect(requestWorkspaceDrawerNavigation(current, "finance", reject)).toBe(
      current
    )
    expect(prompts).toBe(1)
    expect(
      requestWorkspaceDrawerNavigation(current, "particles", () => true)
    ).toEqual({ tab: "particles", snapPoint: 0.48 })
    expect(
      requestWorkspaceDrawerNavigation(
        { ...current, snapPoint: 1 },
        "particles",
        () => true
      )
    ).toEqual({ tab: "particles", snapPoint: 1 })
  })

  it("restores the selected tab without collapsing it or resetting its height", () => {
    for (const snapPoint of [0.48, 1]) {
      const current = { tab: "particles" as const, snapPoint }
      expect(
        requestWorkspaceDrawerNavigation(current, "particles", () => true)
      ).toEqual(current)
    }
  })

  it("searches titles and type labels without duplicating or changing records", () => {
    const calendar = { ...particle(1, "calendar"), title: "Community outreach" }
    const activity = { ...particle(2), title: "Community event" }
    const records = [calendar, activity]
    expect(filterParticleLibrary(records, "  CALENDAR community ")).toEqual([
      calendar,
    ])
    expect(filterParticleLibrary(records, "unmatched")).toEqual([])
    expect(filterParticleLibrary(records, "")[0]).toBe(calendar)
    expect(records).toEqual([calendar, activity])
  })

  it("lists available records including legacy types without duplicate creation controls", () => {
    const types = [
      "objective",
      "activity",
      "calendar",
      "people",
      "decision",
      "metric",
      "workflow",
      "finance",
    ] as const
    const records = types.map((type, index) => ({
      ...particle(index + 1, type),
      title: `Record ${type}`,
      canvasHidden: true,
    }))
    const html = renderToStaticMarkup(
      createElement(ParticleLibrary, { ...libraryProps, particles: records })
    )
    expect(html).not.toContain("8 of 8")
    for (const record of records) {
      expect(html).toContain(record.title)
      expect(html).not.toContain(`aria-label="Open ${record.title}"`)
    }
    expect(html).not.toContain('aria-label="Add Particle"')
  })

  it("keeps read-only records accessible while hiding creation", () => {
    const html = renderToStaticMarkup(
      createElement(ParticleLibrary, {
        ...libraryProps,
        canEdit: false,
        editable: false,
        particles: [{ ...particle(1), canvasHidden: true }],
      })
    )
    expect(html).toContain("View only")
    expect(html).toContain(particle(1).title)
    expect(html).not.toContain(`aria-label="Open ${particle(1).title}"`)
    expect(html).not.toContain('aria-label="Add Particle"')
  })

  it("distinguishes unavailable data from an empty graph and shows retry failures", () => {
    const unavailable = renderToStaticMarkup(
      createElement(ParticleLibrary, {
        ...libraryProps,
        particles: null,
        editable: false,
        error: "Unable to load Particles",
      })
    )
    expect(unavailable).toContain("Unable to load Particles")
    expect(unavailable).toContain("Retry")
    expect(unavailable).not.toContain("No Particles yet")
    const empty = renderToStaticMarkup(
      createElement(ParticleLibrary, { ...libraryProps, particles: [] })
    )
    expect(empty).toContain("No Particles yet")
  })
})

describe("Particle presentation boundary", () => {
  it("exposes the same real creation actions in a labeled group and respects read-only access", () => {
    const html = renderToStaticMarkup(
      createElement(ParticleCreateActions, {
        disabled: true,
        onCreate: async () => true,
      })
    )
    expect(html).toContain('aria-label="Add Particle"')
    expect(html).toContain("Objective")
    expect(html).toContain("Activity")
    expect(html).not.toContain("Workflow")
    expect(html.match(/disabled=""/g)).toHaveLength(2)
  })

  it("keeps command errors and retry visible and announces pending saves", () => {
    const props = {
      disabled: false,
      pending: false,
      saved: false,
      onCreate: async () => true,
      onRetry: () => {},
    }
    const error = renderToStaticMarkup(
      createElement(ParticleComposer, { ...props, error: "Save failed" })
    )
    expect(error).toContain('aria-invalid="true"')
    expect(error).toContain("Save failed")
    expect(error).toContain("Retry")
    const pending = renderToStaticMarkup(
      createElement(ParticleComposer, { ...props, pending: true, error: null })
    )
    expect(pending).toContain('aria-label="Saving Particle"')
    expect(pending).toContain('aria-live="polite"')
    expect(pending.match(/disabled=""/g)).toHaveLength(3)
  })

  it("keeps shared header, body, footer order and readable selection/status", () => {
    const html = renderToStaticMarkup(
      createElement(
        ParticleFrame,
        { selected: true },
        createElement(ParticleHeader, {
          title: "Community gathering",
          icon: null,
        }),
        createElement(ParticleBody, null, "Checklist"),
        createElement(ParticleFooter, null, "Open activity")
      )
    )
    expect(html.indexOf('data-workspace-node-part="header"')).toBeLessThan(
      html.indexOf('data-workspace-node-part="body"')
    )
    expect(html.indexOf('data-workspace-node-part="body"')).toBeLessThan(
      html.indexOf('data-workspace-node-part="footer"')
    )
    expect(html).not.toContain("In progress")
    expect(html).not.toContain('data-react-grab-owner-slot="type"')
    expect(html).toContain("ring-ring")
  })

  it("renders all eight empty previews without invented results", () => {
    for (const type of [
      "objective",
      "activity",
      "workflow",
      "calendar",
      "people",
      "decision",
      "metric",
      "finance",
    ] as const) {
      const html = renderToStaticMarkup(
        createElement(PARTICLE_PREVIEWS[type], {
          particle: particle(1, type),
          editable: false,
          onEdit: () => {},
          onOpen: () => {},
        })
      )
      expect(html.length).toBeGreaterThan(0)
      expect(html).not.toContain("NaN")
      expect(html).not.toContain("Infinity")
    }
  })

  it("derives checklist progress and disabled viewer controls from records", () => {
    const activity = replaceParticleSteps(particle(1), [
      { id: ID(2), title: "Venue", status: "done", order: 0 },
      { id: ID(3), title: "Invitations", status: "backlog", order: 1 },
    ])
    const html = renderToStaticMarkup(
      createElement(PARTICLE_PREVIEWS.activity, {
        particle: activity,
        editable: false,
        onEdit: () => {},
        onOpen: () => {},
      })
    )
    expect(html).toContain("1 of 2 complete")
    expect(html).toContain('aria-valuenow="50"')
    expect(html).toContain('data-state="checked"')
    expect(html).toContain('disabled=""')
  })

  it("retains the activity template when replacing checklist records", () => {
    const activity = replaceParticleSteps(particle(1), [
      { id: ID(2), title: "Venue", status: "done", order: 0 },
    ])
    expect(particleSchema.safeParse(activity).success).toBe(true)
    expect(activity.type === "activity" && activity.data.template).toBe("task")
    const objective = particle(3, "objective")
    expect(replaceParticleSteps(objective, [])).toBe(objective)
  })

  it("renders labeled objective fields in the inspector with no generic heading", () => {
    const html = renderToStaticMarkup(
      createElement(ParticleInspector, {
        particle: particle(1, "objective"),
        editable: true,
        pending: false,
        onSave: async () => true,
        onClose: () => {},
        onDirtyChange: () => {},
      })
    )
    expect(html).toContain("Target")
    expect(html).toContain("Description")
    expect(html).toContain("Save changes")
    expect(html).toContain("min-h-36")
    expect(html).not.toContain("Node details")
    expect(html).not.toContain("Next steps")
  })

  it("omits generic status controls from every Particle inspector", () => {
    for (const type of ["objective", "activity", "calendar", "people", "decision", "metric", "workflow", "finance"] as const) {
      const html = renderToStaticMarkup(createElement(ParticleInspector, {
        particle: particle(1, type),
        editable: true,
        pending: false,
        onSave: async () => true,
        onClose: () => {},
        onDirtyChange: () => {},
      }))
      expect(html).not.toContain("Backlog")
      expect(html).not.toMatch(/>Status<|id="[^"]*-status"/)
      expect(html).toContain("Save changes")
    }
  })

  it("only interprets declared creation commands and bounds titles", () => {
    expect(
      parseParticleCreateCommand(" CREATE Objective  Support our community ")
    ).toEqual({
      ok: true,
      value: { type: "objective", title: "Support our community" },
    })
    expect(parseParticleCreateCommand("make something useful").ok).toBe(false)
    expect(parseParticleCreateCommand("create finance Budget").ok).toBe(false)
    expect(parseParticleCreateCommand("create objective").ok).toBe(false)
    expect(
      parseParticleCreateCommand(`create objective ${"x".repeat(241)}`).ok
    ).toBe(false)
  })

  it("keeps persisted edge identities and highlights only the chosen outcome", () => {
    const decision = particle(1, "decision")
    if (decision.type !== "decision") throw new Error("Invalid fixture")
    decision.data.selectedOutcome = "yes"
    const model = graph(
      [decision, particle(2), particle(3)],
      [
        edge(4, 1, 2, {
          relationship: "decision_outcome",
          sourceHandle: "outcome:yes",
          outcome: "yes",
        }),
        edge(5, 1, 3, {
          relationship: "decision_outcome",
          sourceHandle: "outcome:no",
          outcome: "no",
        }),
      ]
    )
    const [yes, no] = particleConnectionsToFlow(model)
    expect(yes).toMatchObject({
      id: ID(4),
      label: "Yes",
      sourceHandle: "outcome:yes",
      style: { opacity: 1, strokeWidth: 2.5 },
    })
    expect(no).toMatchObject({
      id: ID(5),
      label: "Not yet",
      style: { opacity: 0.35 },
    })
  })
})

describe("responsive content window geometry", () => {
  it("uses compact widths for simple editors and roomier widths for structured records", () => {
    for (const type of ["objective", "people", "metric", "finance"] as const)
      expect(particleInspectorMaxWidth(particle(1, type))).toBe(560)
    for (const type of [
      "activity",
      "calendar",
      "decision",
      "workflow",
    ] as const)
      expect(particleInspectorMaxWidth(particle(1, type))).toBe(720)
    const activity = particle(1, "activity")
    if (activity.type !== "activity")
      throw new Error("Invalid activity fixture")
    expect(
      particleInspectorMaxWidth({
        ...activity,
        data: { ...activity.data, widget: { kind: "color", hex: "#abcdef" } },
      })
    ).toBe(560)
  })

  it("centers capped windows, respects small canvases and allows maximizing", () => {
    for (const [availableWidth, maximized, expectedWidth] of [
      [920, false, 560],
      [288, false, 288],
      [1168, true, 1168],
    ] as const) {
      const markup = renderToStaticMarkup(
        createElement(WorkspaceContentWindow, {
          title: "Objective",
          collapsed: false,
          maxWidth: 560,
          windowState: {
            geometry: { width: availableWidth, height: 460 },
            maximized,
            onClose() {},
            onMinimize() {},
            onToggleMaximize() {},
          },
        })
      )
      expect(markup).toContain(`width:${expectedWidth}px`)
      expect(markup).not.toContain("margin-left:")
    }
  })

  it("sizes each destination independently and lets Accelerator use tall screens", () => {
    const canvas = { canvasWidth: 1440, canvasHeight: 1400, dockHeight: 100, maximized: false }
    expect(resolveWorkspaceContentWindowGeometry({ ...canvas, tab: "organization" })).toEqual({ width: 440, height: 1384 })
    expect(resolveWorkspaceContentWindowGeometry({ ...canvas, tab: "people" })).toEqual({ width: 960, height: 560 })
    expect(resolveWorkspaceContentWindowGeometry({ ...canvas, tab: "tools" })).toEqual({ width: 560, height: 360 })
    expect(resolveWorkspaceContentWindowGeometry({ ...canvas, tab: "documents" })).toEqual({ width: 760, height: 560 })
    expect(resolveWorkspaceContentWindowGeometry({ ...canvas, tab: "accelerator" })).toEqual({ width: 1040, height: 1000 })
    expect(resolveWorkspaceContentWindowGeometry({ ...canvas, canvasWidth: 650, tab: "accelerator" })).toEqual({ width: 520, height: 1164 })
    for (const tab of ["organization", "people", "tools", "documents", "accelerator"] as const) {
      const narrow = resolveWorkspaceContentWindowGeometry({ ...canvas, tab, canvasWidth: 390, canvasHeight: 700 })!
      expect(narrow.width).toBeLessThanOrEqual(374)
      expect(narrow.height).toBeLessThanOrEqual(tab === "organization" ? 576 : 464)
      expect(resolveWorkspaceContentWindowGeometry({ ...canvas, tab, maximized: true })).toEqual({ width: 1424, height: tab === "organization" ? 1276 : 1214 })
    }
  })

  it("keeps narrow and short canvases in the same window presentation", () => {
    for (const canvasWidth of [320, 390, 899, 1200]) {
      for (const canvasHeight of [360, 483, 900]) {
        for (const dockHeight of [100, 150]) {
          const geometry = resolveWorkspaceContentWindowGeometry({
            canvasWidth,
            canvasHeight,
            dockHeight,
            maximized: false,
          })
          expect(geometry).not.toBeNull()
          expect(geometry!.width).toBeLessThanOrEqual(canvasWidth - 16)
          expect(geometry!.height).toBeGreaterThan(0)
          expect(geometry!.height + dockHeight + (canvasWidth <= 700 ? 120 : 70) + 16).toBeLessThanOrEqual(
            canvasHeight
          )
        }
      }
    }
    expect(
      resolveWorkspaceContentWindowGeometry({
        canvasWidth: 0,
        canvasHeight: 900,
        dockHeight: 100,
        maximized: false,
      })
    ).toBeNull()
  })
  it("keeps normal and maximized top panels inside the canvas with composer clearance", () => {
    for (const canvasWidth of [900, 1024, 1600]) {
      for (const dockHeight of [116, 158, 210]) {
        const normal = resolveWorkspaceContentWindowGeometry({
          canvasWidth,
          canvasHeight: 900,
          dockHeight,
          maximized: false,
        })!
        const maximized = resolveWorkspaceContentWindowGeometry({
          canvasWidth,
          canvasHeight: 900,
          dockHeight,
          maximized: true,
        })!
        expect(normal.width).toBeLessThanOrEqual(canvasWidth - 16)
        expect(normal.height).toBeLessThanOrEqual(maximized.height)
        expect(maximized.width).toBe(canvasWidth - 16)
        expect(900 - (70 + dockHeight + 8 + maximized.height)).toBe(8)
      }
    }
  })
  it("rejects unmeasured and invalid rectangles", () => {
    for (const canvasWidth of [0, NaN, Infinity]) {
      expect(
        resolveWorkspaceContentWindowGeometry({
          canvasWidth,
          canvasHeight: 800,
          dockHeight: 116,
          maximized: false,
        })
      ).toBeNull()
    }
    expect(
      resolveWorkspaceContentWindowGeometry({
        canvasWidth: 1200,
        canvasHeight: 800,
        dockHeight: -1,
        maximized: false,
      })
    ).toBeNull()
  })
  it("renders one content instance with labeled controls and makes minimized content inert", () => {
    const windowState = {
      geometry: { width: 920, height: 460 },
      maximized: false,
      onClose() {},
      onMinimize() {},
      onToggleMaximize() {},
    }
    for (const collapsed of [true, false]) {
      const markup = renderToStaticMarkup(
        createElement(
          WorkspaceContentWindow,
          {
            windowState,
            collapsed,
            title: "Particles",
          },
          createElement("input", { defaultValue: "Retained draft" })
        )
      )
      expect(markup.match(/Retained draft/g)).toHaveLength(1)
      expect(markup).toContain('aria-label="Close content window"')
      expect(markup).not.toContain('aria-label="Minimize content window"')
      expect(markup).toContain('aria-label="Maximize content window"')
      if (collapsed) expect(markup).toContain('inert=""')
      else expect(markup).not.toContain('inert=""')
    }
  })
})

describe("content window actions", () => {
  function controller(acceptClose: boolean, snap: number | string = 0.48) {
    const onSnap = vi.fn()
    const leaveParticle = vi.fn(() => acceptClose)
    let actions: ReturnType<typeof useWorkspaceContentWindow> | undefined
    function Probe() {
      actions = useWorkspaceContentWindow({
        enabled: true,
        canvasWidth: 1200,
        canvasHeight: 900,
        dockHeight: 116,
        activeSnapPoint: snap,
        onSnap,
        leaveParticle,
        tabsListRef: { current: null },
      })
      return null
    }
    renderToStaticMarkup(createElement(Probe))
    if (!actions) throw new Error("Window controller did not render")
    return { actions, onSnap, leaveParticle }
  }
  it("cancels close without collapsing or moving focus when discard is refused", () => {
    const { actions, onSnap, leaveParticle } = controller(false)
    actions.onClose()
    expect(leaveParticle).toHaveBeenCalledOnce()
    expect(onSnap).not.toHaveBeenCalled()
  })
  it("minimizes without invoking the discard guard; accepted close uses it", () => {
    const schedule = vi.fn()
    vi.stubGlobal("requestAnimationFrame", schedule)
    try {
      const { actions, onSnap, leaveParticle } = controller(true)
      actions.onMinimize()
      expect(leaveParticle).not.toHaveBeenCalled()
      expect(onSnap).toHaveBeenLastCalledWith("68px")
      actions.onClose()
      expect(leaveParticle).toHaveBeenCalledOnce()
      expect(onSnap).toHaveBeenCalledTimes(2)
      expect(schedule).toHaveBeenCalledTimes(2)
    } finally {
      vi.unstubAllGlobals()
    }
  })
  it("maximizes and restores without ending the selected Particle session", () => {
    const normal = controller(true)
    normal.actions.onToggleMaximize()
    expect(normal.onSnap).toHaveBeenCalledWith(1)
    expect(normal.leaveParticle).not.toHaveBeenCalled()
    const full = controller(true, 1)
    full.actions.onToggleMaximize()
    expect(full.onSnap).toHaveBeenCalledWith(0.48)
    expect(full.leaveParticle).not.toHaveBeenCalled()
  })
})

describe("interruptible content window motion", () => {
  function driverFixture() {
    const pending: Array<() => void> = []
    const controls = {
      start: vi.fn(() => new Promise<void>((resolve) => pending.push(resolve))),
      stop: vi.fn(),
      set: vi.fn(),
    }
    return {
      driver: createWorkspaceWindowMotionDriver(controls),
      controls,
      pending,
    }
  }
  it("ignores a stale close completion after reopening", async () => {
    const { driver, pending, controls } = driverFixture()
    const hide = vi.fn()
    const opened = vi.fn()
    driver.animate({ opacity: 0 }, hide)
    driver.animate({ opacity: 1 }, opened)
    pending[0]()
    await Promise.resolve()
    expect(hide).not.toHaveBeenCalled()
    pending[1]()
    await Promise.resolve()
    expect(opened).toHaveBeenCalledOnce()
    expect(controls.stop).not.toHaveBeenCalled()
    expect(controls.set).not.toHaveBeenCalled()
  })
  it("finishes only the final close after rapid close/open/close input", async () => {
    const { driver, pending } = driverFixture()
    const complete = [vi.fn(), vi.fn(), vi.fn()]
    driver.animate({ opacity: 0 }, complete[0])
    driver.animate({ opacity: 1 }, complete[1])
    driver.animate({ opacity: 0 }, complete[2])
    pending[1]()
    pending[0]()
    pending[2]()
    await Promise.resolve()
    expect(complete[0]).not.toHaveBeenCalled()
    expect(complete[1]).not.toHaveBeenCalled()
    expect(complete[2]).toHaveBeenCalledOnce()
  })
  it("cancels pending completion on reduced-motion reset or responsive teardown", async () => {
    for (const operation of ["set", "stop"] as const) {
      const { driver, pending, controls } = driverFixture()
      const hide = vi.fn()
      driver.animate(
        { opacity: 0, scale: WORKSPACE_WINDOW_MOTION.closedScale },
        hide
      )
      if (operation === "set") driver.set({ opacity: 1, scale: 1, x: 0, y: 0 })
      else driver.stop()
      pending[0]()
      await Promise.resolve()
      expect(hide).not.toHaveBeenCalled()
      expect(controls.stop).toHaveBeenCalledOnce()
    }
  })
  it("opens upward from bottom tabs and downward from a top trigger", () => {
    const surface = { left: 200, top: 100, width: 920, height: 460 }
    const left = resolveWorkspaceWindowOrigin(surface, {
      left: 380,
      top: 600,
      width: 100,
      height: 32,
    })
    const right = resolveWorkspaceWindowOrigin(surface, {
      left: 850,
      top: 600,
      width: 100,
      height: 32,
    })
    expect(left.x).toBe(0)
    expect(right.x).toBe(0)
    expect(left.originX).toBeLessThan(right.originX)
    expect(left).toMatchObject({ originY: 1, y: 12 })
    expect(resolveWorkspaceWindowOrigin(surface, { left: 380, top: 50, width: 100, height: 32 })).toMatchObject({ originY: 0, y: -12 })
    expect(
      resolveWorkspaceWindowOrigin(surface, {
        left: -2000,
        top: 4000,
        width: 1,
        height: 1,
      })
    ).toEqual({ originX: 0.08, originY: 1, x: 0, y: 12 })
    expect(resolveWorkspaceWindowOrigin(surface, null)).toEqual({
      originX: 0.5,
      originY: 1,
      x: 0,
      y: 12,
    })
  })
  it("responds promptly and settles without overshoot from rest", () => {
    for (const keyframes of [
      [0, 1],
      [1, 0],
    ]) {
      const animation = spring({ ...WORKSPACE_WINDOW_MOTION.spring, keyframes })
      const samples = Array.from(
        { length: 51 },
        (_, index) => animation.next(index * 10).value
      )
      const direction = keyframes[1] - keyframes[0]
      expect(Math.abs(samples[5] - keyframes[0])).toBeGreaterThan(0.1)
      expect(Math.abs(samples[25] - keyframes[1])).toBeLessThan(0.05)
      samples.forEach((value, index) => {
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
        if (index)
          expect(
            (value - samples[index - 1]) * direction
          ).toBeGreaterThanOrEqual(0)
      })
      expect(samples.at(-1)).toBe(keyframes[1])
    }
  })
  it("keeps fades brief without overriding physical motion or its velocity", () => {
    const opening = workspaceWindowTransition(false)
    const closing = workspaceWindowTransition(true)
    expect(opening.default).toEqual(closing.default)
    expect(opening.default).not.toHaveProperty("duration")
    expect(opening.default).not.toHaveProperty("velocity")
    expect(opening.opacity.type).toBe("tween")
    expect(closing.opacity.duration).toBeLessThanOrEqual(
      opening.opacity.duration
    )
    expect(opening.opacity.duration).toBeLessThanOrEqual(0.2)
  })
  it("reads live reduced-motion changes and removes its listener", () => {
    const media = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    vi.stubGlobal("window", { matchMedia: vi.fn(() => media) })
    try {
      const change = vi.fn()
      const unsubscribe = subscribeWorkspaceReducedMotion(change)
      expect(readWorkspaceReducedMotion()).toBe(false)
      media.matches = true
      expect(readWorkspaceReducedMotion()).toBe(true)
      expect(workspaceReducedMotionServerSnapshot()).toBe(true)
      expect(media.addEventListener).toHaveBeenCalledWith("change", change)
      unsubscribe()
      expect(media.removeEventListener).toHaveBeenCalledWith("change", change)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe("live layout controls and routed connections", () => {
  const edgeProps: EdgeProps<ParticleFlowEdge> = {
    id: ID(90),
    source: ID(1),
    target: ID(2),
    type: "workspace-particle",
    sourceX: 284,
    sourceY: 90,
    targetX: 596,
    targetY: 190,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    data: {
      points: [
        { x: 280, y: 90 },
        { x: 440, y: 90 },
        { x: 440, y: 190 },
        { x: 600, y: 190 },
      ],
    },
    label: "Ready",
    selectable: false,
    deletable: false,
  }
  const renderEdge = (props: EdgeProps<ParticleFlowEdge>) =>
    renderToStaticMarkup(
      createElement(
        ReactFlowProvider,
        null,
        createElement("svg", null, createElement(ParticleEdge, props))
      )
    )
  it("attaches ELK routes to actual handle edges and keeps labels theme-aware", () => {
    const html = renderEdge(edgeProps)
    expect(html).toContain("M 284 90")
    expect(html).toContain("L 596 190")
    expect(html).toContain("Ready")
    expect(html).toContain("var(--card)")
    expect(html).toContain("var(--foreground)")
  })
  it("uses React Flow's attached path when a saved route is stale during dragging", () => {
    const html = renderEdge({ ...edgeProps, sourceX: 310 })
    expect(html).toContain("M310 90")
    expect(html).not.toContain("M 284 90")
  })
  it("exposes cancellation during calculation and disables it once saving starts", () => {
    const layout = {
      measureAll: true,
      busy: true,
      phase: "calculating" as const,
      message: null,
      routes: [],
      run: vi.fn(async () => {}),
      cancel: vi.fn(),
      geometryChanged: vi.fn(),
      undoLayout: vi.fn(async () => {}),
      canUndo: false,
    }
    const calculating = renderToStaticMarkup(
      createElement(ParticleLayoutActions, { layout, disabled: true })
    )
    expect(calculating).toContain('role="status"')
    expect(calculating).toContain("Arranging Particles")
    expect(calculating).toContain("Cancel layout")
    const saving = renderToStaticMarkup(
      createElement(ParticleLayoutActions, {
        layout: { ...layout, phase: "saving" },
        disabled: true,
      })
    )
    expect(saving).toContain("Saving positions")
    const cancelButton = saving.match(
      /<button[^>]*>Cancel layout<\/button>/
    )?.[0]
    expect(cancelButton).toContain("disabled")
  })
})

describe("Particle connection inspector", () => {
  const actions = {
    preview: null,
    valid: vi.fn(() => true),
    connect: vi.fn(async () => true),
    disconnect: vi.fn(async () => true),
    insert: vi.fn(async () => true),
    undoChange: vi.fn(async () => true),
    message: "Connection saved.",
    canUndo: true,
  }
  it("names connected workspace tools and keeps their links when the tool returns to the drawer", () => {
    const input = graph(undefined, [
      edge(10, 1, 2, {
        target: "fiscal-sponsorship",
        targetHandle: "workspace-card-target-left",
        relationship: "related_resource",
      }),
    ])
    for (const visibleToolIds of [[], ["fiscal-sponsorship"]]) {
      const html = renderToStaticMarkup(
        createElement(ParticleConnections, {
          particle: input.particles[0],
          graph: input,
          editable: true,
          actions,
          visibleToolIds,
        })
      )
      expect(html).toContain("Fiscal Sponsorship")
      expect(html).toContain("Related resource")
      expect(html).toContain("Disconnect")
      expect(html).not.toContain("Insert Activity")
      expect(html.includes("In drawer")).toBe(visibleToolIds.length === 0)
    }
  })
  it("renders named connections with insertion and disconnection; history lives in canvas controls", () => {
    const input = graph(undefined, [edge(10, 1, 2)])
    const html = renderToStaticMarkup(
      createElement(ParticleConnections, {
        particle: input.particles[0],
        graph: input,
        editable: true,
        actions,
      })
    )
    expect(html).toContain("Connections")
    expect(html).toContain("Insert Activity between")
    expect(html).toContain("Disconnect")
    expect(html).not.toContain("Undo connection change")
    expect(html).toContain("Relationship")
    expect(html).toContain("Connect to")
    expect(html).toContain('role="status"')
  })
  it("keeps hidden relationships visible without permitting insertion into hidden records", () => {
    const input = graph(
      [particle(1), { ...particle(2), canvasHidden: true }],
      [edge(10, 1, 2)]
    )
    const html = renderToStaticMarkup(
      createElement(ParticleConnections, {
        particle: input.particles[0],
        graph: input,
        editable: true,
        actions,
      })
    )
    expect(html).toContain("In drawer")
    expect(
      html.match(/<button[^>]*aria-label="Insert Activity[^>]*>/)?.[0]
    ).toContain("disabled")
  })
  it("does not offer insertion for feedback or related-resource links", () => {
    const input = graph(undefined, [
      edge(10, 1, 2, { relationship: "feedback" }),
    ])
    const html = renderToStaticMarkup(
      createElement(ParticleConnections, {
        particle: input.particles[0],
        graph: input,
        editable: false,
        actions,
      })
    )
    expect(html).not.toContain("Insert Activity")
    expect(html).toContain("Feedback loop")
    expect(
      html.match(/<button[^>]*aria-label="Disconnect[^>]*>/)?.[0]
    ).toContain("disabled")
  })
})

it("keeps the same connection id and line presentation through optimistic confirmation", () => {
  const preview = edge(10, 1, 2)
  const initial = graph()
  const pending = particleConnectionsToFlow(initial, [], [], preview)
  const committed = particleConnectionsToFlow(
    { ...initial, connections: [{ ...preview, revision: 1 }] },
    [],
    [],
    preview
  )
  expect(pending).toHaveLength(1)
  expect(committed).toHaveLength(1)
  expect(committed[0].id).toBe(pending[0].id)
  expect(committed[0].style).toEqual(pending[0].style)
  expect(committed[0].interactionWidth).toBe(28)
  expect(committed[0].style?.strokeWidth).toBe(2)
  // A failed attempt is removed explicitly, not persisted as a decorative edge.
  expect(particleConnectionsToFlow(initial, [], [], null)).toEqual([])
  expect(initial.connections).toEqual([])
})

describe("compact window controls and inspectable previews", () => {
  it("keeps previews inert during normal use", () => {
    const markup = renderToStaticMarkup(
      createElement(
        ReactGrabPreview,
        null,
        createElement("button", null, "Preview action")
      )
    )
    expect(markup).toContain('inert=""')
    expect(markup).toContain('data-react-grab-granular="true"')
  })
  it("exposes only named close and restore controls", () => {
    const markup = renderToStaticMarkup(
      createElement(WorkspaceWindowControls, {
        windowState: {
          geometry: null,
          maximized: true,
          onClose: vi.fn(),
          onMinimize: vi.fn(),
          onToggleMaximize: vi.fn(),
        },
      })
    )
    expect(markup).toContain('aria-label="Close content window"')
    expect(markup).not.toContain('aria-label="Minimize content window"')
    expect(markup).toContain('aria-label="Restore content window"')
    expect(markup).not.toContain('data-unsaved="true"')
  })
  it("gives repeated previews unique ownership ids", () => {
    const markup = renderToStaticMarkup(
      createElement(
        "div",
        null,
        createElement(ParticleHeader, {
          title: "Repeated",
          icon: null,
        }),
        createElement(ParticleHeader, {
          title: "Repeated",
          icon: null,
        })
      )
    )
    const ids = [...markup.matchAll(/data-react-grab-owner-id="([^"]+)"/g)].map(
      (match) => match[1]
    )
    expect(ids.length).toBeGreaterThan(2)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe("Particle library card layout", () => {
  it(
    "preserves drag/add and full card previews",
    () => {
      const html = renderToStaticMarkup(
        createElement(ParticleLibraryTile, {
          id: ID(1),
          title: "Organization",
          subtitle: "Profile",
          visible: false,
          preview: createElement("p", null, "Heavy preview sentinel"),
          drag: {
            kind: "tool",
            workspaceId: ID(999),
            id: "organization-overview",
          },
          onPlace: () => {},
          disabled: false,
        })
      )
      expect(html).toContain('data-draggable="true"')
      expect(html).toContain('aria-label="Add Organization to canvas"')
      expect(html).not.toContain("Profile")
      expect(html).toContain("Heavy preview sentinel")
      expect(html).toContain("break-inside-avoid")
    }
  )

  it.each([
    ["organization-overview", "Organization"],
    ["programs", "Activities"],
    ["fiscal-sponsorship", "Fiscal Sponsorship"],
  ] as const)(
    "keeps %s add actionable without the duplicate masonry row",
    (id, title) => {
      const onPlace = vi.fn()
      const tile = ParticleLibraryTile({
        id,
        title,
        subtitle: "Duplicate metadata sentinel",
        visible: false,
        preview: createElement("p", null, "Real preview"),
        drag: { kind: "tool", workspaceId: ID(999), id },
        onPlace,
        disabled: false,
      })
      const source = Children.toArray(tile.props.children).find((child) =>
        isValidElement<{ children?: ReactNode }>(child)
      )
      if (!isValidElement<{ children?: ReactNode }>(source))
        throw new Error("Missing drag source")
      const control = Children.toArray(source.props.children).find(
        (child) => isValidElement(child) && child.type === ParticleAddControl
      )
      if (!isValidElement<{ onAdd: () => void }>(control))
        throw new Error("Missing Add control")
      control.props.onAdd()
      expect(onPlace).toHaveBeenCalledExactlyOnceWith(true)
      const html = renderToStaticMarkup(tile)
      expect(html).not.toContain("Duplicate metadata sentinel")
      expect(html).toContain(`aria-label="Add ${title} to canvas"`)
      expect(html).not.toContain("On canvas")
    }
  )

  it(
    "preserves preset configure/add and image placement",
    () => {
      const html = renderToStaticMarkup(
        createElement(ParticlePresetGallery, {
          query: "",
          disabled: false,
          workspaceId: ID(999),
          onSelect: () => {},
          onAdd: async () => true,
        })
      )
      expect(html).toContain('aria-label="Add image placeholder"')
      expect(html).toContain('aria-label="Add Image to canvas"')
      expect(html).toContain('aria-label="Configure ')
      expect(html).toContain('data-particle-library-stack="true"')
      expect(html.match(/data-particle-stack-back/g) ?? []).toHaveLength(
        24
      )
    }
  )

  it("retains disabled on-canvas placeholders", () => {
    const html = renderToStaticMarkup(
      createElement(ParticleLibraryTile, {
        id: ID(1),
        title: "Existing",
        subtitle: "Activity",
        visible: true,
        preview: createElement("p", null, "Hidden preview sentinel"),
        drag: { kind: "particle", workspaceId: ID(999), id: ID(1) },
        onPlace: () => {},
        disabled: true,
      })
    )
    expect(html).toContain("On canvas")
    expect(html).toContain("border-dashed")
    expect(html).toContain('aria-label="Remove Existing from canvas"')
    expect(html).toContain('disabled=""')
    expect(html).not.toContain("Hidden preview sentinel")
    expect(html).not.toContain('draggable="true"')
  })


})


describe("custom Particle close guard", () => {
  function guardHarness(dirty = { current: true }, close = vi.fn(() => true), discardBlocked = false) {
    let guard: ReturnType<typeof useParticleCloseGuard> | undefined
    function Harness() {
      guard = useParticleCloseGuard({ dirty, close, selectionId: "draft", discardBlocked })
      return null
    }
    renderToStaticMarkup(createElement(Harness))
    return { guard: guard!, dirty, close }
  }
  it("keeps edits and navigation untouched when canceled", () => {
    const { guard, dirty, close } = guardHarness()
    const resume = vi.fn()
    expect(guard.request(resume)).toBe(false)
    guard.cancel()
    guard.discard()
    expect(dirty.current).toBe(true)
    expect(close).not.toHaveBeenCalled()
    expect(resume).not.toHaveBeenCalled()
  })
  it("discards only after confirmation and resumes the original action once", () => {
    const { guard, dirty, close } = guardHarness()
    const resume = vi.fn()
    expect(guard.request(resume)).toBe(false)
    expect(close).not.toHaveBeenCalled()
    guard.discard()
    guard.discard()
    expect(dirty.current).toBe(false)
    expect(close).toHaveBeenCalledOnce()
    expect(resume).toHaveBeenCalledOnce()
  })
  it("closes a clean editor immediately and preserves existing share guards", () => {
    const clean = guardHarness({ current: false })
    expect(clean.guard.request()).toBe(true)
    expect(clean.close).toHaveBeenCalledWith(true)
    const blocked = guardHarness({ current: true }, vi.fn(() => false), true)
    expect(blocked.guard.request()).toBe(false)
    blocked.guard.discard()
    expect(blocked.dirty.current).toBe(true)
  })
})
