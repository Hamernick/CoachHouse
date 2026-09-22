import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import type { ReactFlowInstance } from "reactflow"
import type { RoadmapSection } from "@/lib/roadmap/types"
import { WorkspaceOrganizationOverviewSummary } from "@/components/workspace/workspace-organization-overview-summary"
import { ParticleRoadmapContent } from "@/features/workspace-particles/components/particle-roadmap-content"
import { particleDisplaySize } from "@/features/workspace-particles/lib/particle-state"
import {
  buildDrivePreviewItem,
  ParticlePreview,
} from "@/features/workspace-particles/components/particle-preview"
import { ParticleTile } from "@/features/workspace-particles/components/particle-tile"
import { ParticleSourceHandle } from "@/features/workspace-particles/components/particle-source-handle"
import { captureParticleDragPreview } from "@/features/workspace-particles/components/particle-drag-preview"
import { animateParticleDrop } from "@/features/workspace-particles/lib/particle-motion"
import type { DropAnimationFunctionArguments } from "@dnd-kit/core"
import * as particleContext from "@/features/workspace-particles/components/particle-context"
import { useWorkspaceParticlesController } from "@/features/workspace-particles/hooks/use-workspace-particles-controller"
import { describe, expect, it, vi } from "vitest"
import {
  activateExistingCanvasNode,
  normalizeWorkspaceParticleState,
  emptyWorkspaceParticleState,
  removeParticle,
  resizeParticle,
  googleParticleUrl,
  isParticleImagePath,
  PARTICLE_SIZES,
  preferNewerParticleState,
  buildParticleSources,
  partitionWorkspaceParticleNodeChanges,
} from "@/features/workspace-particles/client"
import {
  buildDefaultBoardState,
  normalizeWorkspaceBoardState,
} from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-layout"
import {
  mergeNewerPersistedWorkspaceNodeState,
  reconcileWorkspaceBoardSaveResult,
} from "@/app/(dashboard)/my-organization/_lib/workspace-board-state-persistence"
import type { ParticlePlacement } from "@/features/workspace-particles"

const item: ParticlePlacement = {
  id: "particle-mission",
  source: { kind: "roadmap", id: "mission" },
  x: 10,
  y: 20,
  size: "mini",
}
const image = {
  id: "image-one",
  title: "Workshop",
  path: "00000000-0000-0000-0000-000000000001/particles/00000000-0000-0000-0000-000000000002.png",
}
const state = {
  ...emptyWorkspaceParticleState(),
  items: [item],
  images: [image],
  updatedAt: "2026-09-16T06:00:00.000Z",
}

// Callback-only harness: effects never run, so this cannot fetch or persist data.
function controllerHarness(canEdit = true, enabled = true) {
  let controller!: ReturnType<typeof useWorkspaceParticlesController>
  const onChange = vi.fn()
  const onRevealCanvasNode = vi.fn(() => true)
  const flow = {
    getNode: vi.fn(() => undefined),
    fitView: vi.fn(),
    screenToFlowPosition: vi.fn((point: { x: number; y: number }) => point),
  }
  function Harness() {
    controller = useWorkspaceParticlesController({
      state: { ...emptyWorkspaceParticleState(), images: [image] },
      sections: [],
      activities: [],
      canEdit,
      enabled,
      onChange,
      onRevealCanvasNode,
      pickDriveFiles: async () => [],
    })
    return null
  }
  renderToStaticMarkup(createElement(Harness))
  controller.setFlow(flow as unknown as ReactFlowInstance)
  controller.setCanvas({
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      width: 1000,
      height: 800,
    }),
  } as HTMLElement)
  return { controller, onChange, onRevealCanvasNode, flow }
}

describe("workspace particles", () => {
  it("persists each settled position once across both drag-stop callbacks", () => {
    const { controller, onChange } = controllerHarness()
    controller.add({ kind: "image", id: image.id })
    const id = onChange.mock.calls[0][0].items[0].id
    onChange.mockClear()
    const position = { x: 401.2, y: 202.1 }
    controller.onNodesChange([
      { id, type: "position", position, dragging: false },
    ])
    controller.persistPositions([
      { id, type: "workspace-particle", position, data: {} },
    ])
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][0].items[0]).toMatchObject({ x: 401, y: 202 })
    onChange.mockClear()
    const next = { x: 450, y: 250 }
    controller.persistPositions([
      { id, type: "workspace-particle", position: next, data: {} },
    ])
    controller.onNodesChange([
      { id, type: "position", position: next, dragging: false },
    ])
    expect(onChange).toHaveBeenCalledTimes(1)
  })
  it("fades accepted drops in place, returns canceled drags, and respects reduced motion", async () => {
    const cancel = vi.fn()
    const animate = vi.fn(
      (_frames: Keyframe[], _options: KeyframeAnimationOptions) => ({
        finished: Promise.resolve(),
        cancel,
      })
    )
    const args = {
      dragOverlay: { node: { animate }, rect: { left: 700, top: 300 } },
      active: { rect: { left: 600, top: 200 } },
      transform: { x: 100, y: 100, scaleX: 1, scaleY: 1 },
    } as unknown as DropAnimationFunctionArguments
    await animateParticleDrop(args, true)
    expect(animate.mock.calls[0]).toEqual([
      [
        { transform: "translate3d(100px, 100px, 0)", opacity: 1 },
        { transform: "translate3d(100px, 100px, 0)", opacity: 0 },
      ],
      expect.objectContaining({ duration: 140 }),
    ])
    await animateParticleDrop(args, false)
    expect(animate.mock.calls[1][0][1]).toEqual({
      transform: "translate3d(0px, 0px, 0)",
      opacity: 0,
    })
    expect(cancel).toHaveBeenCalledTimes(2)
    vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) })
    try {
      await animateParticleDrop(args, true)
      expect(animate).toHaveBeenCalledTimes(2)
    } finally {
      vi.unstubAllGlobals()
    }
  })
  it("commits one placement when the same source is activated twice before rerender", () => {
    const { controller, onChange, flow } = controllerHarness()
    const ref = { kind: "image" as const, id: image.id }
    expect(controller.add(ref)).toBe(true)
    expect(controller.add(ref, { x: 700, y: 500 })).toBe(false)
    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0][0]
    expect(next.items).toHaveLength(1)
    expect(flow.fitView).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: [{ id: next.items[0].id }],
      })
    )
  })
  it("renders saved roadmap sizes as file icons without rewriting placements", () => {
    for (const size of ["icon", "mini", "large"] as const) {
      const saved = { ...item, size }
      expect(particleDisplaySize(saved.source, saved.size)).toBe("icon")
      expect(saved.size).toBe(size)
      expect(
        particleDisplaySize({ kind: "roadmap", id: "board_calendar" }, size)
      ).toBe(size)
      expect(particleDisplaySize({ kind: "image", id: image.id }, size)).toBe(
        size
      )
    }
  })
  it("centers a new particle on the supplied desktop drop coordinates", () => {
    const { controller, onChange } = controllerHarness()
    expect(
      controller.add({ kind: "image", id: image.id }, { x: 700, y: 500 })
    ).toBe(true)
    expect(onChange.mock.calls[0][0].items[0]).toMatchObject({
      x: 700 - PARTICLE_SIZES.mini.width / 2,
      y: 500 - PARTICLE_SIZES.mini.height / 2,
    })
  })
  it("reveals an existing Activity card without committing a new particle", () => {
    const { controller, onChange, onRevealCanvasNode } = controllerHarness()
    expect(controller.add({ kind: "activity", id: "workspace-activity" })).toBe(
      true
    )
    expect(onRevealCanvasNode).toHaveBeenCalledWith("programs", undefined)
    expect(onChange).not.toHaveBeenCalled()
  })
  it.each([
    [false, true],
    [true, false],
  ])(
    "blocks controller writes with canEdit=%s and enabled=%s",
    (canEdit, enabled) => {
      const { controller, onChange, flow, onRevealCanvasNode } =
        controllerHarness(canEdit, enabled)
      expect(controller.add({ kind: "image", id: image.id })).toBe(false)
      expect(
        controller.add({ kind: "activity", id: "workspace-activity" })
      ).toBe(false)
      controller.remove("nonexistent")
      controller.resize("nonexistent", "large")
      expect(onChange).not.toHaveBeenCalled()
      expect(flow.fitView).not.toHaveBeenCalled()
      expect(onRevealCanvasNode).not.toHaveBeenCalled()
    }
  )
  it("round-trips linked references, sizes, images and positions through board storage", () => {
    const board = normalizeWorkspaceBoardState({
      ...buildDefaultBoardState(),
      particles: state,
    })
    expect(board.particles).toEqual(state)
    expect(JSON.stringify(board.particles)).not.toContain("content")
  })
  it("recovers particles after an older client saves only the compatibility envelope", () => {
    const board = normalizeWorkspaceBoardState({
      ...buildDefaultBoardState(),
      particles: state,
    })
    const { particles: _particles, ...olderClientPayload } = board
    expect(normalizeWorkspaceBoardState(olderClientPayload).particles).toEqual(
      state
    )
  })
  it("leaves older boards without particles unchanged", () => {
    expect(
      normalizeWorkspaceBoardState(buildDefaultBoardState()).particles
    ).toBeUndefined()
  })
  it("deduplicates sources and drops malformed or non-finite placements", () => {
    const normalized = normalizeWorkspaceParticleState({
      items: [
        item,
        { ...item, id: "particle-duplicate" },
        { ...item, id: "bad" },
        { ...item, x: Infinity },
        null,
        { ...item, source: { kind: "script", id: "x" } },
      ],
    })
    expect(normalized.items).toEqual([item])
  })
  it("removes legacy duplicate organization and activity placements", () => {
    const organizationItem: ParticlePlacement = {
      ...item,
      id: "particle-organization",
      source: { kind: "organization", id: "organization-one" },
    }
    const activityItem: ParticlePlacement = {
      ...item,
      id: "particle-activity",
      source: { kind: "activity", id: "workspace-activity" },
    }

    expect(
      normalizeWorkspaceParticleState({
        items: [organizationItem, activityItem],
      }).items
    ).toEqual([])
  })
  it("builds linked organization and activity sources from Workspace data", () => {
    const sources = buildParticleSources(
      [],
      [],
      [],
      {
        id: "organization-one",
        title: "Southside Community Table",
        subtitle: "Neighborhood meals and mentoring",
        logoUrl: "https://example.com/logo.png",
        headerUrl: "https://example.com/header.jpg",
        programsCount: 3,
        peopleCount: 12,
        fundingGoalCents: 1000000,
        raisedCents: 250000,
      },
      [
        {
          id: "calendar:event-one",
          source: "calendar",
          status: "scheduled",
          title: "Board meeting",
          timestamp: "2026-09-20T18:00:00.000Z",
          href: "/my-organization?tab=calendar",
        },
      ]
    )

    expect(sources).toEqual([
      expect.objectContaining({
        ref: { kind: "organization", id: "organization-one" },
        title: "Southside Community Table",
        href: "/workspace?drawer=organization",
        canvasNodeId: "organization-overview",
        organization: expect.objectContaining({
          logoUrl: "https://example.com/logo.png",
          headerUrl: "https://example.com/header.jpg",
        }),
      }),
      expect.objectContaining({
        ref: { kind: "activity", id: "workspace-activity" },
        title: "Activity",
        canvasNodeId: "programs",
        activities: [
          expect.objectContaining({
            id: "calendar:event-one",
            title: "Board meeting",
          }),
        ],
      }),
    ])
  })
  it("moves an existing Workspace card instead of creating a particle", () => {
    const onPlace = vi.fn(() => true)
    const flow = {
      getNode: vi.fn(() => ({
        id: "programs",
        position: { x: 20, y: 30 },
        width: 300,
        height: 200,
      })),
      screenToFlowPosition: vi.fn((point) => point),
    } as unknown as ReactFlowInstance

    expect(
      activateExistingCanvasNode({
        flow,
        source: {
          ref: { kind: "activity", id: "workspace-activity" },
          title: "Activity",
          description: "Current activity",
          available: true,
          canvasNodeId: "programs",
        },
        point: { x: 500, y: 400 },
        onPlace,
      })
    ).toBe("moved")
    expect(onPlace).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "programs",
        position: { x: 350, y: 300 },
      })
    )
  })
  it("reveals a hidden Workspace card at the requested canvas point", () => {
    const onReveal = vi.fn(() => true)
    const flow = {
      getNode: vi.fn(() => undefined),
      screenToFlowPosition: vi.fn(() => ({ x: 420, y: 310 })),
    } as unknown as ReactFlowInstance

    expect(
      activateExistingCanvasNode({
        flow,
        source: {
          ref: { kind: "organization", id: "organization-one" },
          title: "Organization",
          description: "Organization overview",
          available: true,
          canvasNodeId: "organization-overview",
        },
        point: { x: 500, y: 400 },
        onReveal,
      })
    ).toBe("moved")
    expect(onReveal).toHaveBeenCalledWith("organization-overview", {
      x: 420,
      y: 310,
    })
  })
  it("bounds canvas coordinates and the number of rendered items", () => {
    const items = Array.from({ length: 120 }, (_, index) => ({
      ...item,
      id: `particle-${index}`,
      source: { kind: "roadmap", id: `section-${index}` },
      x: 999999,
      y: -999999,
    }))
    const normalized = normalizeWorkspaceParticleState({ items })
    expect(normalized.items).toHaveLength(100)
    expect(normalized.items[0]).toMatchObject({ x: 50000, y: -50000 })
  })
  it("partitions particle changes before the main canvas pipeline", () => {
    const particleChange = {
      id: "particle-mission",
      type: "position" as const,
      position: { x: 20, y: 30 },
      dragging: true,
    }
    const workspaceChange = {
      id: "organization-overview",
      type: "select" as const,
      selected: true,
    }

    expect(
      partitionWorkspaceParticleNodeChanges([particleChange, workspaceChange])
    ).toEqual({
      particleChanges: [particleChange],
      workspaceChanges: [workspaceChange],
    })
  })
  it("removes only the placement and related connections, preserving the source image", () => {
    const next = removeParticle(
      {
        ...state,
        connections: [
          { id: "edge", source: item.id, target: "organization-overview" },
        ],
      },
      item.id
    )
    expect(next.items).toEqual([])
    expect(next.connections).toEqual([])
    expect(next.images).toEqual([image])
  })
  it("keeps the visual center fixed through all three size changes", () => {
    for (const size of ["icon", "mini", "large"] as const) {
      const next = resizeParticle(item, size)
      expect(next.x + PARTICLE_SIZES[size].width / 2).toBe(
        item.x + PARTICLE_SIZES.mini.width / 2
      )
      expect(next.y + PARTICLE_SIZES[size].height / 2).toBe(
        item.y + PARTICLE_SIZES.mini.height / 2
      )
    }
  })
  it("rejects dangling, duplicate, self and non-particle connections", () => {
    const edge = {
      id: "edge",
      source: item.id,
      target: "organization-overview",
    }
    const next = normalizeWorkspaceParticleState({
      ...state,
      connections: [
        edge,
        edge,
        { ...edge, target: item.id },
        { ...edge, target: "particle-missing" },
        { ...edge, source: "one", target: "two" },
      ],
    })
    expect(next.connections).toHaveLength(1)
    expect(next.connections[0]).toMatchObject({
      source: item.id,
      target: "organization-overview",
    })
  })
  it("preserves particles across stale saves and applies the saved particle result", () => {
    const older = { ...state, items: [], updatedAt: "2026-09-16T05:00:00Z" }
    const incoming = { ...buildDefaultBoardState(), particles: older }
    const persisted = { ...incoming, particles: state }
    expect(
      mergeNewerPersistedWorkspaceNodeState({ incoming, persisted }).particles
    ).toEqual(state)
    expect(
      reconcileWorkspaceBoardSaveResult({ current: incoming, persisted })
        .particles
    ).toEqual(state)
    expect(preferNewerParticleState(undefined, state)).toBe(state)
  })
  it("constructs Google editor links from validated IDs rather than supplied URLs", () => {
    expect(
      googleParticleUrl({
        id: "attachment-uuid",
        fileId: "abc_123",
        name: "Doc",
        mimeType: "application/vnd.google-apps.document",
        status: "available",
      })
    ).toBe("https://docs.google.com/document/d/abc_123/edit")
    expect(
      googleParticleUrl({
        id: "attachment-uuid",
        fileId: "../malicious",
        name: "Doc",
        mimeType: "text/html",
        status: "available",
      })
    ).toBeNull()
  })
  it("uses the attachment ID for the authenticated Drive thumbnail", () => {
    const document = {
      id: "attachment-uuid",
      fileId: "provider-file-id",
      name: "Board packet",
      mimeType: "application/vnd.google-apps.document",
      webViewLink: "https://docs.google.com/document/d/provider-file-id/edit",
      modifiedAt: "2026-09-18T12:00:00.000Z",
      status: "available" as const,
    }
    const item = buildDrivePreviewItem(document)
    const html = renderToStaticMarkup(
      createElement(ParticlePreview, {
        source: {
          ref: { kind: "drive", id: document.id },
          title: document.name,
          description: "Linked Google Drive file.",
          available: true,
          document,
        },
      })
    )

    expect(item.previewPath).toBe(
      "/api/integrations/google-drive/documents/attachment-uuid/preview"
    )
    expect(item.previewPath).not.toContain(document.fileId)
    expect(item.fileType).toBe("document")
    expect(html).toContain("Board packet Google Drive preview")
    expect(html).not.toContain("<button")
  })
  it("keeps Drive reconnect state compact and skips preview markup", () => {
    const html = renderToStaticMarkup(
      createElement(ParticlePreview, {
        source: {
          ref: { kind: "drive", id: "attachment-uuid" },
          title: "Board packet",
          description: "Reconnect required.",
          available: false,
          document: {
            id: "attachment-uuid",
            fileId: "provider-file-id",
            name: "Board packet",
            mimeType: "application/vnd.google-apps.document",
            status: "needs_reconnect",
          },
        },
      })
    )

    expect(html).toContain("Reconnect Google Drive")
    expect(html).not.toContain("/preview")
  })
  it.each([
    "https://example.com/image.png",
    "../other/image.png",
    image.path.replace(".png", ".svg"),
    image.path + "?token=secret",
  ])("rejects unsafe image references: %s", (path) => {
    expect(isParticleImagePath(path)).toBe(false)
    expect(
      normalizeWorkspaceParticleState({ images: [{ ...image, path }] }).images
    ).toEqual([])
  })
})

describe("linked roadmap rendering", () => {
  const section: RoadmapSection = {
    id: "budget",
    slug: "budget",
    title: "Budget",
    subtitle: "",
    content: "",
    lastUpdated: null,
    isPublic: false,
    layout: "wide",
    status: "in_progress",
    templateTitle: "Budget",
    templateSubtitle: "",
    titleIsTemplate: false,
    subtitleIsTemplate: false,
  }
  it("uses real source media and content in compact catalog previews", () => {
    const sources = buildParticleSources(
      [
        {
          ...section,
          content: "The first lines of the actual roadmap document.",
          imageUrl: "https://example.com/roadmap.jpg",
        },
      ],
      [],
      [],
      {
        id: "organization-one",
        title: "Southside Community Table",
        subtitle: "Neighborhood meals and mentoring",
        logoUrl: "https://example.com/logo.png",
        headerUrl: "https://example.com/header.jpg",
        programsCount: 3,
        peopleCount: 12,
        fundingGoalCents: 1000000,
        raisedCents: 250000,
      },
      [],
      [
        {
          id: "program-one",
          title: "Neighborhood tutoring",
          location: "Chicago, IL",
          description: "Weekly student support.",
          bannerImageUrl: "https://example.com/program.jpg",
          imageUrl: null,
          statusLabel: "Active",
          chips: ["Education"],
          goalCents: 500000,
          raisedCents: 125000,
        },
      ]
    )

    const organizationHtml = renderToStaticMarkup(
      createElement(ParticlePreview, { source: sources[0] })
    )
    const activityHtml = renderToStaticMarkup(
      createElement(ParticlePreview, { source: sources[1] })
    )
    const roadmapHtml = renderToStaticMarkup(
      createElement(ParticlePreview, { source: sources[2] })
    )

    expect(organizationHtml).toContain(
      "url=https%3A%2F%2Fexample.com%2Fheader.jpg"
    )
    expect(organizationHtml).toContain(
      "url=https%3A%2F%2Fexample.com%2Flogo.png"
    )
    expect(organizationHtml).toContain("Objects")
    expect(organizationHtml).toContain("People")
    expect(activityHtml).toContain("Neighborhood tutoring")
    expect(activityHtml).toContain(
      "url=https%3A%2F%2Fexample.com%2Fprogram.jpg"
    )
    expect(activityHtml).not.toContain(">Action<")
    expect(activityHtml).toContain("Program visual")
    expect(activityHtml).toContain("Education")
    expect(activityHtml).toContain("Fundraising Progress")
    expect(activityHtml).toContain("25% funded")
    expect(activityHtml).not.toContain('data-slot="item"')
    expect(roadmapHtml).not.toContain("https://example.com/roadmap.jpg")
    expect(roadmapHtml).not.toContain(
      "first lines of the actual roadmap document"
    )
    expect(roadmapHtml).toContain("lucide-file-text")
  })
  it.each([
    ["complete", "bg-emerald-500", true],
    ["in_progress", "bg-amber-500", false],
    ["not_started", "bg-border", false],
  ] as const)(
    "matches roadmap navigation indicators for %s",
    (status, color, complete) => {
      const html = renderToStaticMarkup(
        createElement(ParticleTile, {
          source: {
            ref: { kind: "roadmap", id: "people" },
            title: "People",
            description: "",
            available: true,
            section: {
              ...section,
              content: "",
              budgetRows: [],
              homework: null,
              status,
            },
          },
        })
      )
      expect(html).toContain(color)
      expect(html.includes("lucide-check")).toBe(complete)
      expect(html.includes("bg-foreground/90")).toBe(complete)
    }
  )
  it("omits every drag control from a view-only tile", () => {
    const context = vi
      .spyOn(particleContext, "useWorkspaceParticles")
      .mockReturnValue({
        canEdit: false,
        state: emptyWorkspaceParticleState(),
      } as unknown as NonNullable<
        ReturnType<typeof particleContext.useWorkspaceParticles>
      >)
    try {
      const html = renderToStaticMarkup(
        createElement(ParticleTile, {
          source: {
            ref: { kind: "roadmap", id: "need" },
            title: "Need",
            description: "Test",
            available: true,
          },
        })
      )
      expect(html).not.toContain("<button")
      expect(html).not.toContain("data-particle-source=")
      expect(html).toContain("Need")
    } finally {
      context.mockRestore()
    }
  })
  it("uses one accessible double-click grip without a separate add action or preview overlay", () => {
    const context = vi
      .spyOn(particleContext, "useWorkspaceParticles")
      .mockReturnValue({
        canEdit: true,
        state: emptyWorkspaceParticleState(),
        addFromSourceClick: vi.fn(),
      } as unknown as NonNullable<
        ReturnType<typeof particleContext.useWorkspaceParticles>
      >)
    try {
      const html = renderToStaticMarkup(
        createElement(ParticleTile, {
          source: {
            ref: { kind: "roadmap", id: "need" },
            title: "Need",
            description: "Test",
            available: true,
          },
        })
      )
      expect(html).toContain("lucide-grip-vertical")
      expect(html.match(/<button/g)).toHaveLength(1)
      expect(html).not.toContain("absolute inset-0")
      expect(html).toContain('inert=""')
      expect(html).not.toContain('tabindex="-1"')
      expect(html).not.toContain("lucide-plus")
      expect(html).not.toContain("lucide-check")
      expect(html).toContain(
        'aria-label="Drag Need to canvas, or double-click or press Enter to add"'
      )
      expect(html).toContain("size-6")
    } finally {
      context.mockRestore()
    }
  })
  it("keeps the complete drag tile size and grip offset, including SVG artwork references", () => {
    const element = (initial: Record<string, string>) => {
      const attributes = new Map(Object.entries(initial))
      return {
        get id() {
          return attributes.get("id") ?? ""
        },
        get attributes() {
          return [...attributes].map(([name, value]) => ({ name, value }))
        },
        getAttribute: (name: string) => attributes.get(name),
        setAttribute: vi.fn((name: string, value: string) =>
          attributes.set(name, value)
        ),
        removeAttribute: (name: string) => attributes.delete(name),
        style: { width: "", height: "", margin: "" },
      }
    }
    const artwork = element({
      id: "artwork",
      fill: "url(#artwork)",
      "aria-labelledby": "tile-title",
      class: "artwork",
      role: "img",
    })
    const clone = {
      ...element({
        id: "tile-title",
        "data-particle-tile": "",
        "data-react-grab-owner-id": "workspace:particles",
        class: "card",
        title: "Calendar",
      }),
      querySelectorAll: () => [artwork],
    }
    const tile = {
      cloneNode: vi.fn(() => clone),
      getBoundingClientRect: () => ({
        left: 300,
        top: 200,
        width: 362,
        height: 408,
      }),
    }
    const snapshot = captureParticleDragPreview(
      tile as unknown as HTMLElement,
      { left: 630, top: 208 }
    )
    expect(tile.cloneNode).toHaveBeenCalledWith(true)
    expect(snapshot).toMatchObject({ width: 362, height: 408, x: -330, y: -8 })
    expect(snapshot.element).toBe(clone)
    expect(clone.style).toEqual({
      width: "362px",
      height: "408px",
      margin: "0",
    })
    expect(clone.getAttribute("inert")).toBe("")
    expect(clone.getAttribute("aria-hidden")).toBe("true")
    expect(clone.getAttribute("data-react-grab-owner-id")).toBeUndefined()
    expect(clone.getAttribute("data-particle-tile")).toBeUndefined()
    expect(artwork.getAttribute("id")).toBe("particle-drag-artwork")
    expect(artwork.getAttribute("fill")).toBe("url(#particle-drag-artwork)")
    expect(artwork.getAttribute("aria-labelledby")).toBe(
      "particle-drag-tile-title"
    )
    // Original capture rewrote 11 attributes here; only 6 changes are needed.
    expect(
      clone.setAttribute.mock.calls.length +
        artwork.setAttribute.mock.calls.length
    ).toBe(6)
    expect(clone.setAttribute).not.toHaveBeenCalledWith("class", "card")
    expect(artwork.setAttribute).not.toHaveBeenCalledWith("role", "img")
  })
  it("activates Calendar once on grip double-click or keyboard, never single click", () => {
    const addFromSourceClick = vi.fn()
    const context = vi
      .spyOn(particleContext, "useWorkspaceParticles")
      .mockReturnValue({
        canEdit: true,
        state: emptyWorkspaceParticleState(),
        addFromSourceClick,
      } as unknown as NonNullable<
        ReturnType<typeof particleContext.useWorkspaceParticles>
      >)
    const source = { kind: "roadmap" as const, id: "board_calendar" }
    let handle!: NonNullable<ReturnType<typeof ParticleSourceHandle>>
    function Harness() {
      handle = ParticleSourceHandle({
        source,
        title: "Calendar",
        dragOnly: true,
        doubleClickToAdd: true,
      })!
      return handle
    }
    try {
      const handleHtml = renderToStaticMarkup(createElement(Harness))
      handle.props.onClick()
      handle.props.onClick()
      expect(addFromSourceClick).not.toHaveBeenCalled()
      handle.props.onDoubleClick()
      expect(addFromSourceClick).toHaveBeenCalledExactlyOnceWith(source)
      const event = {
        key: "Enter",
        repeat: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      }
      handle.props.onKeyDown(event)
      handle.props.onClick()
      expect(addFromSourceClick).toHaveBeenCalledTimes(2)
      expect(event.preventDefault).toHaveBeenCalled()
      const html = renderToStaticMarkup(
        createElement(ParticleTile, {
          source: {
            ref: source,
            title: "Calendar",
            description: "",
            available: true,
          },
        })
      )
      expect(html).not.toContain('aria-label="Add Calendar to canvas"')
      expect(html).toContain("double-click or press Enter to add")
      expect(handleHtml).not.toContain('tabindex="-1"')
    } finally {
      context.mockRestore()
    }
  })
  it.each([
    "fundraising_presentation",
    "vision",
    "need",
    "mission_vision_values",
    "fundraising_strategy",
  ])("omits %s catalog text without changing its source", (id) => {
    const source = {
      ref: { kind: "roadmap" as const, id },
      title: "Roadmap title",
      description: "Fallback description",
      available: true,
      section: { ...section, content: "Original source document" },
    }
    const html = renderToStaticMarkup(
      createElement(ParticlePreview, { source })
    )
    expect(html).toContain("lucide-file-text")
    expect(html).not.toContain("Original source document")
    expect(html).not.toContain("Fallback description")
    expect(source.section.content).toBe("Original source document")
  })
  it("gives Calendar and Organization distinct modular footprints", () => {
    const calendarHtml = renderToStaticMarkup(
      createElement(ParticleTile, {
        source: {
          ref: { kind: "roadmap", id: "board_calendar" },
          title: "Calendar",
          description: "Board dates",
          available: false,
        },
      })
    )
    const standardHtml = renderToStaticMarkup(
      createElement(ParticleTile, {
        source: {
          ref: { kind: "roadmap", id: "budget" },
          title: "Budget",
          description: "Budget plan",
          available: false,
        },
      })
    )

    expect(calendarHtml).toContain("row-span-3")
    expect(calendarHtml).toContain("sm:col-span-2")
    expect(calendarHtml).toContain("min-h-0 flex-1")
    const organizationHtml = renderToStaticMarkup(
      createElement(ParticleTile, {
        source: {
          ref: { kind: "organization", id: "org-one" },
          title: "Organization",
          description: "",
          available: false,
        },
      })
    )
    expect(organizationHtml).toContain("row-span-2")
    expect(organizationHtml).toContain("sm:col-span-2")
    expect(organizationHtml).toContain("min-h-0 flex-1")
    expect(standardHtml).not.toContain("row-span-2")
    expect(standardHtml).not.toContain("sm:col-span-2")
    expect(standardHtml).toContain("min-h-0 flex-1")
  })
  it("renders the complete Calendar surface including connection controls and agenda", () => {
    const [source] = buildParticleSources(
      [{ ...section, id: "board_calendar", title: "Calendar" }],
      [],
      [],
      undefined,
      undefined,
      undefined,
      [
        {
          id: "event-one",
          title: "Board meeting",
          startsAt: "2026-09-20T18:00:00.000Z",
          allDay: false,
          assignedRoles: ["board"],
        },
      ]
    )
    const html = renderToStaticMarkup(
      createElement(ParticlePreview, { source })
    )

    expect(source.calendarEvents).toHaveLength(1)
    expect(html).toContain(
      'data-react-grab-owner-id="roadmap-calendar-month-agenda:month-grid"'
    )
    expect(html).toContain('role="grid"')
    expect(html).toContain('scope="col"')
    expect(html).toContain("Connect Google Calendar")
    expect(html).toContain('aria-label="Show previous month"')
    expect(html).toContain('aria-label="Show next month"')
    expect(html).toContain('data-slot="separator"')
    expect(html).toContain("EVENTS")
    expect(html).toContain("Loading…")
    const tileHtml = renderToStaticMarkup(
      createElement(ParticleTile, { source })
    )
    expect(tileHtml).toContain('inert=""')
    expect(tileHtml).toContain('data-particle-natural-preview="true"')
  })
  it("preserves the full Organization title treatment in compact mode", () => {
    const props = {
      fundingGoalCents: 1000000,
      headerUrl: "",
      logoUrl: "",
      peopleCount: 12,
      programsCount: 3,
      subtitle: "Neighborhood meals and mentoring",
      title: "Southside Community Table with a long title",
    }
    const fullHtml = renderToStaticMarkup(
      createElement(WorkspaceOrganizationOverviewSummary, props)
    )
    const compactHtml = renderToStaticMarkup(
      createElement(WorkspaceOrganizationOverviewSummary, {
        ...props,
        compact: true,
      })
    )

    expect(fullHtml).toContain("line-clamp-2")
    expect(compactHtml).toContain("line-clamp-1")
  })
  it("renders structured budget data without requiring a second content copy", () => {
    const html = renderToStaticMarkup(
      createElement(ParticleRoadmapContent, {
        section: {
          ...section,
          budgetRows: [
            {
              category: "Training",
              description: "Tools",
              costType: "Fixed",
              unit: "Item",
              units: "5",
              costPerUnit: "$10",
              totalCost: "$50",
            },
          ],
        },
      })
    )
    expect(html).toContain("Training")
    expect(html).toContain("$50")
    expect(html).not.toContain("ready for your ideas")
  })
  it("sanitizes HTML before displaying a linked section", () => {
    const html = renderToStaticMarkup(
      createElement(ParticleRoadmapContent, {
        section: {
          ...section,
          content:
            '<p>Our purpose</p><script>alert(1)</script><img src="x" onerror="alert(1)"><a href="javascript:alert(1)">unsafe</a>',
        },
      })
    )
    expect(html).toContain("Our purpose")
    expect(html).not.toMatch(/<script|onerror|javascript:/)
  })
})
