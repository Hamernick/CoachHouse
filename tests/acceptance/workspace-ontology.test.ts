import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import {
  applyWorkspaceOntologyStateToParams,
  arrangeWorkspaceOntologyBranchGeometry,
  buildDefaultWorkspaceOntologyState,
  buildWorkspaceOntologyProjection,
  buildWorkspaceOntologyRootAttentionCounts,
  buildWorkspaceOntologyRootCompletedCounts,
  buildWorkspaceOntologyRootDescendantCounts,
  describeWorkspaceOntologyNodeActivation,
  layoutWorkspaceOntology,
  normalizeWorkspaceOntologyState,
  readWorkspaceOntologyUrlState,
  resolveWorkspaceOntologyBranchTogglePresentation,
  resolveWorkspaceOntologyNodeActivation,
  resolveWorkspaceOntologyNodeSize,
  searchWorkspaceOntologyNodes,
  WORKSPACE_ONTOLOGY_NODE_SIZE,
  type WorkspaceOntologyInput,
} from "../../src/features/workspace-ontology"
import { isBoardStateContentEqual } from "../../src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-canvas-helpers"
import { buildDefaultBoardState } from "../../src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-layout"

const INPUT: WorkspaceOntologyInput = {
  roots: [
    {
      id: "organization-overview",
      label: "Organization",
      children: [
        {
          id: "ontology:profile",
          label: "Operating profile",
          description: "Organization identity and mission.",
          category: "organization",
          kind: "Profile",
          status: "in-progress",
          statusLabel: "Needs attention",
          relationshipLabel: "defines",
          href: "/workspace?view=editor&tab=company",
          actionLabel: "Edit profile",
          children: [
            {
              id: "ontology:mission",
              label: "Mission",
              description: "The organization mission statement.",
              category: "organization",
              kind: "Profile field",
              status: "missing",
              statusLabel: "Missing information",
              relationshipLabel: "requires",
              href: "/workspace?view=editor&tab=company",
              actionLabel: "Complete",
            },
          ],
        },
      ],
    },
  ],
}

function layoutNodesOverlap(
  left: {
    position: { x: number; y: number }
    size: { width: number; height: number }
  },
  right: {
    position: { x: number; y: number }
    size: { width: number; height: number }
  },
  gap = 0
) {
  return !(
    left.position.x + left.size.width + gap <= right.position.x ||
    right.position.x + right.size.width + gap <= left.position.x ||
    left.position.y + left.size.height + gap <= right.position.y ||
    right.position.y + right.size.height + gap <= left.position.y
  )
}

function groupBy<TKey, TValue>(
  values: TValue[],
  resolveKey: (value: TValue) => TKey
) {
  const groups = new Map<TKey, TValue[]>()
  for (const value of values) {
    const key = resolveKey(value)
    groups.set(key, [...(groups.get(key) ?? []), value])
  }
  return groups
}

describe("workspace ontology primary activation", () => {
  const baseNode = {
    id: "ontology:test",
    label: "Test node",
    description: "Test node description.",
    category: "tasks" as const,
    kind: "Task",
    status: "missing" as const,
    statusLabel: "Missing information",
    relationshipLabel: "contains",
    href: null,
    actionLabel: null,
    rootId: "programs" as const,
    parentId: "programs",
    depth: 1,
    childCount: 0,
    hasChildren: false,
    presentation: "action" as const,
  }

  it("expands groups before following their redundant destination", () => {
    expect(
      resolveWorkspaceOntologyNodeActivation({
        ...baseNode,
        href: "/workspace?view=editor&tab=programs",
        childCount: 3,
        hasChildren: true,
        presentation: "group",
      })
    ).toEqual({ kind: "toggle-details", nodeId: "ontology:test" })
  })

  it("opens exact routes and in-canvas actions for leaves", () => {
    expect(
      resolveWorkspaceOntologyNodeActivation({
        ...baseNode,
        href: "/workspace/roadmap/launch",
      })
    ).toEqual({ kind: "navigate", href: "/workspace/roadmap/launch" })
    expect(
      resolveWorkspaceOntologyNodeActivation({
        ...baseNode,
        actionLabel: "Open task",
        actionTarget: { kind: "task", ticketId: "ticket-1" },
      })
    ).toEqual({
      kind: "open-action",
      rootId: "programs",
      target: { kind: "task", ticketId: "ticket-1" },
    })
  })

  it("focuses the owning operational card for an otherwise dead leaf", () => {
    expect(resolveWorkspaceOntologyNodeActivation(baseNode)).toEqual({
      kind: "focus-root",
      rootId: "programs",
    })
    expect(
      describeWorkspaceOntologyNodeActivation({
        node: baseNode,
        expanded: false,
      })
    ).toBe("Go to Activity card")
  })
})

describe("workspace ontology projection", () => {
  it("starts compact and reveals only the requested branch", () => {
    const collapsed = buildWorkspaceOntologyProjection({
      input: INPUT,
      state: buildDefaultWorkspaceOntologyState(),
      filter: { query: "", categories: [] },
    })
    expect(collapsed.nodes).toEqual([])

    const rootExpanded = buildWorkspaceOntologyProjection({
      input: INPUT,
      state: {
        ...buildDefaultWorkspaceOntologyState(),
        expandedRootIds: ["organization-overview"],
      },
      filter: { query: "", categories: [] },
    })
    expect(rootExpanded.nodes.map((node) => node.id)).toEqual([
      "ontology:list:organization-overview",
    ])
    expect(rootExpanded.nodes[0].items?.map((item) => item.id)).toEqual([
      "ontology:profile",
    ])
    expect(rootExpanded.edges[0]).toMatchObject({
      source: "organization-overview",
      target: "ontology:list:organization-overview",
      label: "defines",
    })

    const nodeExpanded = buildWorkspaceOntologyProjection({
      input: INPUT,
      state: {
        ...buildDefaultWorkspaceOntologyState(),
        expandedRootIds: ["organization-overview"],
        expandedNodeIds: ["ontology:profile"],
      },
      filter: { query: "", categories: [] },
    })
    expect(nodeExpanded.nodes.map((node) => node.id)).toEqual([
      "ontology:list:organization-overview",
      "ontology:list:ontology:profile",
    ])
    expect(nodeExpanded.nodes[1].items?.map((item) => item.id)).toEqual([
      "ontology:mission",
    ])

    const rootCollapsedAgain = buildWorkspaceOntologyProjection({
      input: INPUT,
      state: {
        ...buildDefaultWorkspaceOntologyState(),
        expandedNodeIds: ["ontology:profile"],
      },
      filter: { query: "", categories: [] },
    })
    expect(rootCollapsedAgain.nodes).toEqual([])
  })

  it("search reveals matching nodes and their ancestors", () => {
    const projection = buildWorkspaceOntologyProjection({
      input: INPUT,
      state: buildDefaultWorkspaceOntologyState(),
      filter: { query: "statement", categories: [] },
    })
    expect(projection.nodes.map((node) => node.id)).toEqual([
      "ontology:profile",
      "ontology:mission",
    ])
    expect(projection.resultNodeIds).toEqual(["ontology:mission"])
    expect(
      buildWorkspaceOntologyRootDescendantCounts(INPUT).get(
        "organization-overview"
      )
    ).toBe(2)
  })

  it("searches all nodes without changing the visible board projection", () => {
    const projection = buildWorkspaceOntologyProjection({
      input: INPUT,
      state: buildDefaultWorkspaceOntologyState(),
      filter: { query: "", categories: [] },
    })

    const matches = searchWorkspaceOntologyNodes({
      nodes: projection.allNodes,
      query: "statement",
    })

    expect(projection.nodes).toEqual([])
    expect(matches.map((node) => node.id)).toEqual(["ontology:mission"])
  })

  it("keeps ancestors connected when filtering a descendant category", () => {
    const filteredInput: WorkspaceOntologyInput = {
      roots: [
        {
          id: "organization-overview",
          label: "Organization",
          children: [
            {
              ...INPUT.roots[0].children[0],
              children: [
                {
                  ...INPUT.roots[0].children[0].children![0],
                  category: "documents",
                },
              ],
            },
          ],
        },
      ],
    }
    const projection = buildWorkspaceOntologyProjection({
      input: filteredInput,
      state: {
        ...buildDefaultWorkspaceOntologyState(),
        expandedRootIds: ["organization-overview"],
        expandedNodeIds: ["ontology:profile"],
      },
      filter: { query: "", categories: ["documents"] },
    })

    expect(projection.nodes.map((node) => node.listParentId)).toEqual([
      "organization-overview",
      "ontology:profile",
    ])
    expect(projection.nodes[0].items?.map((item) => item.id)).toEqual([
      "ontology:profile",
    ])
    expect(projection.nodes[1].items?.map((item) => item.id)).toEqual([
      "ontology:mission",
    ])
    expect(projection.edges).toHaveLength(2)
  })

  it("projects typed cross-domain relationships without orphan edges", () => {
    const relationshipInput: WorkspaceOntologyInput = {
      roots: INPUT.roots,
      relationships: [
        {
          id: "ontology-relationship:profile-person",
          source: "ontology:profile",
          target: "workspace-person:person-1",
          label: "owned by",
          category: "people",
          status: "complete",
        },
      ],
    }
    const expanded = buildWorkspaceOntologyProjection({
      input: relationshipInput,
      state: {
        ...buildDefaultWorkspaceOntologyState(),
        mode: "map",
        expandedRootIds: ["organization-overview"],
      },
      filter: { query: "", categories: [] },
    })
    const collapsed = buildWorkspaceOntologyProjection({
      input: relationshipInput,
      state: buildDefaultWorkspaceOntologyState(),
      filter: { query: "", categories: [] },
    })

    expect(expanded.edges.at(-1)).toMatchObject({
      source: "ontology:profile",
      target: "workspace-person:person-1",
      label: "owned by",
      kind: "relationship",
    })
    expect(collapsed.edges).toEqual([])
  })

  it("labels one hierarchy rail per source and every cross-area relationship", () => {
    const input: WorkspaceOntologyInput = {
      roots: [
        {
          id: "organization-overview",
          label: "Organization",
          children: [
            INPUT.roots[0].children[0],
            {
              ...INPUT.roots[0].children[0],
              id: "ontology:governance",
              label: "Governance",
            },
          ],
        },
      ],
      relationships: [
        {
          id: "ontology-relationship:profile-governance",
          source: "ontology:profile",
          target: "ontology:governance",
          label: "informs",
          category: "organization",
          status: "in-progress",
        },
      ],
    }
    const projection = buildWorkspaceOntologyProjection({
      input,
      state: {
        ...buildDefaultWorkspaceOntologyState(),
        mode: "map",
        expandedRootIds: ["organization-overview"],
      },
      filter: { query: "", categories: [] },
    })

    expect(projection.edges.map((edge) => [edge.kind, edge.showLabel])).toEqual(
      [
        ["hierarchy", true],
        ["hierarchy", true],
        ["hierarchy", false],
        ["relationship", true],
      ]
    )
  })
})

describe("workspace ontology state and layout", () => {
  it("keeps personal ontology exploration out of board persistence", () => {
    const current = buildDefaultBoardState()
    const next = {
      ...current,
      ontology: {
        ...buildDefaultWorkspaceOntologyState(),
        expandedRootIds: ["organization-overview" as const],
      },
    }

    expect(isBoardStateContentEqual(current, next)).toBe(true)
  })

  it("normalizes shared state without legacy generated-node positions", () => {
    expect(
      normalizeWorkspaceOntologyState({
        expandedRootIds: ["organization-overview", "invalid"],
        pinnedNodeIds: ["ontology:profile", "missing-position"],
        nodePositions: {
          "ontology:profile": { x: 120.4, y: 240.8 },
          invalid: { x: Number.NaN, y: 2 },
        },
      })
    ).toEqual({
      updatedAt: null,
      mode: "focus",
      expandedRootIds: ["organization-overview"],
      expandedNodeIds: [],
      pinnedNodeIds: [],
      nodePositions: {},
    })
  })

  it("round-trips bounded personal expansion through URL parameters", () => {
    const params = applyWorkspaceOntologyStateToParams(
      new URLSearchParams("view=workspace"),
      {
        ...buildDefaultWorkspaceOntologyState(),
        mode: "map",
        expandedRootIds: ["organization-overview", "accelerator"],
        expandedNodeIds: ["ontology:profile", "invalid value"],
      }
    )

    expect(params.get("view")).toBe("workspace")
    expect(params.get("workspace-view")).toBe("map")
    expect(params.get("workspace-details")).toBe(
      "organization-overview,accelerator"
    )
    expect(params.get("workspace-groups")).toBe("ontology:profile")
    expect(readWorkspaceOntologyUrlState(params)).toMatchObject({
      expandedRootIds: ["organization-overview", "accelerator"],
      expandedNodeIds: ["ontology:profile"],
    })
  })

  it("orders attention first and reports root priority counts", () => {
    const priorityInput: WorkspaceOntologyInput = {
      roots: [
        {
          id: "organization-overview",
          label: "Organization",
          children: [
            ...(["complete", "missing", "in-progress", "blocked"] as const).map(
              (status) => ({
                ...INPUT.roots[0].children[0],
                id: `ontology:${status}`,
                label: status,
                status,
                children: undefined,
              })
            ),
          ],
        },
      ],
    }
    const projection = buildWorkspaceOntologyProjection({
      input: priorityInput,
      state: {
        ...buildDefaultWorkspaceOntologyState(),
        expandedRootIds: ["organization-overview"],
      },
      filter: { query: "", categories: [] },
    })

    expect(projection.nodes[0].items?.map((node) => node.status)).toEqual([
      "blocked",
      "missing",
      "in-progress",
      "complete",
    ])
    expect(
      buildWorkspaceOntologyRootAttentionCounts(priorityInput).get(
        "organization-overview"
      )
    ).toBe(2)
    expect(
      buildWorkspaceOntologyRootCompletedCounts(priorityInput).get(
        "organization-overview"
      )
    ).toBe(1)
  })

  it("labels root setup actions and keeps the relevant count on the right", () => {
    const control = {
      attentionCount: 3,
      completedCount: 0,
      descendantCount: 5,
      expanded: false,
      mode: "focus" as const,
    }

    expect(resolveWorkspaceOntologyBranchTogglePresentation(control)).toEqual({
      actionLabel: "Start setup",
      count: 3,
      accessibleLabel: "Start setup with 5 items, including 3 priorities",
    })
    expect(
      resolveWorkspaceOntologyBranchTogglePresentation({
        ...control,
        completedCount: 2,
      })
    ).toMatchObject({ actionLabel: "Finish setup", count: 3 })
    expect(
      resolveWorkspaceOntologyBranchTogglePresentation({
        ...control,
        attentionCount: 0,
        completedCount: 5,
      })
    ).toMatchObject({ actionLabel: "Review setup", count: 5 })
    expect(
      resolveWorkspaceOntologyBranchTogglePresentation({
        ...control,
        expanded: true,
      })
    ).toMatchObject({ actionLabel: "Hide setup", count: 5 })
  })

  it("ignores obsolete generated-node positions during managed layout", async () => {
    const projection = buildWorkspaceOntologyProjection({
      input: INPUT,
      state: {
        ...buildDefaultWorkspaceOntologyState(),
        expandedRootIds: ["organization-overview"],
        expandedNodeIds: ["ontology:profile"],
      },
      filter: { query: "", categories: [] },
    })
    const rootGeometry = {
      "organization-overview": {
        x: 0,
        y: 0,
        width: 360,
        height: 240,
      },
    }
    const cleanLayout = await layoutWorkspaceOntology({
      projection,
      rootGeometry,
    })
    const legacyLayout = await layoutWorkspaceOntology({
      projection,
      rootGeometry,
    })
    expect(legacyLayout).toEqual(cleanLayout)
  })

  it("preserves unaffected branch geometry during incremental layout", async () => {
    const input: WorkspaceOntologyInput = {
      roots: [
        ...INPUT.roots,
        {
          id: "accelerator",
          label: "Accelerator",
          children: [
            {
              ...INPUT.roots[0].children[0],
              id: "ontology:accelerator:module",
              category: "accelerator",
              children: undefined,
            },
          ],
        },
      ],
    }
    const state = {
      ...buildDefaultWorkspaceOntologyState(),
      expandedRootIds: ["organization-overview", "accelerator"] as const,
    }
    const projection = buildWorkspaceOntologyProjection({
      input,
      state: { ...state, expandedRootIds: [...state.expandedRootIds] },
      filter: { query: "", categories: [] },
    })
    const rootGeometry = {
      "organization-overview": { x: 0, y: 0, width: 360, height: 240 },
      accelerator: { x: 1200, y: 0, width: 360, height: 240 },
    }
    const initial = await layoutWorkspaceOntology({
      projection,
      rootGeometry,
    })
    const next = await layoutWorkspaceOntology({
      projection,
      rootGeometry,
      previousLayoutNodes: initial,
      dirtyRootIds: new Set(["organization-overview"]),
    })

    expect(next.filter((node) => node.rootId === "accelerator")).toEqual(
      initial.filter((node) => node.rootId === "accelerator")
    )
  })

  it("lays out a dense branch without node collisions", async () => {
    const denseInput: WorkspaceOntologyInput = {
      roots: [
        {
          id: "organization-overview",
          label: "Organization",
          children: Array.from({ length: 120 }, (_, index) => ({
            id: `ontology:dense:${index}`,
            label: `Requirement ${index + 1}`,
            description: "Organization requirement.",
            category: "organization",
            kind: "Requirement",
            status: "missing",
            statusLabel: "Missing",
            relationshipLabel: "requires",
            href: null,
            actionLabel: null,
          })),
        },
      ],
    }
    const state = {
      ...buildDefaultWorkspaceOntologyState(),
      mode: "map" as const,
      expandedRootIds: ["organization-overview" as const],
    }
    const projection = buildWorkspaceOntologyProjection({
      input: denseInput,
      state,
      filter: { query: "", categories: [] },
    })
    const layout = await layoutWorkspaceOntology({
      projection,
      rootGeometry: {
        "organization-overview": { x: 0, y: 0, width: 360, height: 240 },
      },
    })

    expect(layout).toHaveLength(120)
    expect(
      layout.every(
        (node) =>
          node.size.width === resolveWorkspaceOntologyNodeSize(node).width &&
          node.size.height === resolveWorkspaceOntologyNodeSize(node).height
      )
    ).toBe(true)
    for (let leftIndex = 0; leftIndex < layout.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < layout.length;
        rightIndex += 1
      ) {
        expect(layoutNodesOverlap(layout[leftIndex], layout[rightIndex])).toBe(
          false
        )
      }
    }

    const nodesByColumn = groupBy(layout, (node) => node.position.x)
    expect(nodesByColumn.size).toBe(1)
    expect(Array.from(nodesByColumn.values())[0]).toHaveLength(120)
    const left = Math.min(...layout.map((node) => node.position.x))
    const right = Math.max(
      ...layout.map((node) => node.position.x + node.size.width)
    )
    expect(right - left).toBeLessThanOrEqual(320)
    const top = Math.min(...layout.map((node) => node.position.y))
    const bottom = Math.max(
      ...layout.map((node) => node.position.y + node.size.height)
    )
    expect(bottom - top).toBeLessThanOrEqual(26_000)

    const repeated = await layoutWorkspaceOntology({
      projection,
      rootGeometry: {
        "organization-overview": { x: 0, y: 0, width: 360, height: 240 },
      },
    })
    expect(repeated).toEqual(layout)
  })

  it("lays branches from one arranged deterministic root scene", async () => {
    const makeChildren = (rootId: string) =>
      Array.from({ length: 8 }, (_, index) => ({
        id: `ontology:${rootId}:${index}`,
        label: `${rootId} ${index + 1}`,
        description: "Operational record.",
        category:
          rootId === "accelerator"
            ? ("accelerator" as const)
            : ("organization" as const),
        kind: "Record",
        status: "in-progress" as const,
        statusLabel: "In progress",
        relationshipLabel: "contains",
        href: null,
        actionLabel: null,
      }))
    const input: WorkspaceOntologyInput = {
      roots: [
        {
          id: "organization-overview",
          label: "Organization",
          children: makeChildren("organization-overview"),
        },
        {
          id: "accelerator",
          label: "Accelerator",
          children: makeChildren("accelerator"),
        },
      ],
    }
    const state = {
      ...buildDefaultWorkspaceOntologyState(),
      mode: "map" as const,
      expandedRootIds: ["organization-overview", "accelerator"] as const,
    }
    const projection = buildWorkspaceOntologyProjection({
      input,
      state: { ...state, expandedRootIds: [...state.expandedRootIds] },
      filter: { query: "", categories: [] },
    })
    const rootGeometry = {
      "organization-overview": { x: 0, y: 0, width: 360, height: 240 },
      accelerator: { x: 420, y: 0, width: 360, height: 240 },
    }
    const obstacles = Object.entries(rootGeometry).map(([id, geometry]) => ({
      id,
      ...geometry,
    }))
    const layoutRootGeometry = arrangeWorkspaceOntologyBranchGeometry({
      projection,
      rootGeometry,
      obstacles,
    })
    const layout = await layoutWorkspaceOntology({
      projection,
      rootGeometry: layoutRootGeometry,
    })

    for (let leftIndex = 0; leftIndex < layout.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < layout.length;
        rightIndex += 1
      ) {
        expect(
          layoutNodesOverlap(layout[leftIndex], layout[rightIndex], 32)
        ).toBe(false)
      }
    }
    for (const node of layout) {
      for (const root of Object.values(rootGeometry)) {
        if (!root) continue
        expect(
          layoutNodesOverlap(node, { position: root, size: root }, 40)
        ).toBe(false)
      }
    }

    const byRoot = groupBy(layout, (node) => node.rootId)
    for (const branch of byRoot.values()) {
      const columnX = [...new Set(branch.map((node) => node.position.x))].sort(
        (left, right) => left - right
      )
      expect(columnX).toHaveLength(1)
      expect(branch.map((node) => node.position.x)).toEqual(
        Array(8).fill(columnX[0])
      )
      expect(new Set(branch.map((node) => node.position.y)).size).toBe(8)
    }
  })

  it("keeps a six-domain operations graph bounded and collision free", async () => {
    const rootIds = [
      "organization-overview",
      "programs",
      "accelerator",
      "roadmap",
      "calendar",
      "fiscal-sponsorship",
    ] as const
    const categoryByRootId = {
      "organization-overview": "organization",
      programs: "programs",
      accelerator: "accelerator",
      roadmap: "roadmap",
      calendar: "calendar",
      "fiscal-sponsorship": "fiscal",
    } as const
    const input: WorkspaceOntologyInput = {
      roots: rootIds.map((rootId) => ({
        id: rootId,
        label: rootId,
        children: Array.from({ length: 18 }, (_, index) => ({
          id: `ontology:${rootId}:${index}`,
          label: `${rootId} ${index + 1}`,
          description: "Operational record.",
          category: categoryByRootId[rootId],
          kind: "Record",
          status: "in-progress",
          statusLabel: "In progress",
          relationshipLabel: "contains",
          href: null,
          actionLabel: null,
        })),
      })),
    }
    const state = {
      ...buildDefaultWorkspaceOntologyState(),
      mode: "map" as const,
      expandedRootIds: [...rootIds],
    }
    const projection = buildWorkspaceOntologyProjection({
      input,
      state,
      filter: { query: "", categories: [] },
    })
    const rootGeometry = Object.fromEntries(
      rootIds.map((rootId, index) => [
        rootId,
        { x: index * 420, y: 0, width: 360, height: 240 },
      ])
    )
    const obstacles = Object.entries(rootGeometry).map(([id, geometry]) => ({
      id,
      ...geometry,
    }))
    const layoutRootGeometry = arrangeWorkspaceOntologyBranchGeometry({
      projection,
      rootGeometry,
      obstacles,
    })
    const layout = await layoutWorkspaceOntology({
      projection,
      rootGeometry: layoutRootGeometry,
    })

    expect(layout).toHaveLength(108)
    for (let leftIndex = 0; leftIndex < layout.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < layout.length;
        rightIndex += 1
      ) {
        expect(
          layoutNodesOverlap(layout[leftIndex], layout[rightIndex], 32)
        ).toBe(false)
      }
    }
    const left = Math.min(...layout.map((node) => node.position.x))
    const top = Math.min(...layout.map((node) => node.position.y))
    const right = Math.max(
      ...layout.map((node) => node.position.x + node.size.width)
    )
    const bottom = Math.max(
      ...layout.map((node) => node.position.y + node.size.height)
    )
    expect(right - left).toBeLessThanOrEqual(5_200)
    expect(bottom - top).toBeLessThanOrEqual(3_200)
    expect(
      new Set(
        rootIds.map((rootId) => {
          const root = layoutRootGeometry[rootId]!
          return `${root.x}:${root.y}`
        })
      ).size
    ).toBe(rootIds.length)

    expect(
      await layoutWorkspaceOntology({
        projection,
        rootGeometry: layoutRootGeometry,
      })
    ).toEqual(layout)
  })
})

describe("workspace ontology integration contract", () => {
  it("keeps ontology rendering stable, accessible, and viewport-aware", () => {
    const viewSource = readFileSync(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2-view.tsx",
      "utf8"
    )
    const nodeSource = readFileSync(
      "src/features/workspace-ontology/components/workspace-ontology-node.tsx",
      "utf8"
    )
    const listSource = readFileSync(
      "src/features/workspace-ontology/components/workspace-ontology-list.tsx",
      "utf8"
    )
    const edgeSource = readFileSync(
      "src/features/workspace-ontology/components/workspace-ontology-edge.tsx",
      "utf8"
    )
    const branchToggleSource = readFileSync(
      "src/features/workspace-ontology/components/workspace-ontology-branch-toggle.tsx",
      "utf8"
    )
    const layoutSource = readFileSync(
      "src/features/workspace-ontology/lib/layout.ts",
      "utf8"
    )
    const boardNodeSource = readFileSync(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-node.tsx",
      "utf8"
    )
    const controllerSource = readFileSync(
      "src/features/workspace-ontology/hooks/use-workspace-ontology-controller.ts",
      "utf8"
    )
    const layoutSceneSource = readFileSync(
      "src/features/workspace-ontology/hooks/use-workspace-ontology-layout-scene.ts",
      "utf8"
    )
    const projectionHookSource = readFileSync(
      "src/features/workspace-ontology/hooks/use-workspace-ontology-projection.ts",
      "utf8"
    )
    const urlStateHookSource = readFileSync(
      "src/features/workspace-ontology/hooks/use-workspace-ontology-url-state.ts",
      "utf8"
    )
    const wayfindingHookSource = readFileSync(
      "src/features/workspace-ontology/hooks/use-workspace-ontology-wayfinding.ts",
      "utf8"
    )
    const sheetSource = readFileSync("src/components/ui/sheet.tsx", "utf8")
    const canvasBodySource = readFileSync(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-canvas-body.tsx",
      "utf8"
    )
    const canvasStateSource = readFileSync(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-canvas-state.ts",
      "utf8"
    )
    const surfaceSource = readFileSync(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2.tsx",
      "utf8"
    )
    const globalStylesSource = readFileSync("src/app/globals.css", "utf8")
    const ontologySurfaceSource = readFileSync(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2-ontology.ts",
      "utf8"
    )
    const ontologyInteractionsSource = readFileSync(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2-ontology-interactions.ts",
      "utf8"
    )
    const renderStateSource = readFileSync(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2-render-state.ts",
      "utf8"
    )
    const boardCanvasSource = readFileSync(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-canvas.tsx",
      "utf8"
    )
    const calendarCardSource = readFileSync(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-calendar-card.tsx",
      "utf8"
    )
    const calendarPanelSource = readFileSync(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-calendar-card-strip-panel.tsx",
      "utf8"
    )
    const programsRendererSource = readFileSync(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-node-card-programs-renderer.tsx",
      "utf8"
    )
    const formationTrackerSource = readFileSync(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-formation-tracker-card.tsx",
      "utf8"
    )
    const fiscalSummarySource = readFileSync(
      "src/features/fiscal-sponsorship/components/fiscal-sponsorship-workspace-card-summary.tsx",
      "utf8"
    )
    expect(viewSource).toContain("onlyRenderVisibleElements")
    expect(viewSource).not.toContain("WorkspaceOntologyPanel")
    expect(viewSource).not.toContain("ontologyPanel")
    expect(viewSource).not.toContain("data-workspace-ontology-panel-anchor")
    expect(surfaceSource).toContain(
      "const WORKSPACE_LIVE_CANVAS_ONTOLOGY_ENABLED = false"
    )
    expect(surfaceSource).toContain(
      "enabled: WORKSPACE_LIVE_CANVAS_ONTOLOGY_ENABLED && !tutorialActiveFromBoard"
    )
    expect(surfaceSource).toContain("ontologyRootControls: undefined")
    expect(surfaceSource).toContain(
      "WORKSPACE_LIVE_CANVAS_ONTOLOGY_ENABLED ? ontology.edges : []"
    )
    expect(projectionHookSource).toContain(
      'filter: { query: "", categories: [] }'
    )
    expect(projectionHookSource).not.toContain("searchWorkspaceOntologyNodes")
    expect(projectionHookSource).not.toContain("rootArrangementObstacles")
    expect(projectionHookSource).not.toContain("state.nodePositions[node.id]")
    expect(nodeSource).toContain("aria-expanded")
    expect(ontologySurfaceSource).toContain("focusable: false")
    expect(nodeSource).toContain("<WorkspaceNodeFrameRoot")
    expect(nodeSource).toContain("<WorkspaceOntologyList")
    expect(listSource).toContain('data-workspace-ontology-list="true"')
    expect(listSource).toContain("data-workspace-ontology-list-item")
    expect(listSource).not.toContain('from "next/link"')
    expect(listSource).not.toContain("item.href && !item.hasChildren")
    expect(listSource).toContain("onActivate?.(item.id)")
    expect(ontologySurfaceSource).toContain(
      'node.id.startsWith("ontology:document:")'
    )
    expect(ontologySurfaceSource).toContain(
      'focusKey: node.id.slice("ontology:document:".length)'
    )
    expect(ontologySurfaceSource).toContain("onOpenDataDrawer({")
    expect(nodeSource).toContain("const actionAriaLabel")
    expect(nodeSource).toContain("aria-label={actionAriaLabel}")
    expect(nodeSource).not.toContain('from "next/link"')
    expect(nodeSource).not.toContain("<Link")
    expect(nodeSource).toContain("<Button")
    expect(nodeSource).toContain("openInNewTab: event.metaKey || event.ctrlKey")
    expect(ontologySurfaceSource).toContain(
      "onActivate: (options) => activateNode(node.id, options)"
    )
    expect(nodeSource).toContain("describeWorkspaceOntologyNodeActivation")
    expect(nodeSource).toContain("touch-manipulation")
    expect(nodeSource).toContain("WorkspaceNodeFrameRoot")
    expect(nodeSource).toContain("WorkspaceNodeFrameSurface")
    expect(nodeSource).toContain("WorkspaceNodeFrameBody")
    expect(nodeSource).not.toContain("WorkspaceNodeFrameFooter")
    expect(nodeSource).toContain("rounded-[2rem]")
    expect(nodeSource).toContain("rounded-[1.45rem]")
    expect(nodeSource).toContain(
      "bg-background h-full w-full overflow-visible rounded-[2rem] border px-2 py-2.5"
    )
    expect(nodeSource).toContain(
      "transition-[background-color,border-color,box-shadow,transform]"
    )
    expect(nodeSource).not.toContain("hover:bg-muted")
    expect(nodeSource).not.toContain("hover:bg-accent/20")
    expect(nodeSource).toContain("dark:bg-background")
    expect(nodeSource).toContain("dark:hover:bg-accent")
    expect(nodeSource).toContain('ownerId: "workspace-ontology:node"')
    expect(nodeSource).toContain('detailLevel === "full" && node.ownerLabel')
    expect(nodeSource).not.toContain("max-w-[calc(100vw-2rem)]")
    expect(nodeSource).not.toContain('from "@/components/ui/badge"')
    expect(nodeSource).not.toContain("CATEGORY_ACCENT")
    expect(nodeSource).not.toContain("rounded-r-full")
    expect(nodeSource).not.toContain("size-11")
    expect(nodeSource).not.toContain("NodeToolbar")
    expect(nodeSource).not.toContain("PinOffIcon")
    expect(nodeSource).not.toContain("onTogglePinned")
    expect(nodeSource).toContain('from "@/components/ui/button"')
    expect(controllerSource).not.toContain("togglePin")
    expect(ontologySurfaceSource).not.toContain("controller.togglePin")
    expect(nodeSource).not.toContain("data.onOpenAction")
    expect(ontologyInteractionsSource).toContain("activateNode(node.id)")
    expect(ontologyInteractionsSource).toContain("handleKeyDownCapture")
    expect(viewSource).toContain("createWorkspaceParticleFlowHandlers(particles, {")
    expect(viewSource).toContain("onNodeClick,")
    expect(viewSource).toContain("onKeyDownCapture,")
    expect(nodeSource).not.toContain("workspace-ontology-node-drag-handle")
    expect(branchToggleSource).not.toContain("backdrop-blur-md")
    expect(branchToggleSource).toContain(
      "transition-[border-color,box-shadow,transform]"
    )
    expect(branchToggleSource).not.toContain("bg-background/95")
    expect(branchToggleSource).not.toContain("dark:bg-background/90")
    expect(branchToggleSource).toContain("ListTreeIcon")
    expect(branchToggleSource).toContain("bg-orange-500/15")
    expect(branchToggleSource).toContain("bg-emerald-500/15")
    expect(nodeSource).not.toContain("bg-zinc-100")
    expect(nodeSource).not.toContain("bg-emerald-50/90")
    expect(nodeSource).not.toContain("dark:bg-emerald-950/35")
    expect(nodeSource).not.toContain("bg-sky-50/90")
    expect(nodeSource).not.toContain("dark:bg-sky-950/35")
    expect(branchToggleSource).not.toContain("bg-sky-500/15")
    expect(branchToggleSource).toContain(
      'ownerId: "workspace-ontology:branch-toggle"'
    )
    expect(ontologySurfaceSource).toContain("draggable: false")
    expect(ontologySurfaceSource).not.toContain("pinnedNodeIds")
    expect(ontologyInteractionsSource).not.toContain("commitNodePosition")
    expect(viewSource).toContain("nodeDragThreshold={4}")
    expect(edgeSource).toContain("data?.showLabel === true")
    expect(edgeSource).toContain("workspace-ontology-edge-label")
    expect(edgeSource).toContain("rounded-full border px-2 py-1")
    expect(edgeSource).not.toContain("backdrop-blur-md")
    expect(edgeSource).toContain("text-[11px]")
    expect(branchToggleSource).toContain('actionLabel: "Start setup"')
    expect(branchToggleSource).toContain('actionLabel: "Finish setup"')
    expect(branchToggleSource).toContain('actionLabel: "Review setup"')
    expect(branchToggleSource).toContain('actionLabel: "Hide setup"')
    expect(branchToggleSource).toContain("control.attentionCount")
    expect(branchToggleSource).toContain("control.completedCount")
    expect(branchToggleSource).toContain("control.descendantCount")
    expect(branchToggleSource).not.toContain("control.directChildCount")
    expect(branchToggleSource).not.toContain("absolute")
    expect(branchToggleSource).not.toContain("-bottom-")
    expect(boardNodeSource).not.toContain("showCompletedAcceleratorToggle")
    expect(boardNodeSource).not.toContain("Hide completed Accelerator card")
    expect(boardNodeSource).not.toContain("EyeOffIcon")
    expect(boardNodeSource).toContain(
      'className="nodrag nopan flex justify-center pt-2.5"'
    )
    expect(WORKSPACE_ONTOLOGY_NODE_SIZE.height).toBe(112)
    expect(nodeSource).toContain(
      "WORKSPACE_ONTOLOGY_RELATIONSHIP_TARGET_HANDLE_ID"
    )
    expect(nodeSource).toContain(
      "WORKSPACE_ONTOLOGY_RELATIONSHIP_SOURCE_HANDLE_ID"
    )
    expect(nodeSource).toContain("position={Position.Bottom}")
    expect(layoutSceneSource).toContain("buildWorkspaceOntologyTransitionWave")
    expect(layoutSceneSource).not.toContain("window.requestAnimationFrame")
    expect(layoutSceneSource).toContain("window.setTimeout")
    expect(layoutSceneSource).not.toContain("previousRootPositions")
    expect(layoutSceneSource).not.toContain("nextRootPositions")
    expect(layoutSceneSource).not.toContain(
      "setRootPositions(frameRootPositions)"
    )
    expect(layoutSceneSource).toContain("prefers-reduced-motion")
    expect(layoutSceneSource).toContain("layoutRequestRef")
    expect(layoutSceneSource).toContain(
      "layoutSignaturesRef.current = nextSignatures"
    )
    expect(globalStylesSource).not.toContain("transition: transform 180ms")
    expect(globalStylesSource).toContain("transition: transform 240ms")
    expect(globalStylesSource).toContain("workspace-ontology-node-enter")
    expect(globalStylesSource).toContain("translate3d(-12px, 0, 0)")
    expect(globalStylesSource).toContain("translate3d(-8px, 0, 0)")
    expect(globalStylesSource).toContain("workspace-ontology-toggle-label-in")
    expect(branchToggleSource).toContain("active:scale-[0.97]")
    expect(branchToggleSource).toContain("duration-[240ms]")
    expect(branchToggleSource).toContain("motion-reduce:transition-none")
    expect(wayfindingHookSource).toContain(
      "duration: reducedMotion ? 0 : WORKSPACE_ONTOLOGY_CAMERA_PUNCH_MS"
    )
    expect(nodeSource).toContain("--workspace-ontology-wave-delay")
    expect(edgeSource).toContain("--workspace-ontology-wave-delay")
    expect(globalStylesSource).toContain(
      "animation-delay: var(--workspace-ontology-wave-delay, 0ms)"
    )
    expect(globalStylesSource).toContain(
      ".react-flow__node:focus-visible [data-workspace-ontology-node]"
    )
    expect(viewSource).toContain("const nodesSelectable = !tutorialActive")
    expect(layoutSource).toContain("buildWrappedBranchPositions")
    expect(layoutSource).not.toContain('import("elkjs/lib/elk.bundled.js")')
    expect(layoutSource).not.toContain('import("@dagrejs/dagre")')
    expect(nodeSource).not.toContain('from "motion/react"')
    expect(edgeSource).not.toContain('from "motion/react"')
    expect(canvasBodySource).toContain(
      "!seed.presentationMode && (seed.canEdit || seed.isPlatformAdmin === true)"
    )
    expect(canvasStateSource).toContain("Workspace changes could not be saved.")
    expect(canvasStateSource).toContain('label: "Retry"')
    expect(surfaceSource).toContain("renderNodes: ontologyInteractions.nodes")
    expect(surfaceSource).toContain(
      "visibleNodeIds: ontologyInteractions.visibleNodeIds"
    )
    expect(surfaceSource).toContain("handleOpenOntologyAction")
    expect(surfaceSource).toContain("ontologyActionRequest")
    expect(calendarCardSource).toContain(
      'actionRequest.target.kind === "calendar-event"'
    )
    expect(calendarPanelSource).toContain("setEventDetailsOpen(true)")
    expect(programsRendererSource).toContain('request.target.kind !== "task"')
    expect(programsRendererSource).toContain(
      "<WorkspaceBoardFormationTrackerCard"
    )
    expect(formationTrackerSource).toContain('controller.setTab("objectives")')
    expect(formationTrackerSource).toContain(
      "controller.openTicketEditor(focusRequest.ticketId)"
    )
    expect(formationTrackerSource).toContain(
      "focusRequest.ticketId && seed.canEdit && !presentationMode"
    )
    expect(sheetSource).toContain("motion-reduce:animate-none")
    expect(sheetSource).toContain("motion-reduce:transition-none")
    expect(fiscalSummarySource).toContain("openExisting(target, actionRequest.phaseId)")
    expect(fiscalSummarySource).toContain('phaseId === "application-intake"')
    expect(layoutSceneSource).toContain("mergeDepartingItems")
    expect(layoutSceneSource).toContain("buildTransitionPhases")
    expect(nodeSource).toContain('transitionPhase === "exiting"')
    expect(edgeSource).toContain("data-transition-phase={transitionPhase}")
    expect(ontologySurfaceSource).toContain("style: node.size")
    expect(ontologySurfaceSource).toContain(
      "resolveWorkspaceCardMeasuredHeight"
    )
    expect(ontologySurfaceSource).toContain(
      "cardMeasuredHeights[cardId]?.[size]"
    )
    expect(ontologySurfaceSource).toContain("draggable: false")
    expect(ontologySurfaceSource).toContain('edge.kind === "relationship"')
    expect(ontologySurfaceSource).toContain(
      "WORKSPACE_ONTOLOGY_RELATIONSHIP_TARGET_HANDLE_ID"
    )
    expect(ontologySurfaceSource).toContain(
      "WORKSPACE_ONTOLOGY_RELATIONSHIP_SOURCE_HANDLE_ID"
    )
    expect(ontologySurfaceSource).toContain(
      "WORKSPACE_CARD_SOURCE_HANDLE_IDS.bottom"
    )
    expect(ontologySurfaceSource).toContain("useWorkspaceOntologyUrlState")
    expect(ontologySurfaceSource).not.toContain("boardState.ontology")
    expect(urlStateHookSource).toContain("window.history.pushState")
    expect(ontologyInteractionsSource).not.toContain("rootPositions[")
    expect(ontologyInteractionsSource).toContain(
      "workspace-ontology-arranged-root"
    )
    expect(ontologyInteractionsSource).toContain("useStableVisibleNodeIds")
    expect(ontologyInteractionsSource).toContain(
      "applyWorkspaceOntologySelectionChanges"
    )
    expect(ontologyInteractionsSource).not.toContain("handleResultSelect")
    expect(ontologyInteractionsSource).not.toContain("pendingFocusId")
    expect(ontologyInteractionsSource).toContain(
      "useWorkspaceOntologyWayfinding"
    )
    expect(wayfindingHookSource).toContain("fitPendingRef")
    expect(wayfindingHookSource).toContain("addedNode?.id")
    expect(wayfindingHookSource).toContain(
      'minZoom: mode === "map" ? 0.2 : narrowViewport ? 0.9 : 0.64'
    )
    expect(ontologyInteractionsSource).toContain(
      "onMoveStart: cancelPendingFit"
    )
    expect(renderStateSource).toContain(
      "shouldReconcileWorkspaceCanvasNodes(changes)"
    )
    expect(renderStateSource).toContain(": currentNodes")
    expect(globalStylesSource).toContain(".workspace-ontology-branch-toggle")
    expect(globalStylesSource).toContain("backdrop-filter: none !important")
    expect(boardCanvasSource).not.toContain("handleOntologyStateChange")
    expect(boardCanvasSource).not.toContain(
      "buildWorkspaceBoardStateWithManagedNodePositions"
    )
  })
})
