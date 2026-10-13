import { describe, expect, it } from "vitest"
import type { Node, InternalNode } from "@xyflow/react"

import type { OrgPersonWithImage } from "@/components/people/supporters-showcase"
import {
  buildWorkspacePeopleRelationshipPlacementLayout,
  resolveWorkspacePeopleRelationshipCanvasCenter,
  resolveWorkspacePeopleRelationshipFocusPersonId,
  shiftWorkspacePeopleRelationshipPlacementsAwayFromWorkspaceCards,
} from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-person-relationship-layout"
import {
  buildWorkspaceCanvasPersonRelationships,
  resolveWorkspacePeopleRelationshipGraphPersonIds,
} from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-person-relationship-engine"
import {
  buildWorkspaceCanvasPersonRelationshipEdges,
  resolveWorkspaceFloatingEdgeParams,
} from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-person-relationship-edges"
import {
  WORKSPACE_CANVAS_PERSON_NODE_SIZE,
  getWorkspaceCanvasPersonNodeId,
  type WorkspaceCanvasPersonPlacement,
} from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-person-node-model"

function person(
  id: string,
  reportsToId: string | null = null
): OrgPersonWithImage {
  return {
    id,
    name: id,
    title: null,
    email: null,
    linkedin: null,
    category: "staff",
    image: null,
    displayImage: null,
    reportsToId,
    pos: null,
  }
}

function personWith(
  id: string,
  overrides: Partial<OrgPersonWithImage>
): OrgPersonWithImage {
  return {
    ...person(id),
    ...overrides,
  }
}

function requirePlacement(
  placements: WorkspaceCanvasPersonPlacement[],
  personId: string
) {
  const placement = placements.find((item) => item.personId === personId)
  expect(placement).toBeTruthy()
  return placement as WorkspaceCanvasPersonPlacement
}

function placementCenterX(placement: WorkspaceCanvasPersonPlacement) {
  return placement.x + WORKSPACE_CANVAS_PERSON_NODE_SIZE.width / 2
}

function placementCenterY(placement: WorkspaceCanvasPersonPlacement) {
  return placement.y + WORKSPACE_CANVAS_PERSON_NODE_SIZE.height / 2
}

function placementBounds(placements: WorkspaceCanvasPersonPlacement[]) {
  return placements.reduce(
    (bounds, placement) => ({
      minX: Math.min(bounds.minX, placement.x),
      maxX: Math.max(
        bounds.maxX,
        placement.x + WORKSPACE_CANVAS_PERSON_NODE_SIZE.width
      ),
      minY: Math.min(bounds.minY, placement.y),
      maxY: Math.max(
        bounds.maxY,
        placement.y + WORKSPACE_CANVAS_PERSON_NODE_SIZE.height
      ),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    }
  )
}

describe("workspace canvas person relationship layout", () => {
  it("expands requested people with their manager chain before placement", () => {
    const peopleById = new Map([
      ["ceo", person("ceo")],
      ["manager", person("manager", "ceo")],
      ["report-a", person("report-a", "manager")],
    ])

    expect(
      resolveWorkspacePeopleRelationshipGraphPersonIds({
        personIds: ["report-a"],
        peopleById,
      })
    ).toEqual(["report-a", "manager", "ceo"])

    expect(
      buildWorkspaceCanvasPersonRelationships({
        personIds: ["report-a", "manager", "ceo"],
        peopleById,
      })
    ).toEqual([
      {
        id: "reports-to:report-a:manager",
        kind: "reports-to",
        sourcePersonId: "report-a",
        targetPersonId: "manager",
      },
      {
        id: "reports-to:manager:ceo",
        kind: "reports-to",
        sourcePersonId: "manager",
        targetPersonId: "ceo",
      },
    ])
  })

  it("chooses the top manager as the org-chart focus", () => {
    const peopleById = new Map([
      ["ceo", person("ceo")],
      ["manager", person("manager", "ceo")],
      ["report-a", person("report-a", "manager")],
      ["report-b", person("report-b", "manager")],
    ])

    expect(
      resolveWorkspacePeopleRelationshipFocusPersonId({
        personIds: ["report-a", "manager", "report-b", "ceo"],
        peopleById,
        existingPlacements: [],
      })
    ).toBe("ceo")

    const placements = buildWorkspacePeopleRelationshipPlacementLayout({
      personIds: ["report-a", "manager", "report-b", "ceo"],
      peopleById,
      existingPlacements: [],
      center: { x: 1000, y: 800 },
    })
    const ceoPlacement = requirePlacement(placements, "ceo")
    const managerPlacement = requirePlacement(placements, "manager")
    const reportAPlacement = requirePlacement(placements, "report-a")
    const reportBPlacement = requirePlacement(placements, "report-b")

    expect(ceoPlacement).toMatchObject({
      x: 878,
      y: 768,
    })
    expect(placementCenterX(managerPlacement)).toBe(
      placementCenterX(ceoPlacement)
    )
    expect(managerPlacement.y).toBeGreaterThan(ceoPlacement.y)
    expect(reportAPlacement.y).toBeGreaterThan(managerPlacement.y)
    expect(reportBPlacement.y).toBe(reportAPlacement.y)
    expect(placementCenterX(reportAPlacement)).toBeLessThan(
      placementCenterX(managerPlacement)
    )
    expect(placementCenterX(reportBPlacement)).toBeGreaterThan(
      placementCenterX(managerPlacement)
    )
    expect(placements).toHaveLength(4)
  })

  it("chooses the selected manager as the org-chart focus without a higher manager", () => {
    const peopleById = new Map([
      ["manager", person("manager")],
      ["report-a", person("report-a", "manager")],
      ["report-b", person("report-b", "manager")],
    ])

    expect(
      resolveWorkspacePeopleRelationshipFocusPersonId({
        personIds: ["report-a", "manager", "report-b"],
        peopleById,
        existingPlacements: [],
      })
    ).toBe("manager")

    const placements = buildWorkspacePeopleRelationshipPlacementLayout({
      personIds: ["report-a", "manager", "report-b"],
      peopleById,
      existingPlacements: [],
      center: { x: 1000, y: 800 },
    })
    const managerPlacement = requirePlacement(placements, "manager")
    const reportAPlacement = requirePlacement(placements, "report-a")
    const reportBPlacement = requirePlacement(placements, "report-b")

    expect(managerPlacement).toMatchObject({
      x: 878,
      y: 768,
    })
    expect(reportAPlacement.y).toBeGreaterThan(managerPlacement.y)
    expect(reportBPlacement.y).toBe(reportAPlacement.y)
    expect(placementCenterX(reportAPlacement)).toBeLessThan(
      placementCenterX(managerPlacement)
    )
    expect(placementCenterX(reportBPlacement)).toBeGreaterThan(
      placementCenterX(managerPlacement)
    )
    expect(placements).toHaveLength(3)
  })

  it("infers a lead staff manager for staff without explicit reports-to data", () => {
    const peopleById = new Map([
      ["lead", { ...person("lead"), title: "Executive Director" }],
      ["staff-a", person("staff-a")],
      ["staff-b", person("staff-b")],
    ])

    expect(
      resolveWorkspacePeopleRelationshipGraphPersonIds({
        personIds: ["staff-a"],
        peopleById,
      })
    ).toEqual(["staff-a", "lead"])

    expect(
      buildWorkspaceCanvasPersonRelationships({
        personIds: ["lead", "staff-a", "staff-b"],
        peopleById,
      })
    ).toEqual([
      {
        id: "reports-to:staff-a:lead",
        kind: "reports-to",
        sourcePersonId: "staff-a",
        targetPersonId: "lead",
      },
      {
        id: "reports-to:staff-b:lead",
        kind: "reports-to",
        sourcePersonId: "staff-b",
        targetPersonId: "lead",
      },
    ])
  })

  it("wraps wide direct-report groups instead of placing everyone in one row", () => {
    const peopleById = new Map([
      ["lead", { ...person("lead"), title: "Executive Director" }],
      ...Array.from({ length: 9 }, (_, index) => {
        const id = `staff-${index + 1}`
        return [id, person(id)] as const
      }),
    ])
    const placements = buildWorkspacePeopleRelationshipPlacementLayout({
      personIds: Array.from(peopleById.keys()),
      peopleById,
      existingPlacements: [],
      center: { x: 1000, y: 800 },
    })
    const uniqueRows = new Set(
      placements.map((placement) => placementCenterY(placement))
    )
    const bounds = placementBounds(placements)

    expect(placements).toHaveLength(10)
    expect(uniqueRows.size).toBeGreaterThan(2)
    expect(bounds.maxX - bounds.minX).toBeLessThanOrEqual(
      4 * WORKSPACE_CANVAS_PERSON_NODE_SIZE.width + 3 * 44
    )
  })

  it("wraps disconnected bulk roots into a compact forest", () => {
    const peopleById = new Map(
      Array.from({ length: 7 }, (_, index) => {
        const id = `advisor-${index + 1}`
        return [
          id,
          {
            ...person(id),
            category: "advisory_board" as const,
          },
        ] as const
      })
    )
    const placements = buildWorkspacePeopleRelationshipPlacementLayout({
      personIds: Array.from(peopleById.keys()),
      peopleById,
      existingPlacements: [],
      center: { x: 1000, y: 800 },
    })
    const uniqueRows = new Set(
      placements.map((placement) => placementCenterY(placement))
    )
    const bounds = placementBounds(placements)

    expect(placements).toHaveLength(7)
    expect(uniqueRows.size).toBe(2)
    expect(bounds.maxX - bounds.minX).toBeLessThanOrEqual(
      4 * WORKSPACE_CANVAS_PERSON_NODE_SIZE.width + 3 * 44
    )
  })

  it("clusters mixed people by board, staff, partners, and supporters", () => {
    const peopleById = new Map([
      [
        "board-chair",
        personWith("board-chair", {
          category: "governing_board",
          title: "Board Chair",
        }),
      ],
      [
        "advisor",
        personWith("advisor", {
          category: "advisory_board",
          title: "Advisor",
        }),
      ],
      [
        "lead",
        personWith("lead", {
          category: "staff",
          title: "Executive Director",
        }),
      ],
      ["staff-a", personWith("staff-a", { category: "staff" })],
      ["staff-b", personWith("staff-b", { category: "staff" })],
      ["contractor", personWith("contractor", { category: "contractors" })],
      ["vendor", personWith("vendor", { category: "vendors" })],
      ["volunteer", personWith("volunteer", { category: "volunteers" })],
      ["supporter", personWith("supporter", { category: "supporters" })],
    ])

    const placements = buildWorkspacePeopleRelationshipPlacementLayout({
      personIds: Array.from(peopleById.keys()),
      peopleById,
      existingPlacements: [],
      center: { x: 1000, y: 800 },
    })
    const boardChair = requirePlacement(placements, "board-chair")
    const advisor = requirePlacement(placements, "advisor")
    const lead = requirePlacement(placements, "lead")
    const staffA = requirePlacement(placements, "staff-a")
    const staffB = requirePlacement(placements, "staff-b")
    const contractor = requirePlacement(placements, "contractor")
    const volunteer = requirePlacement(placements, "volunteer")
    const supporter = requirePlacement(placements, "supporter")
    const bounds = placementBounds(placements)

    expect(placements).toHaveLength(9)
    expect(placementCenterY(boardChair)).toBe(placementCenterY(advisor))
    expect(placementCenterY(boardChair)).toBeLessThan(placementCenterY(lead))
    expect(placementCenterY(lead)).toBeLessThan(placementCenterY(staffA))
    expect(placementCenterY(staffA)).toBe(placementCenterY(staffB))
    expect(placementCenterY(staffA)).toBeLessThan(placementCenterY(contractor))
    expect(placementCenterY(contractor)).toBeLessThan(
      placementCenterY(volunteer)
    )
    expect(placementCenterY(volunteer)).toBe(placementCenterY(supporter))
    expect(bounds.maxX - bounds.minX).toBeLessThanOrEqual(
      4 * WORKSPACE_CANVAS_PERSON_NODE_SIZE.width + 3 * 44
    )
  })

  it("uses an already placed manager as the focus without moving it", () => {
    const peopleById = new Map([
      ["manager", person("manager")],
      ["report-a", person("report-a", "manager")],
      ["report-b", person("report-b", "manager")],
    ])
    const existingPlacements = [{ personId: "manager", x: 400, y: 300 }]

    expect(
      resolveWorkspacePeopleRelationshipFocusPersonId({
        personIds: ["report-a", "report-b"],
        peopleById,
        existingPlacements,
      })
    ).toBe("manager")

    const placements = buildWorkspacePeopleRelationshipPlacementLayout({
      personIds: ["report-a", "report-b"],
      peopleById,
      existingPlacements,
      center: { x: 522, y: 332 },
    })

    expect(placements.map((placement) => placement.personId)).toEqual([
      "report-a",
      "report-b",
    ])
    expect(
      placements.some((placement) => placement.personId === "manager")
    ).toBe(false)
    expect(placements.every((placement) => placement.y > 300)).toBe(true)
    expect(
      placements.every((placement) => placementCenterY(placement) > 332)
    ).toBe(true)
    expect(
      placementCenterX(requirePlacement(placements, "report-a"))
    ).toBeLessThan(522)
    expect(
      placementCenterX(requirePlacement(placements, "report-b"))
    ).toBeGreaterThan(522)
  })

  it("places a new people cluster to the right of existing workspace cards", () => {
    const nodes = [
      {
        id: "organization-overview",
        type: "workspace",
        position: { x: 100, y: 80 },
        width: 520,
        height: 300,
        data: {},
      },
    ] as Node[]

    const center = resolveWorkspacePeopleRelationshipCanvasCenter({
      nodes,
      fallbackCenter: { x: 0, y: 0 },
      focusPersonId: null,
      existingPlacements: [],
      personCount: 3,
    })

    expect(center.x).toBeGreaterThan(620)
    expect(center.y).toBeGreaterThan(80)
  })

  it("shifts a generated people cluster until it clears workspace cards", () => {
    const nodes = [
      {
        id: "organization-overview",
        type: "workspace",
        position: { x: 100, y: 80 },
        width: 520,
        height: 300,
        data: {},
      },
    ] as Node[]
    const shifted =
      shiftWorkspacePeopleRelationshipPlacementsAwayFromWorkspaceCards({
        placements: [
          { personId: "person-a", x: 400, y: 120 },
          { personId: "person-b", x: 716, y: 120 },
        ],
        nodes,
      })
    const bounds = placementBounds(shifted)

    expect(bounds.minX).toBeGreaterThanOrEqual(800)
  })

  it("builds floating display edges only when both people are placed", () => {
    const peopleById = new Map([
      ["manager", person("manager")],
      ["report-a", person("report-a", "manager")],
    ])
    const edges = buildWorkspaceCanvasPersonRelationshipEdges({
      placements: [
        { personId: "manager", x: 0, y: 0 },
        { personId: "report-a", x: 400, y: 0 },
      ],
      peopleById,
      presentationMode: false,
    })

    expect(edges).toHaveLength(1)
    expect(edges[0]).toMatchObject({
      type: "workspace-person-relationship",
      source: getWorkspaceCanvasPersonNodeId("report-a"),
      target: getWorkspaceCanvasPersonNodeId("manager"),
      deletable: false,
      focusable: false,
      reconnectable: false,
      data: {
        role: "workspace-person-relationship",
        relationship: "reports-to",
        relationshipId: "reports-to:report-a:manager",
      },
    })

    expect(
      buildWorkspaceCanvasPersonRelationshipEdges({
        placements: [{ personId: "report-a", x: 400, y: 0 }],
        peopleById,
        presentationMode: false,
      })
    ).toEqual([])
  })

  it("does not build invalid self-reporting relationship edges", () => {
    const peopleById = new Map([["manager", person("manager", "manager")]])

    expect(
      buildWorkspaceCanvasPersonRelationshipEdges({
        placements: [{ personId: "manager", x: 0, y: 0 }],
        peopleById,
        presentationMode: false,
      })
    ).toEqual([])
  })
})

describe("v12 measured people geometry", () => {
  it("anchors floating connections to measured sizes and internal absolute positions", () => {
    const source: Node = {
      id: "source",
      data: {},
      position: { x: 0, y: 0 },
      width: 1,
      height: 1,
      measured: { width: 200, height: 100 },
    }
    const internal: InternalNode = {
      ...source,
      measured: { width: 200, height: 100 },
      internals: {
        positionAbsolute: { x: 100, y: 50 },
        z: 0,
        userNode: source,
      },
    }
    const target: Node = {
      id: "target",
      data: {},
      position: { x: 500, y: 50 },
      measured: { width: 200, height: 100 },
    }
    const route = resolveWorkspaceFloatingEdgeParams({
      sourceNode: internal,
      targetNode: target,
    })
    expect(route).toMatchObject({
      sourceX: 300,
      sourceY: 100,
      targetX: 500,
      targetY: 100,
    })
  })
})
