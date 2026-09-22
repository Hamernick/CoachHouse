import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { workspaceCanvasSurfaceV2Mock, workspaceRealtimeCursorsOverlayMock } =
  vi.hoisted(() => ({
    workspaceCanvasSurfaceV2Mock: vi.fn((_props: unknown) => null),
    workspaceRealtimeCursorsOverlayMock: vi.fn((_props: unknown) => null),
  }))

vi.mock(
  "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2",
  () => ({
    WorkspaceCanvasSurfaceV2: (props: unknown) => {
      workspaceCanvasSurfaceV2Mock(props)
      return null
    },
  })
)

vi.mock(
  "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-flow-surface-cursors",
  () => ({
    WorkspaceRealtimeCursorsOverlay: (props: unknown) => {
      workspaceRealtimeCursorsOverlayMock(props)
      return null
    },
  })
)

import {
  WorkspaceBoardFlowSurface,
  type WorkspaceBoardFlowSurfaceProps,
} from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-flow-surface"

function createProps(
  overrides: Partial<WorkspaceBoardFlowSurfaceProps> = {}
): WorkspaceBoardFlowSurfaceProps {
  return {
    seed: {
      viewerName: "Caleb Hamernick",
    } as WorkspaceBoardFlowSurfaceProps["seed"],
    organizationEditorData:
      {} as WorkspaceBoardFlowSurfaceProps["organizationEditorData"],
    financeInput: {},
    boardState: {} as WorkspaceBoardFlowSurfaceProps["boardState"],
    allowEditing: true,
    workspaceDataDrawerCanEdit: true,
    presentationMode: false,
    workspaceRoomName: "org:org-1:workspace",
    layoutFitRequestKey: 0,
    acceleratorFocusRequestKey: 0,
    tutorialRestartRequestKey: 0,
    onInitialOnboardingSubmit: vi.fn(async () => {}),
    focusCardRequest: {} as WorkspaceBoardFlowSurfaceProps["focusCardRequest"],
    tutorialCompletionExitRequest:
      {} as WorkspaceBoardFlowSurfaceProps["tutorialCompletionExitRequest"],
    journeyGuideState:
      {} as WorkspaceBoardFlowSurfaceProps["journeyGuideState"],
    onSizeChange: vi.fn(),
    onCommunicationsChange: vi.fn(),
    onTrackerChange: vi.fn(),
    onAcceleratorStateChange: vi.fn(),
    onOpenAcceleratorStepNode: vi.fn(),
    onCloseAcceleratorStepNode: vi.fn(),
    onTutorialPrevious: vi.fn(),
    onTutorialNext: vi.fn(),
    onTutorialRestart: vi.fn(),
    onTutorialShortcutOpened: vi.fn(),
    onFocusCard: vi.fn(),
    onOnboardingFlowChange: vi.fn(),
    onParticlesChange: vi.fn(),
    onPersistNodePosition: vi.fn(),
    onToggleCardVisibility: vi.fn(),
    onConnectCards: vi.fn(),
    onDisconnectConnection: vi.fn(),
    onDisconnectAllConnections: vi.fn(),
    onResetDefaultConnections: vi.fn(),
    onCursorConnectionStateChange: vi.fn(),
    onTutorialCompletionExitHandled: vi.fn(),
    ...overrides,
  }
}

describe("WorkspaceBoardFlowSurface", () => {
  beforeEach(() => {
    workspaceCanvasSurfaceV2Mock.mockClear()
    workspaceRealtimeCursorsOverlayMock.mockClear()
  })

  it("mounts the board-only realtime cursor overlay with the workspace room and callback", () => {
    const onCursorConnectionStateChange = vi.fn()

    renderToStaticMarkup(
      createElement(WorkspaceBoardFlowSurface, {
        ...createProps({
          onCursorConnectionStateChange,
        }),
      })
    )

    expect(workspaceCanvasSurfaceV2Mock).toHaveBeenCalledTimes(1)
    expect(workspaceCanvasSurfaceV2Mock.mock.calls[0]?.[0]).toMatchObject({
      workspaceDataDrawerCanEdit: true,
    })
    expect(workspaceRealtimeCursorsOverlayMock).toHaveBeenCalledTimes(1)
    expect(
      workspaceRealtimeCursorsOverlayMock.mock.calls[0]?.[0]
    ).toMatchObject({
      roomName: "org:org-1:workspace",
      username: "Caleb Hamernick",
      suspendPublishing: false,
      onConnectionStateChange: onCursorConnectionStateChange,
    })
  })

  it("suspends local cursor publishing while keeping the overlay mounted in presentation mode", () => {
    renderToStaticMarkup(
      createElement(WorkspaceBoardFlowSurface, {
        ...createProps({
          presentationMode: true,
        }),
      })
    )

    expect(
      workspaceRealtimeCursorsOverlayMock.mock.calls[0]?.[0]
    ).toMatchObject({
      roomName: "org:org-1:workspace",
      suspendPublishing: true,
    })
  })
})
