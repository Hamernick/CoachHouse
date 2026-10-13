import { describe, expect, it } from "vitest"

import {
  applyAutoLayout,
  buildDefaultBoardState,
  buildPresetNodes,
  normalizeWorkspaceBoardState,
  resolveCardDimensions,
  resolveWorkspaceCardCanvasShellClassName,
  resolveWorkspaceCardCanvasShellStyle,
  resolveWorkspaceCardHeightModeClassName,
  sanitizeWorkspaceBoardHiddenState,
  toggleWorkspaceBoardCardVisibility,
} from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-layout"

import {
  WORKSPACE_CARD_IDS,
  type WorkspaceNodeState,
} from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-types"

describe("workspace board layout", () => {
  function findNode(nodes: WorkspaceNodeState[], id: WorkspaceNodeState["id"]) {
    const node = nodes.find((entry) => entry.id === id)
    expect(node).toBeTruthy()
    return node!
  }

  it("builds a complete default board", () => {
    const state = buildDefaultBoardState("balanced")
    expect(state.nodes).toHaveLength(WORKSPACE_CARD_IDS.length)
    expect(state.autoLayoutMode).toBe("timeline")
    expect(state.communications.channel).toBe("social")
    expect(state.communications.mediaMode).toBe("text")
    expect(state.communications.copy.length).toBeGreaterThan(0)
    expect(state.onboardingFlow.tutorialStepIndex).toBe(0)

    const ids = new Set(state.nodes.map((node) => node.id))
    expect(ids.size).toBe(WORKSPACE_CARD_IDS.length)
    for (const id of WORKSPACE_CARD_IDS) {
      expect(ids.has(id)).toBe(true)
    }
    expect(state.hiddenCardIds).toEqual(
      expect.arrayContaining([
        "deck",
        "brand-kit",
        "economic-engine",
        "communications",
        "atlas",
        "fiscal-sponsorship",
      ])
    )
  })

  it("starts Organization and Activity together without overlapping visible cards", () => {
    const state = buildDefaultBoardState()
    const organization = findNode(state.nodes, "organization-overview")
    const activity = findNode(state.nodes, "programs")
    const accelerator = findNode(state.nodes, "accelerator")
    const roadmap = findNode(state.nodes, "roadmap")
    expect(activity.y).toBe(organization.y)
    expect(activity.x).toBeGreaterThan(organization.x)
    expect(accelerator.x).toBe(organization.x)
    expect(roadmap.x).toBe(activity.x)
    expect(accelerator.y).toBe(roadmap.y)
    expect(accelerator.y).toBeGreaterThan(activity.y)
    const visible = state.nodes.filter((node) => !state.hiddenCardIds.includes(node.id))
    for (const [index, node] of visible.entries()) {
      const size = resolveCardDimensions(node.size, node.id)
      for (const other of visible.slice(index + 1)) {
        const otherSize = resolveCardDimensions(other.size, other.id)
        expect(
          node.x + size.width <= other.x || other.x + otherSize.width <= node.x ||
          node.y + size.height <= other.y || other.y + otherSize.height <= node.y
        ).toBe(true)
      }
    }
    expect(normalizeWorkspaceBoardState(state).nodes).toEqual(state.nodes)
  })

  it("retains an existing organization's moved cards when loading the board", () => {
    const state = buildDefaultBoardState()
    state.nodes = state.nodes.map((node) => ({ ...node, x: node.x + 1600, y: node.y - 800, positionMode: "manual" }))
    expect(normalizeWorkspaceBoardState(state).nodes).toEqual(state.nodes)
  })

  it("clamps communications cards away from small sizing during normalization", () => {
    const normalized = normalizeWorkspaceBoardState({
      nodes: [
        {
          id: "communications",
          x: 10,
          y: 20,
          size: "sm",
        },
      ],
    })

    const communications = normalized.nodes.find(
      (node) => node.id === "communications"
    )
    expect(communications?.size).toBe("md")
  })

  it("infers managed and manual ownership for legacy node positions", async () => {
    const defaults = buildDefaultBoardState()
    const timelineNodes = await applyAutoLayout(defaults.nodes, "timeline", {
      hiddenCardIds: defaults.hiddenCardIds,
    })
    const legacyNodes = timelineNodes.map((node) => {
      const { positionMode: _positionMode, ...legacyNode } = node
      return node.id === "programs"
        ? { ...legacyNode, x: legacyNode.x + 120 }
        : legacyNode
    })

    const normalized = normalizeWorkspaceBoardState({ nodes: legacyNodes })

    expect(
      normalized.nodes.find((node) => node.id === "organization-overview")
        ?.positionMode
    ).toBe("managed")
    expect(
      normalized.nodes.find((node) => node.id === "programs")?.positionMode
    ).toBe("manual")
  })

  it("migrates legacy hub layout mode to dagre tree", () => {
    const normalized = normalizeWorkspaceBoardState({
      autoLayoutMode: "hub",
    })

    expect(normalized.autoLayoutMode).toBe("dagre-tree")
  })

  it("migrates persisted roadmap accelerator edges to the organization-owned accelerator edge", () => {
    const normalized = normalizeWorkspaceBoardState({
      connections: [
        {
          id: "edge-organization-to-programs",
          source: "organization-overview",
          target: "programs",
        },
        {
          id: "edge-roadmap-to-accelerator",
          source: "roadmap",
          target: "accelerator",
        },
      ],
    })

    expect(normalized.connections).toEqual(
      expect.arrayContaining([
        {
          id: "edge-organization-to-programs",
          source: "organization-overview",
          target: "programs",
        },
        {
          id: "edge-organization-to-accelerator",
          source: "organization-overview",
          target: "accelerator",
        },
      ])
    )
    expect(normalized.connections).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "roadmap",
          target: "accelerator",
        }),
      ])
    )
  })

  it("does not duplicate the organization accelerator edge when migrating legacy board state", () => {
    const normalized = normalizeWorkspaceBoardState({
      connections: [
        {
          id: "edge-roadmap-to-accelerator",
          source: "roadmap",
          target: "accelerator",
        },
        {
          id: "edge-organization-to-accelerator",
          source: "organization-overview",
          target: "accelerator",
        },
      ],
    })

    expect(
      normalized.connections.filter(
        (connection) =>
          connection.source === "organization-overview" &&
          connection.target === "accelerator"
      )
    ).toHaveLength(1)
  })

  it("migrates persisted organization fiscal edges to Activity-owned fiscal edges", () => {
    const normalized = normalizeWorkspaceBoardState({
      connections: [
        {
          id: "edge-organization-to-fiscal-sponsorship",
          source: "organization-overview",
          target: "fiscal-sponsorship",
        },
      ],
    })

    expect(normalized.connections).toEqual(
      expect.arrayContaining([
        {
          id: "edge-activity-to-fiscal-sponsorship",
          source: "programs",
          target: "fiscal-sponsorship",
        },
      ])
    )
    expect(normalized.connections).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "organization-overview",
          target: "fiscal-sponsorship",
        }),
      ])
    )
  })

  it("round-trips future card layout state without exposing unknown cards to the current canvas", () => {
    const futureFinanceNode = {
      id: "finance",
      x: 820,
      y: 640,
      size: "lg",
      positionMode: "manual",
      futureMetadata: { view: "overview" },
    }
    const futureFinanceConnection = {
      id: "edge-organization-to-finance",
      source: "organization-overview",
      target: "finance",
      futureMetadata: { emphasis: "primary" },
    }
    const normalized = normalizeWorkspaceBoardState({
      nodes: [futureFinanceNode],
      connections: [futureFinanceConnection],
      hiddenCardIds: ["finance"],
    })

    expect(normalized.nodes.map((node) => node.id)).not.toContain("finance")
    expect(
      normalized.connections.map((connection) => connection.target)
    ).not.toContain("finance")
    expect(normalized.hiddenCardIds).not.toContain("finance")
    expect(normalized.forwardCompatibility).toEqual({
      nodes: [futureFinanceNode],
      connections: [futureFinanceConnection],
      hiddenCardIds: ["finance"],
    })

    expect(
      normalizeWorkspaceBoardState(normalized).forwardCompatibility
    ).toEqual(normalized.forwardCompatibility)
  })

  it("keeps the communications card wider at medium and large sizes", () => {
    expect(resolveCardDimensions("md", "communications")).toEqual({
      width: 560,
      height: 620,
    })
    expect(resolveCardDimensions("lg", "communications")).toEqual({
      width: 640,
      height: 720,
    })
  })

  it("keeps the tasks card aligned to the organization card width", () => {
    expect(resolveCardDimensions("md", "deck")).toEqual({
      width: 552,
      height: 708,
    })
    expect(resolveCardDimensions("lg", "deck")).toEqual({
      width: 560,
      height: 780,
    })
  })

  it("keeps the compact accelerator node wide enough for disclosure rows", () => {
    expect(resolveCardDimensions("sm", "accelerator")).toEqual({
      width: 520,
      height: 252,
    })
    expect(resolveCardDimensions("md", "accelerator")).toEqual({
      width: 640,
      height: 520,
    })
  })

  it("derives card shell height mode from the shared layout contract", () => {
    expect(
      resolveWorkspaceCardHeightModeClassName("organization-overview")
    ).toBe("h-auto")
    expect(resolveWorkspaceCardHeightModeClassName("programs")).toBe("h-auto")
    expect(resolveWorkspaceCardHeightModeClassName("accelerator")).toBe(
      "h-auto"
    )
    expect(resolveWorkspaceCardHeightModeClassName("roadmap")).toBe("h-auto")
    expect(resolveWorkspaceCardHeightModeClassName("deck")).toBe("h-auto")
    expect(resolveWorkspaceCardHeightModeClassName("fiscal-sponsorship")).toBe(
      "h-auto"
    )
  })

  it("keeps auto-height card shells intrinsic while fixed cards retain canvas heights", () => {
    expect(resolveCardDimensions("sm", "fiscal-sponsorship")).toMatchObject({
      width: 440,
      height: 456,
    })
    expect(resolveCardDimensions("md", "fiscal-sponsorship")).toMatchObject({
      width: 440,
      height: 456,
    })

    expect(
      resolveWorkspaceCardCanvasShellStyle({
        size: "sm",
        cardId: "accelerator",
      })
    ).toBeUndefined()

    expect(
      resolveWorkspaceCardCanvasShellStyle({
        size: "sm",
        cardId: "roadmap",
      })
    ).toBeUndefined()

    expect(
      resolveWorkspaceCardCanvasShellClassName({
        size: "sm",
        cardId: "accelerator",
      })
    ).toContain("h-auto")
    expect(
      resolveWorkspaceCardCanvasShellClassName({
        size: "sm",
        cardId: "roadmap",
      })
    ).toContain("h-auto")
    expect(
      resolveWorkspaceCardCanvasShellStyle({
        size: "md",
        cardId: "deck",
      })
    ).toBeUndefined()
    expect(
      resolveWorkspaceCardCanvasShellClassName({
        size: "md",
        cardId: "deck",
      })
    ).toContain("h-auto")
    expect(
      resolveWorkspaceCardCanvasShellStyle({
        size: "sm",
        cardId: "fiscal-sponsorship",
      })
    ).toBeUndefined()
    expect(
      resolveWorkspaceCardCanvasShellClassName({
        size: "sm",
        cardId: "fiscal-sponsorship",
      })
    ).toContain("h-auto")
    expect(
      resolveWorkspaceCardCanvasShellClassName({
        size: "sm",
        cardId: "fiscal-sponsorship",
      })
    ).not.toContain("shadow-none")
    expect(
      resolveWorkspaceCardCanvasShellClassName({
        size: "sm",
        cardId: "fiscal-sponsorship",
      })
    ).not.toContain("border-border/70 border")
    expect(
      resolveWorkspaceCardCanvasShellClassName({
        size: "sm",
        cardId: "fiscal-sponsorship",
      })
    ).not.toContain("rounded-[20px]")
    expect(
      resolveWorkspaceCardCanvasShellClassName({
        size: "sm",
        cardId: "fiscal-sponsorship",
      })
    ).not.toContain("max-w-[42rem]")
    expect(
      resolveWorkspaceCardCanvasShellClassName({
        size: "sm",
        cardId: "fiscal-sponsorship",
      })
    ).not.toContain("rounded-[2rem] p-3 shadow-sm")
    expect(
      resolveWorkspaceCardCanvasShellClassName({
        size: "sm",
        cardId: "programs",
        isCanvasFullscreen: true,
      })
    ).toContain("h-full w-full max-w-none")
  })

  it("keeps the fiscal sponsorship tile hidden by default but revealable", () => {
    const initial = buildDefaultBoardState("balanced")
    expect(initial.hiddenCardIds).toContain("fiscal-sponsorship")

    const visible = toggleWorkspaceBoardCardVisibility(
      initial,
      "fiscal-sponsorship"
    )
    expect(visible.hiddenCardIds).not.toContain("fiscal-sponsorship")
    expect(visible.hiddenCardIds).not.toContain("organization-overview")
  })

  it("preserves fiscal sponsorship positions when the tile is already visible", () => {
    const initial = buildDefaultBoardState("balanced")
    const visibleHiddenCardIds = initial.hiddenCardIds.filter(
      (cardId) => cardId !== "fiscal-sponsorship"
    )
    const normalized = normalizeWorkspaceBoardState({
      ...initial,
      hiddenCardIds: visibleHiddenCardIds,
      nodes: initial.nodes.map((node) =>
        node.id === "fiscal-sponsorship" ? { ...node, x: 728, y: 760 } : node
      ),
    })
    const fiscalSponsorship = findNode(normalized.nodes, "fiscal-sponsorship")

    expect(normalized.hiddenCardIds).not.toContain("fiscal-sponsorship")
    expect(fiscalSponsorship).toMatchObject({
      x: 728,
      y: 760,
    })

    const priorDefaultPosition = normalizeWorkspaceBoardState({
      ...initial,
      hiddenCardIds: visibleHiddenCardIds,
      nodes: initial.nodes.map((node) =>
        node.id === "fiscal-sponsorship" ? { ...node, x: 64, y: 720 } : node
      ),
    })

    expect(
      findNode(priorDefaultPosition.nodes, "fiscal-sponsorship")
    ).toMatchObject({
      x: 64,
      y: 720,
    })

    const manuallyPlaced = normalizeWorkspaceBoardState({
      ...initial,
      hiddenCardIds: visibleHiddenCardIds,
      nodes: initial.nodes.map((node) =>
        node.id === "fiscal-sponsorship" ? { ...node, x: 320, y: 904 } : node
      ),
    })

    expect(findNode(manuallyPlaced.nodes, "fiscal-sponsorship")).toMatchObject({
      x: 320,
      y: 904,
    })
  })

  it("hides fiscal sponsorship for legacy saved boards until users reveal it", () => {
    const legacyNodeIds = WORKSPACE_CARD_IDS.filter(
      (cardId) => cardId !== "fiscal-sponsorship"
    )
    const normalized = normalizeWorkspaceBoardState({
      nodes: legacyNodeIds.map((id, index) => ({
        id,
        x: index * 16,
        y: index * 8,
        size: "md",
      })),
      hiddenCardIds: ["brand-kit", "deck", "atlas"],
    })

    expect(normalized.hiddenCardIds).toContain("fiscal-sponsorship")

    const revealed = toggleWorkspaceBoardCardVisibility(
      normalized,
      "fiscal-sponsorship"
    )
    const renormalized = normalizeWorkspaceBoardState(revealed)
    expect(renormalized.hiddenCardIds).not.toContain("fiscal-sponsorship")
  })

  it("keeps deck hidden when restoring legacy hidden-card defaults", () => {
    const normalized = normalizeWorkspaceBoardState({
      hiddenCardIds: [
        "brand-kit",
        "deck",
        "atlas",
        "economic-engine",
        "communications",
      ],
    })

    expect(normalized.hiddenCardIds).toContain("deck")
  })

  it("normalizes partial payloads into a full board", () => {
    const normalized = normalizeWorkspaceBoardState({
      preset: "calendar-focused",
      nodes: [
        {
          id: "calendar",
          x: 10,
          y: 20,
          size: "sm",
        },
      ],
      communications: {
        channel: "email",
        mediaMode: "video",
        copy: "Board update draft",
        scheduledFor: "2026-02-23T15:00:00.000Z",
        connectedChannels: {
          email: true,
        },
      },
    })

    expect(normalized.preset).toBe("calendar-focused")
    expect(normalized.nodes).toHaveLength(WORKSPACE_CARD_IDS.length)
    expect(normalized.communications.channel).toBe("email")
    expect(normalized.communications.mediaMode).toBe("video")
    expect(normalized.communications.copy).toBe("Board update draft")
    expect(normalized.onboardingFlow.tutorialStepIndex).toBe(0)
    expect(normalized.communications.connectedChannels.email).toBe(true)
    expect(normalized.communications.connectedChannels.social).toBe(false)
    expect(normalized.communications.channelConnections.email.connected).toBe(
      true
    )
    expect(normalized.communications.channelConnections.social.connected).toBe(
      false
    )
    const calendar = normalized.nodes.find((node) => node.id === "calendar")
    expect(calendar?.x).toBe(10)
    expect(calendar?.y).toBe(20)
  })

  it("normalizes malformed communications payload safely", () => {
    const normalized = normalizeWorkspaceBoardState({
      communications: {
        channel: "unknown",
        mediaMode: "unknown",
        copy: "",
        scheduledFor: "not-a-date",
        connectedChannels: {
          social: "yes",
        },
        activityByDay: {
          "2026-02-20": {
            status: "posted",
            channel: "blog",
            timestamp: "2026-02-20T11:00:00.000Z",
          },
          nope: {
            status: "draft",
          },
        },
      },
    })

    expect(normalized.communications.channel).toBe("social")
    expect(normalized.communications.mediaMode).toBe("text")
    expect(normalized.communications.copy.length).toBeGreaterThan(0)
    expect(normalized.communications.connectedChannels.social).toBe(true)
    expect(normalized.communications.connectedChannels.email).toBe(false)
    expect(normalized.communications.channelConnections.social.connected).toBe(
      true
    )
    expect(normalized.communications.channelConnections.email.connected).toBe(
      false
    )
    expect(Object.keys(normalized.communications.activityByDay)).toContain(
      "2026-02-20"
    )
    expect(Object.keys(normalized.communications.activityByDay)).not.toContain(
      "nope"
    )
  })

  it("normalizes malformed accelerator progress payload safely", () => {
    const normalized = normalizeWorkspaceBoardState({
      accelerator: {
        activeStepId: 42,
        completedStepIds: ["module-1:lesson", null, "module-2:assignment", ""],
      },
    })

    expect(normalized.accelerator.activeStepId).toBeNull()
    expect(normalized.accelerator.completedStepIds).toEqual([
      "module-1:lesson",
      "module-2:assignment",
    ])
  })

  it("keeps the organization root visible when payload attempts to hide every card", () => {
    const normalized = normalizeWorkspaceBoardState({
      hiddenCardIds: [...WORKSPACE_CARD_IDS],
    })

    expect(normalized.hiddenCardIds).not.toContain("organization-overview")
    expect(normalized.hiddenCardIds).toContain("accelerator")
  })

  it("allows a root-only visible payload after normalization", () => {
    const normalized = normalizeWorkspaceBoardState({
      hiddenCardIds: WORKSPACE_CARD_IDS.filter(
        (cardId) => cardId !== "roadmap"
      ),
    })

    expect(normalized.hiddenCardIds).not.toContain("organization-overview")
    expect(normalized.hiddenCardIds).toContain("accelerator")
    expect(normalized.hiddenCardIds).not.toContain("roadmap")
  })

  it("removes organization from hidden payloads even when other core cards are hidden", () => {
    const normalized = normalizeWorkspaceBoardState({
      hiddenCardIds: [
        "organization-overview",
        "accelerator",
        "calendar",
        "communications",
      ],
    })

    expect(normalized.hiddenCardIds).not.toContain("organization-overview")
    expect(normalized.hiddenCardIds).toContain("accelerator")
    expect(normalized.hiddenCardIds).toContain("calendar")
    expect(normalized.hiddenCardIds).toContain("communications")
  })

  it("reopening accelerator restores the trunk but leaves descendants hidden", () => {
    const initial = buildDefaultBoardState("balanced")
    const withAcceleratorHidden = toggleWorkspaceBoardCardVisibility(
      initial,
      "accelerator"
    )
    expect(withAcceleratorHidden.hiddenCardIds).toContain("accelerator")
    expect(withAcceleratorHidden.hiddenCardIds).toContain("economic-engine")
    expect(withAcceleratorHidden.hiddenCardIds).toContain("calendar")
    expect(withAcceleratorHidden.hiddenCardIds).toContain("communications")

    const withAcceleratorVisible = toggleWorkspaceBoardCardVisibility(
      withAcceleratorHidden,
      "accelerator"
    )
    expect(withAcceleratorVisible.hiddenCardIds).not.toContain("accelerator")
    expect(withAcceleratorVisible.hiddenCardIds).toEqual([
      "brand-kit",
      "economic-engine",
      "calendar",
      "communications",
      "deck",
      "atlas",
      "fiscal-sponsorship",
    ])
  })

  it("hiding accelerator mutates only accelerator and its descendants", () => {
    const initial = buildDefaultBoardState("balanced")
    const withAcceleratorHidden = toggleWorkspaceBoardCardVisibility(
      initial,
      "accelerator"
    )

    expect(withAcceleratorHidden.hiddenCardIds).toEqual([
      "accelerator",
      "brand-kit",
      "economic-engine",
      "calendar",
      "communications",
      "deck",
      "atlas",
      "fiscal-sponsorship",
    ])
  })

  it("hiding roadmap leaves the organization-owned accelerator branch visible", () => {
    const initial = buildDefaultBoardState("balanced")
    const next = toggleWorkspaceBoardCardVisibility(initial, "roadmap")

    expect(next.hiddenCardIds).toEqual([
      "roadmap",
      "brand-kit",
      "economic-engine",
      "communications",
      "deck",
      "atlas",
      "fiscal-sponsorship",
    ])
    expect(next.hiddenCardIds).not.toContain("organization-overview")
    expect(next.hiddenCardIds).not.toContain("accelerator")
    expect(next.hiddenCardIds).not.toContain("calendar")
  })

  it("keeps accelerator toggles in the same two rooted-tree states", () => {
    let next = buildDefaultBoardState("balanced")
    for (let index = 0; index < 12; index += 1) {
      next = toggleWorkspaceBoardCardVisibility(next, "accelerator")
    }

    expect(next.hiddenCardIds).toEqual([
      "brand-kit",
      "economic-engine",
      "calendar",
      "communications",
      "deck",
      "atlas",
      "fiscal-sponsorship",
    ])
  })

  it("allows hiding accelerator when only two cards are visible", () => {
    const baseline = buildDefaultBoardState("balanced")
    const twoVisibleHiddenCardIds = WORKSPACE_CARD_IDS.filter(
      (cardId) => cardId !== "accelerator" && cardId !== "organization-overview"
    )
    const twoVisibleState = {
      ...baseline,
      hiddenCardIds: twoVisibleHiddenCardIds,
    }

    const after = toggleWorkspaceBoardCardVisibility(
      twoVisibleState,
      "accelerator"
    )
    expect(after.hiddenCardIds).toContain("accelerator")
    expect(after.hiddenCardIds).not.toContain("organization-overview")
  })

  it("does not allow hiding the organization root when only two cards are visible", () => {
    const baseline = buildDefaultBoardState("balanced")
    const twoVisibleHiddenCardIds = WORKSPACE_CARD_IDS.filter(
      (cardId) => cardId !== "accelerator" && cardId !== "organization-overview"
    )
    const twoVisibleState = {
      ...baseline,
      hiddenCardIds: twoVisibleHiddenCardIds,
    }

    const after = toggleWorkspaceBoardCardVisibility(
      twoVisibleState,
      "organization-overview"
    )
    expect(after.hiddenCardIds).not.toContain("organization-overview")
    expect(after.hiddenCardIds).not.toContain("accelerator")
  })

  it("hiding accelerator from a root-plus-accelerator state keeps the root visible", () => {
    const baseline = buildDefaultBoardState("balanced")
    const onlyAcceleratorVisibleState = {
      ...baseline,
      hiddenCardIds: WORKSPACE_CARD_IDS.filter(
        (cardId) => cardId !== "accelerator"
      ),
    }

    const afterHide = toggleWorkspaceBoardCardVisibility(
      onlyAcceleratorVisibleState,
      "accelerator"
    )
    expect(afterHide.hiddenCardIds).toContain("accelerator")
    expect(afterHide.hiddenCardIds).not.toContain("organization-overview")

    const afterReopen = toggleWorkspaceBoardCardVisibility(
      afterHide,
      "accelerator"
    )
    expect(afterReopen.hiddenCardIds).not.toContain("accelerator")
    expect(afterReopen.hiddenCardIds).not.toContain("organization-overview")
  })

  it("hiding accelerator removes the accelerator branch from the visible set", () => {
    const initial = buildDefaultBoardState("balanced")
    const countVisible = (state: ReturnType<typeof buildDefaultBoardState>) =>
      state.nodes.filter((node) => !state.hiddenCardIds.includes(node.id))
        .length

    const before = countVisible(initial)
    const after = countVisible(
      toggleWorkspaceBoardCardVisibility(initial, "accelerator")
    )

    expect(before - after).toBe(2)
  })

  it("does not no-op accelerator toggle when legacy hidden state omitted tool defaults", () => {
    const baseline = buildDefaultBoardState("balanced")
    const legacyState = {
      ...baseline,
      hiddenCardIds: [],
    }

    const after = toggleWorkspaceBoardCardVisibility(legacyState, "accelerator")
    expect(after.hiddenCardIds).toContain("accelerator")
    expect(after.hiddenCardIds).toContain("brand-kit")
    expect(after.hiddenCardIds).toContain("deck")
    expect(after.hiddenCardIds).toContain("atlas")
  })

  it("sanitizes hidden-card payloads into a valid root-only visible state", () => {
    const state = buildDefaultBoardState("balanced")
    const corrupted = {
      ...state,
      hiddenCardIds: [...WORKSPACE_CARD_IDS],
    }

    const sanitized = sanitizeWorkspaceBoardHiddenState(corrupted)
    expect(sanitized.hiddenCardIds).toEqual([
      "programs",
      "accelerator",
      "roadmap",
      "brand-kit",
      "economic-engine",
      "calendar",
      "communications",
      "deck",
      "atlas",
      "fiscal-sponsorship",
    ])
    expect(sanitized.visibility?.allCardsHiddenExplicitly).toBe(false)
  })

  it("preserves a valid root-only visible state for non-explicit all-hidden payloads", () => {
    const state = buildDefaultBoardState("balanced")
    const poisoned = {
      ...state,
      hiddenCardIds: [...WORKSPACE_CARD_IDS],
      visibility: {
        allCardsHiddenExplicitly: false,
      },
    }

    const sanitized = sanitizeWorkspaceBoardHiddenState(poisoned)
    expect(sanitized.hiddenCardIds).toEqual([
      "programs",
      "accelerator",
      "roadmap",
      "brand-kit",
      "economic-engine",
      "calendar",
      "communications",
      "deck",
      "atlas",
      "fiscal-sponsorship",
    ])
    expect(sanitized.visibility?.allCardsHiddenExplicitly).toBe(false)
  })

  it("collapses explicit all-hidden state into a fixed-root state", () => {
    const state = buildDefaultBoardState("balanced")
    const intentionallyAllHidden = {
      ...state,
      hiddenCardIds: [...WORKSPACE_CARD_IDS],
      visibility: {
        allCardsHiddenExplicitly: true,
      },
    }

    const sanitized = sanitizeWorkspaceBoardHiddenState(intentionallyAllHidden)
    expect(sanitized.hiddenCardIds).toEqual([
      "programs",
      "accelerator",
      "roadmap",
      "brand-kit",
      "economic-engine",
      "calendar",
      "communications",
      "deck",
      "atlas",
      "fiscal-sponsorship",
    ])
    expect(sanitized.visibility?.allCardsHiddenExplicitly).toBe(false)
  })

  it("migrates legacy formation-status identifiers to accelerator", () => {
    const normalized = normalizeWorkspaceBoardState({
      nodes: [
        {
          id: "formation-status",
          x: 128,
          y: 256,
          size: "sm",
        },
      ],
      connections: [
        {
          id: "legacy-edge",
          source: "organization-overview",
          target: "formation-status",
        },
      ],
      hiddenCardIds: ["formation-status"],
    })

    const acceleratorNode = normalized.nodes.find(
      (node) => node.id === "accelerator"
    )
    expect(acceleratorNode?.x).toBe(128)
    expect(acceleratorNode?.y).toBe(256)
    expect(
      normalized.connections.some(
        (connection) => connection.target === "accelerator"
      )
    ).toBe(true)
    expect(normalized.hiddenCardIds).toContain("accelerator")
  })

  it("preserves card sizing when applying auto layout", async () => {
    const nodes: WorkspaceNodeState[] = WORKSPACE_CARD_IDS.map((id, index) => ({
      id,
      x: index * 20,
      y: index * 10,
      size: id === "calendar" ? "sm" : "md",
    }))

    const next = await applyAutoLayout(nodes, "communications-focused")
    const calendar = next.find((node) => node.id === "calendar")
    const organization = next.find(
      (node) => node.id === "organization-overview"
    )

    expect(calendar?.size).toBe("sm")
    expect(organization?.size).toBe("md")
    expect(next).toHaveLength(WORKSPACE_CARD_IDS.length)
  })

  it("places roadmap in the former accelerator slot in the dashboard grid preset", () => {
    const nodes = buildPresetNodes("balanced")

    const programs = findNode(nodes, "programs")
    const accelerator = findNode(nodes, "accelerator")
    const roadmap = findNode(nodes, "roadmap")
    const organization = findNode(nodes, "organization-overview")
    const calendar = findNode(nodes, "calendar")
    const brandKit = findNode(nodes, "brand-kit")

    expect(organization.x).toBeLessThan(programs.x)
    expect(programs.x).toBeLessThan(roadmap.x)
    expect(roadmap.x).toBeLessThan(calendar.x)
    expect(accelerator.y).toBeGreaterThan(organization.y)
    expect(brandKit.y).toBeGreaterThan(organization.y)
  })

  it("keeps the calendar-focused preset with calendar between programs and accelerator", async () => {
    const state = buildDefaultBoardState("calendar-focused")
    const laidOut = await applyAutoLayout(state.nodes, "calendar-focused")

    const programs = findNode(laidOut, "programs")
    const accelerator = findNode(laidOut, "accelerator")
    const calendar = findNode(laidOut, "calendar")
    const communications = findNode(laidOut, "communications")
    const organization = findNode(laidOut, "organization-overview")

    expect(organization.x).toBeLessThan(programs.x)
    expect(programs.x).toBeLessThan(calendar.x)
    expect(calendar.x).toBeLessThan(accelerator.x)
    expect(calendar.y).toBeLessThan(communications.y)
  })

  it("keeps the communications-focused preset with communications between programs and accelerator", async () => {
    const state = buildDefaultBoardState("communications-focused")
    const laidOut = await applyAutoLayout(state.nodes, "communications-focused")

    const programs = findNode(laidOut, "programs")
    const accelerator = findNode(laidOut, "accelerator")
    const communications = findNode(laidOut, "communications")
    const calendar = findNode(laidOut, "calendar")
    const organization = findNode(laidOut, "organization-overview")

    expect(organization.x).toBeLessThan(programs.x)
    expect(programs.x).toBeLessThan(communications.x)
    expect(communications.x).toBeLessThan(accelerator.x)
    expect(communications.x).toBeLessThan(calendar.x)
    expect(communications.y).toBeLessThan(calendar.y)
  })

  it("applies dagre-tree autolayout as a horizontal tree", async () => {
    const state = buildDefaultBoardState("balanced")
    const laidOut = await applyAutoLayout(state.nodes, "dagre-tree", {
      connections: state.connections,
    })

    const programs = findNode(laidOut, "programs")
    const roadmap = findNode(laidOut, "roadmap")
    const organization = findNode(laidOut, "organization-overview")
    const accelerator = findNode(laidOut, "accelerator")
    const communications = findNode(laidOut, "communications")
    const economicEngine = findNode(laidOut, "economic-engine")
    const calendar = findNode(laidOut, "calendar")

    expect(organization.x).toBeLessThan(roadmap.x)
    expect(organization.x).toBeLessThan(programs.x)
    expect(programs.x).toBeGreaterThan(organization.x)
    expect(accelerator.x).toBeGreaterThan(roadmap.x)
    expect(accelerator.x).toBeGreaterThan(programs.x)
    expect(communications.x).toBeGreaterThan(accelerator.x)
    expect(economicEngine.x).toBeGreaterThan(accelerator.x)
    expect(calendar.x).toBeGreaterThan(accelerator.x)
    expect(
      new Set([economicEngine.y, calendar.y, communications.y]).size
    ).toBeGreaterThan(1)
  })

  it("applies timeline autolayout with a trunk row and compact leaf stack", async () => {
    const state = buildDefaultBoardState("balanced")
    const laidOut = await applyAutoLayout(state.nodes, "timeline")

    const roadmap = findNode(laidOut, "roadmap")
    const accelerator = findNode(laidOut, "accelerator")
    const organization = findNode(laidOut, "organization-overview")
    const programs = findNode(laidOut, "programs")
    const deck = findNode(laidOut, "deck")
    const fiscalSponsorship = findNode(laidOut, "fiscal-sponsorship")
    const communications = findNode(laidOut, "communications")
    const economicEngine = findNode(laidOut, "economic-engine")
    const calendar = findNode(laidOut, "calendar")

    expect(accelerator.x).toBeLessThan(roadmap.x)
    expect(roadmap.x).toBeLessThan(organization.x)
    expect(organization.x).toBeLessThan(programs.x)
    expect(programs.x).toBeLessThan(deck.x)
    expect(fiscalSponsorship.y).toBeGreaterThan(programs.y)
    expect(fiscalSponsorship.x).toBeGreaterThan(roadmap.x)
    expect(fiscalSponsorship.x).toBe(programs.x)
    expect(economicEngine.x).toBeGreaterThan(deck.x)
    expect(economicEngine.x).toBe(calendar.x)
    expect(calendar.x).toBe(communications.x)
    expect(accelerator.y).toBe(roadmap.y)
    expect(roadmap.y).toBe(organization.y)
    expect(organization.y).toBe(programs.y)
    expect(economicEngine.y).toBeLessThan(calendar.y)
    expect(calendar.y).toBeLessThan(communications.y)
  })
})
