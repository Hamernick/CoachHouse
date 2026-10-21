/* eslint-disable react/no-children-prop -- SSR fixtures provide required children props on shared header components. */
import {
  Children,
  createElement,
  isValidElement,
  type ComponentProps,
  type ReactNode,
} from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createPortal } from "react-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { getCoreRowModel, useReactTable } from "@tanstack/react-table"
import type { OrgPersonWithImage } from "@/components/people/supporters-showcase"
import {
  WorkspaceWindowHeaderProvider,
  WorkspaceWindowHeaderScope,
  WorkspaceWindowHeaderPortal,
} from "@/components/workspace/workspace-window-header-slots"
import { OrgProfileHeaderActions } from "@/components/organization/org-profile-card/header-controls"
import { DocumentsToolbar } from "@/components/organization/org-profile-card/tabs/documents-tab/components/documents-toolbar"
import { DocumentsStorageUsage } from "@/components/organization/org-profile-card/tabs/documents-tab/components/documents-storage-usage"
import { WorkspacePeopleDrawerTableToolbar } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-people-table-toolbar"
import { ParticleInspector } from "@/features/workspace-particles/components/particle-inspector"
import { particle } from "./fixtures/particle-fixtures"
import { WorkspaceAcceleratorStepWindowHeader } from "@/features/workspace-accelerator-card/components/workspace-accelerator-step-window-header"
import { WorkspaceAcceleratorStepNodeCard } from "@/features/workspace-accelerator-card/components/workspace-accelerator-step-node-card"
import type { WorkspaceAcceleratorCardStep } from "@/features/workspace-accelerator-card/types"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  usePathname: () => "/workspace",
  useSearchParams: () => new URLSearchParams(),
}))

// SSR tests verify routing and active-panel ownership; browser geometry remains user-reviewed.
vi.mock("react-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-dom")>()),
  createPortal: vi.fn((children: ReactNode) => children),
}))
const targets = {
  actions: { id: "actions" } as HTMLDivElement,
  accessory: { id: "accessory" } as HTMLDivElement,
  title: { id: "title" } as HTMLDivElement,
}
function inHeader(children: ReactNode, active = true) {
  return createElement(WorkspaceWindowHeaderProvider, {
    enabled: true,
    ...targets,
    children: createElement(WorkspaceWindowHeaderScope, { active, children }),
  })
}
const orgProps = {
  publicLink: "/find/example",
  editMode: false,
  canEdit: true,
  isSaving: false,
  isDirty: false,
  onEnterEdit: vi.fn(),
  onCancelEdit: vi.fn(),
  onSave: vi.fn(),
}
const acceleratorStep: WorkspaceAcceleratorCardStep = {
  id: "welcome:video",
  moduleId: "welcome",
  moduleTitle: "Welcome",
  stepKind: "video",
  stepTitle: "Meet Coach House",
  stepDescription: null,
  href: "/accelerator/class/formation/module/welcome",
  status: "in_progress",
  stepSequenceIndex: 1,
  stepSequenceTotal: 2,
  moduleSequenceIndex: 1,
  moduleSequenceTotal: 1,
  groupTitle: "Formation",
  videoUrl: null,
  durationMinutes: null,
  resources: [],
  hasAssignment: false,
  hasDeck: false,
}
function clickBreadcrumb(node: ReactNode, slot: string): boolean {
  for (const child of Children.toArray(node)) {
    if (
      !isValidElement<{
        children?: ReactNode
        onClick?: () => void
        "data-react-grab-owner-id"?: string
      }>(child)
    )
      continue
    if (
      child.props["data-react-grab-owner-id"]?.endsWith(
        `:breadcrumb:${slot}`
      ) &&
      child.props.onClick
    ) {
      child.props.onClick()
      return true
    }
    if (clickBreadcrumb(child.props.children, slot)) return true
  }
  return false
}
const inspectorProps: ComponentProps<typeof ParticleInspector> = {
  particle: particle(1, "objective"),
  editable: true,
  pending: false,
  onSave: async () => true,
  onClose: vi.fn(),
  onDirtyChange: vi.fn(),
}
const documentsProps: ComponentProps<typeof DocumentsToolbar> = {
  searchQuery: "budget",
  tab: "all",
  viewMode: "grid",
  source: "all",
  fileType: "all",
  showDeleted: false,
  canUpload: true,
  canEdit: true,
  editMode: true,
  driveConnected: false,
  drivePending: false,
  onSearchQueryChange: vi.fn(),
  onTabChange: vi.fn(),
  onViewModeChange: vi.fn(),
  onSourceChange: vi.fn(),
  onFileTypeChange: vi.fn(),
  onShowDeletedChange: vi.fn(),
  onReset: vi.fn(),
  onUploadFiles: async () => {},
  onGoogleDrive: vi.fn(),
}
function PeopleToolbar({ segmentControls }: { segmentControls?: ReactNode }) {
  const table = useReactTable<OrgPersonWithImage>({
    data: [],
    columns: [{ id: "name", accessorKey: "name" }],
    getCoreRowModel: getCoreRowModel(),
  })
  return createElement(WorkspacePeopleDrawerTableToolbar, {
    table,
    segmentControls,
    peopleCount: 0,
    selectedCount: 0,
    allPeople: [],
    viewerId: "viewer",
    placedPersonIds: new Set<string>(),
    customSegment: null,
    customSegmentMemberIds: null,
    canEdit: true,
    contentMode: "wrap",
    rowHeight: "standard",
    hasSavedLayout: false,
    onApplySavedLayout: vi.fn(),
    onAutoSizeColumns: vi.fn(),
    onClearSavedLayout: vi.fn(),
    onContentModeChange: vi.fn(),
    onResetColumnWidths: vi.fn(),
    onRowHeightChange: vi.fn(),
    onSaveLayout: vi.fn(),
    onAddPeopleToCanvas: () => 0,
    onAddToSegment: vi.fn(),
    onRemoveFromSegment: vi.fn(),
    addControls: createElement("span", null, "Add people marker"),
  })
}

beforeEach(() => vi.clearAllMocks())

describe("workspace window header slots", () => {
  it("routes accelerator breadcrumbs and controls to separate header slots", () => {
    const html = renderToStaticMarkup(
      inHeader(
        createElement(WorkspaceAcceleratorStepWindowHeader, {
          step: acceleratorStep,
          stepTitle: "Meet Coach House",
          actions: createElement("button", null, "Lesson controls"),
          onOverview: vi.fn(),
          onModuleOverview: vi.fn(),
        })
      )
    )
    expect(createPortal).toHaveBeenCalledWith(expect.anything(), targets.title)
    expect(createPortal).toHaveBeenCalledWith(
      expect.anything(),
      targets.actions
    )
    expect(html).toContain('aria-label="Accelerator navigation"')
    expect(html).toContain('aria-current="page"')
    expect(html).toContain("Meet Coach House")
    expect(html).not.toContain("lesson-header")
  })

  it("uses existing overview callbacks without completing a lesson", () => {
    const onOverview = vi.fn()
    const onModuleOverview = vi.fn()
    const header = WorkspaceAcceleratorStepWindowHeader({
      step: acceleratorStep,
      stepTitle: "Meet Coach House",
      actions: null,
      onOverview,
      onModuleOverview,
    })
    expect(clickBreadcrumb(header, "overview")).toBe(true)
    expect(onOverview).toHaveBeenCalledExactlyOnceWith()
    expect(onModuleOverview).not.toHaveBeenCalled()
    expect(clickBreadcrumb(header, "module")).toBe(true)
    expect(onModuleOverview).toHaveBeenCalledExactlyOnceWith()
  })

  it("omits accelerator breadcrumbs and controls for an inactive retained panel", () => {
    const html = renderToStaticMarkup(
      inHeader(
        createElement(WorkspaceAcceleratorStepWindowHeader, {
          step: acceleratorStep,
          stepTitle: "Welcome",
          actions: "Controls",
          onOverview: vi.fn(),
          onModuleOverview: vi.fn(),
        }),
        false
      )
    )
    expect(html).toBe("")
    expect(createPortal).not.toHaveBeenCalled()
  })

  it("keeps real lesson controls in the window without a second body header", () => {
    const onClose = vi.fn()
    const onNavigateOverview = vi.fn()
    const onComplete = vi.fn()
    const html = renderToStaticMarkup(
      inHeader(
        createElement(WorkspaceAcceleratorStepNodeCard, {
          step: acceleratorStep,
          stepIndex: 0,
          stepTotal: 2,
          canGoPrevious: false,
          canGoNext: true,
          completed: false,
          moduleCompleted: false,
          onPrevious: vi.fn(),
          onNext: vi.fn(),
          onComplete,
          onClose,
          onNavigateOverview,
          variant: "embedded",
          drawerContainer: targets.accessory,
          sidePanel: createElement("span", null, "Lesson resources"),
        })
      )
    )
    expect(createPortal).toHaveBeenCalledWith(expect.anything(), targets.title)
    expect(createPortal).toHaveBeenCalledWith(
      expect.anything(),
      targets.actions
    )
    expect(html).toContain('aria-label="Previous accelerator step"')
    expect(html).toContain('aria-label="Next accelerator step"')
    expect(html).toContain('aria-label="Close accelerator lesson"')
    expect(html).not.toContain("@container/lesson-header")
    const title = vi
      .mocked(createPortal)
      .mock.calls.find(([, target]) => target === targets.title)?.[0]
    expect(clickBreadcrumb(title, "overview")).toBe(true)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onNavigateOverview).toHaveBeenLastCalledWith(null)
    expect(clickBreadcrumb(title, "module")).toBe(true)
    expect(onClose).toHaveBeenCalledTimes(2)
    expect(onNavigateOverview).toHaveBeenLastCalledWith(
      acceleratorStep.moduleId
    )
    expect(onComplete).not.toHaveBeenCalled()
  })

  it("waits for a title slot without duplicating lesson chrome in the body", () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceWindowHeaderProvider, {
        enabled: true,
        actions: null,
        accessory: null,
        title: null,
        children: createElement(WorkspaceAcceleratorStepWindowHeader, {
          step: acceleratorStep,
          stepTitle: "Welcome",
          actions: "Controls",
          onOverview: vi.fn(),
          onModuleOverview: vi.fn(),
        }),
      })
    )
    expect(html).toBe("")
    expect(createPortal).not.toHaveBeenCalled()
  })

  it("uses the step kind when the display title repeats its module", () => {
    const html = renderToStaticMarkup(
      inHeader(
        createElement(WorkspaceAcceleratorStepWindowHeader, {
          step: acceleratorStep,
          stepTitle: acceleratorStep.moduleTitle,
          actions: null,
          onOverview: vi.fn(),
          onModuleOverview: vi.fn(),
        })
      )
    )
    expect(html.match(/>Welcome</g)).toHaveLength(1)
    expect(html).toContain('title="Video"')
    expect(html).toContain('aria-current="page"')
  })

  it("moves inspector actions into the header without repeating its title", () => {
    const html = renderToStaticMarkup(
      inHeader(
        createElement(ParticleInspector, inspectorProps)
      )
    )
    expect(createPortal).toHaveBeenCalledWith(
      expect.anything(),
      targets.actions
    )
    expect(html.match(/<h2[ >]/g)).toHaveLength(1)
    expect(html).toContain(`${inspectorProps.particle.title}</h2>`)
    expect(html).toContain('aria-label="Copy Particle"')
    expect(html).toContain('aria-label="Close inspector"')
    expect(html).toContain("size-7 rounded-full")
    expect(html).toContain("Title</label>")
    expect(html).toContain("Save changes")
  })

  it("preserves the inspector title and actions outside a window", () => {
    const html = renderToStaticMarkup(
      createElement(ParticleInspector, inspectorProps)
    )
    expect(html.match(/<h2[ >]/g)).toHaveLength(1)
    expect(html).toContain(`${inspectorProps.particle.title}</h2>`)
    expect(html).toContain('aria-label="Copy Particle"')
    expect(createPortal).not.toHaveBeenCalled()
  })

  it("does not flash inspector actions inline while the header mounts", () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceWindowHeaderProvider, {
        enabled: true,
        actions: null,
        accessory: null,
        children: createElement(ParticleInspector, inspectorProps),
      })
    )
    expect(html).not.toContain("<h2")
    expect(html).not.toContain('aria-label="Copy Particle"')
    expect(html).toContain("Save changes")
    expect(createPortal).not.toHaveBeenCalled()
  })

  it("keeps standalone controls inline", () => {
    const html = renderToStaticMarkup(
      createElement(OrgProfileHeaderActions, orgProps)
    )
    expect(html).toContain("View map profile")
    expect(html).toContain("pb-3")
    expect(createPortal).not.toHaveBeenCalled()
  })

  it("moves compact organization controls with existing save guards", () => {
    const html = renderToStaticMarkup(
      inHeader(
        createElement(OrgProfileHeaderActions, {
          ...orgProps,
          editMode: true,
          isSaving: true,
        })
      )
    )
    expect(createPortal).toHaveBeenCalledWith(
      expect.anything(),
      targets.actions
    )
    expect(html).toContain("Saving…")
    expect(html.match(/disabled=""/g)).toHaveLength(2)
    expect(html).toContain("h-7")
    expect(html).not.toContain("pb-3")
  })

  it("hides inactive retained panel actions immediately", () => {
    const html = renderToStaticMarkup(
      inHeader(createElement(OrgProfileHeaderActions, orgProps), false)
    )
    expect(html).toBe("")
    expect(createPortal).not.toHaveBeenCalled()
  })

  it("waits for the header mount without flashing duplicate actions in the body", () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceWindowHeaderProvider, {
        enabled: true,
        actions: null,
        accessory: null,
        children: createElement(WorkspaceWindowHeaderPortal, {
          children: "Actions",
        }),
      })
    )
    expect(html).toBe("")
  })

  it("moves Documents search/New and removes only the redundant title", () => {
    const html = renderToStaticMarkup(
      inHeader(createElement(DocumentsToolbar, documentsProps))
    )
    expect(createPortal).toHaveBeenCalledWith(
      expect.anything(),
      targets.actions
    )
    expect(html).not.toContain('id="documents-title"')
    expect(html).toContain('aria-label="Search documents"')
    expect(html).toContain('value="budget"')
    expect(html).toContain(">New<")
    expect(html).toContain('aria-label="Document type"')
    expect(
      renderToStaticMarkup(createElement(DocumentsToolbar, documentsProps))
    ).toContain('id="documents-title"')
  })

  it("places storage usage beside the title without its former top margin", () => {
    const html = renderToStaticMarkup(
      inHeader(
        createElement(DocumentsStorageUsage, {
          usedBytes: 1024,
          limitBytes: 4096,
          loading: false,
        })
      )
    )
    expect(createPortal).toHaveBeenCalledWith(
      expect.anything(),
      targets.accessory
    )
    expect(html).toContain('role="meter"')
    expect(html).toContain('aria-valuenow="1024"')
    expect(html).not.toContain("mt-3")
  })

  it("places People Add after Columns and removes the body toolbar border", () => {
    const html = renderToStaticMarkup(inHeader(createElement(PeopleToolbar)))
    expect(createPortal).toHaveBeenCalledWith(
      expect.anything(),
      targets.actions
    )
    expect(html.indexOf("Columns")).toBeLessThan(
      html.indexOf("Add people marker")
    )
    expect(html).not.toContain("border-b ")
  })
})

it("moves People segments beside the title without duplicating them", () => {
  const html = renderToStaticMarkup(inHeader(createElement(PeopleToolbar, {
    segmentControls: createElement("span", null, "Segments marker"),
  })))
  expect(createPortal).toHaveBeenCalledWith(expect.anything(), targets.accessory)
  expect(createPortal).toHaveBeenCalledWith(expect.anything(), targets.actions)
  expect(html.match(/Segments marker/g)).toHaveLength(1)
  expect(html).toContain('data-workspace-people-header-segments="true"')
})
