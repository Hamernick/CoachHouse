import { afterEach, describe, expect, it, vi } from "vitest"
import reactGrabPackage from "react-grab/package.json"

import {
  buildReactGrabRuntimeSrc,
  createReactGrabClipboardTransformer,
  createReactGrabSemanticSelectionHandler,
  resolveReactGrabSemanticTarget,
} from "@/components/dev/react-grab-loader"
import { debugSurfaceClass } from "@/components/dev/react-grab-debug-surface"
import { readReactGrabElementMetadata } from "@/components/dev/react-grab-loader-metadata"
import { resolveReactGrabSelectedSurfaceElement } from "@/components/dev/react-grab-loader-resolution"

const explicitReactGrabSurfaceSelector = [
  "[data-react-grab-surface-component]",
  "[data-react-grab-surface-source]",
  "[data-react-grab-surface-slot]",
  "[data-react-grab-surface-kind]",
].join(", ")
const explicitReactGrabOwnerOrLinkSelector =
  "[data-react-grab-link-id], [data-react-grab-owner-id]"

function createMockElement(
  attributes: Record<string, string> = {},
  options: {
    tagName?: string
    closestMap?: Record<string, Element | null>
    queryMap?: Record<string, Element | null>
  } = {}
) {
  const tagName = options.tagName ?? "div"
  const closestMap = options.closestMap ?? {}
  const queryMap = options.queryMap ?? {}

  return {
    tagName: tagName.toUpperCase(),
    getAttribute: (name: string) => attributes[name] ?? null,
    setAttribute: (name: string, value: string) => {
      attributes[name] = value
    },
    closest: vi.fn((selector: string) => closestMap[selector] ?? null),
    querySelector: vi.fn((selector: string) => queryMap[selector] ?? null),
  } as unknown as Element
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("react grab loader", () => {
  it("retains the selected leaf while reporting its specific particle identity", async () => {
    const form = createMockElement({
      "data-particle-kind": "form", "data-particle-id": "form-123",
      "data-particle-title": "Volunteer intake", "data-particle-storage-type": "activity",
    })
    const input = createMockElement({
      "data-slot": "input", "class": "rounded-full",
      "data-react-grab-owner-source": "src/components/ui/input.tsx",
      "data-react-grab-notes": "Question label",
    }, { closestMap: { "[data-particle-kind][data-particle-id]": form } })
    const metadata = readReactGrabElementMetadata(input)
    expect(metadata.source).toBe("src/components/ui/input.tsx")
    expect(metadata.className).toBe("rounded-full")
    expect(metadata.notes).toBe("Question label\nParticle type: form\nParticle title: Volunteer intake\nParticle id: form-123\nStorage type: activity")
    expect(readReactGrabElementMetadata(createMockElement()).notes).toBeNull()
    vi.stubGlobal("window", { __REACT_GRAB_SURFACES__: {} })
    const transform = createReactGrabClipboardTransformer({
      api: {
        getSource: vi.fn().mockResolvedValue({ file: "src/components/ui/input.tsx", componentName: "Input" }),
        getStackContext: vi.fn().mockResolvedValue(["Input"]),
        getDisplayName: vi.fn().mockReturnValue("Input"),
      },
      getSelectionContext: () => null,
    })
    const output = await transform("<input />", [input])
    expect(output).toContain("Particle type: form")
    expect(output).toContain("Particle id: form-123")
    expect(output).toContain("assembly: src/components/ui/input.tsx")
  })
  it("keeps a granular Particle leaf instead of selecting its library ancestor", () => {
    const ancestor = createMockElement({
      "data-react-grab-owner-id": "library",
    })
    const leaf = createMockElement(
      {},
      {
        closestMap: {
          '[data-react-grab-granular="true"]': ancestor,
          [explicitReactGrabOwnerOrLinkSelector]: ancestor,
          [explicitReactGrabSurfaceSelector]: ancestor,
        },
      }
    )
    expect(resolveReactGrabSelectedSurfaceElement(leaf)).toBe(leaf)
    expect(resolveReactGrabSemanticTarget(leaf)).toBe(leaf)
  })

  it("loads the browser runtime matching the installed package", () => {
    expect(buildReactGrabRuntimeSrc()).toBe(
      `https://unpkg.com/react-grab@${reactGrabPackage.version}/dist/index.global.js`
    )
  })

  it("falls through synchronously when no semantic redirect target exists", () => {
    const element = createMockElement()
    const copyElement = vi.fn()
    const handler = createReactGrabSemanticSelectionHandler({
      copyElement,
      resolveTarget: () => null,
    })

    expect(handler(element)).toBeUndefined()
    expect(copyElement).not.toHaveBeenCalled()
  })

  it("falls through when the selected element is already the semantic target", () => {
    const element = createMockElement()
    const copyElement = vi.fn()
    const handler = createReactGrabSemanticSelectionHandler({
      copyElement,
      resolveTarget: () => element,
    })

    expect(handler(element)).toBeUndefined()
    expect(copyElement).not.toHaveBeenCalled()
  })

  it("returns the redirected copy promise when a linked semantic target is found", async () => {
    const element = createMockElement()
    const target = createMockElement()
    const copyElement = vi.fn().mockResolvedValue(true)
    const handler = createReactGrabSemanticSelectionHandler({
      copyElement,
      resolveTarget: () => target,
    })

    await expect(handler(element)).resolves.toBe(true)
    expect(copyElement).toHaveBeenCalledWith(target)
  })

  it("resolves linked portal content back to the owner id anchor", () => {
    const owner = createMockElement()
    const linkedSurface = createMockElement({
      "data-react-grab-link-id": "picker-owner",
    })
    const element = createMockElement(
      {},
      {
        closestMap: {
          "[data-react-grab-anchor]": null,
          "[data-react-grab-link-id], [data-react-grab-owner-id]":
            linkedSurface,
        },
      }
    )
    const originalDocument = globalThis.document

    globalThis.document = {
      querySelector: vi.fn().mockReturnValue(owner),
    } as unknown as Document

    try {
      expect(resolveReactGrabSemanticTarget(element)).toBe(owner)
    } finally {
      globalThis.document = originalDocument
    }
  })

  it("resolves semantic owners through a selected popper wrapper descendant", () => {
    const owner = createMockElement()
    const linkedSurface = createMockElement({
      "data-react-grab-link-id": "picker-owner",
    })
    const wrapper = createMockElement(
      {},
      {
        queryMap: {
          "[data-react-grab-link-id], [data-react-grab-owner-id]":
            linkedSurface,
        },
      }
    )
    const originalDocument = globalThis.document

    globalThis.document = {
      querySelector: vi.fn().mockReturnValue(owner),
    } as unknown as Document

    try {
      expect(resolveReactGrabSemanticTarget(wrapper)).toBe(owner)
    } finally {
      globalThis.document = originalDocument
    }
  })

  it("does not resolve a generic slotted wrapper through a child owner", () => {
    const linkedSurface = createMockElement({
      "data-react-grab-link-id": "picker-owner",
    })
    const wrapper = createMockElement(
      {
        "data-slot": "card-content",
      },
      {
        closestMap: {
          "[data-react-grab-anchor]": null,
          "[data-react-grab-link-id], [data-react-grab-owner-id]": null,
        },
        queryMap: {
          "[data-react-grab-link-id], [data-react-grab-owner-id]":
            linkedSurface,
        },
      }
    )

    expect(resolveReactGrabSemanticTarget(wrapper)).toBeNull()
  })

  it("resolves a slotted primitive inside an explicit linked surface", () => {
    const owner = createMockElement()
    const linkedSurface = createMockElement({
      "data-react-grab-link-id": "project-card",
      "data-react-grab-surface-component": "MemberWorkspaceProjectCard",
      "data-react-grab-surface-slot": "assignee-avatar",
      "data-react-grab-surface-kind": "content",
    })
    const primitiveChild = createMockElement(
      {
        "data-slot": "avatar-fallback",
      },
      {
        closestMap: {
          "[data-react-grab-anchor]": null,
          [explicitReactGrabSurfaceSelector]: linkedSurface,
          [explicitReactGrabOwnerOrLinkSelector]: linkedSurface,
        },
      }
    )
    const originalDocument = globalThis.document

    globalThis.document = {
      querySelector: vi.fn().mockReturnValue(owner),
    } as unknown as Document

    try {
      expect(resolveReactGrabSemanticTarget(primitiveChild)).toBe(owner)
    } finally {
      globalThis.document = originalDocument
    }
  })

  it("selects an explicit linked surface before a nested primitive slot", () => {
    const linkedSurface = createMockElement({
      "data-react-grab-link-id": "project-card",
      "data-react-grab-surface-component": "MemberWorkspaceProjectCard",
      "data-react-grab-surface-source":
        "src/features/member-workspace/components/projects/member-workspace-project-card.tsx",
      "data-react-grab-surface-slot": "assignee-avatar",
      "data-react-grab-surface-kind": "content",
    })
    const primitiveChild = createMockElement(
      {
        "data-slot": "avatar-fallback",
      },
      {
        closestMap: {
          [explicitReactGrabSurfaceSelector]: linkedSurface,
          [explicitReactGrabOwnerOrLinkSelector]: linkedSurface,
        },
      }
    )

    expect(resolveReactGrabSelectedSurfaceElement(primitiveChild)).toBe(
      linkedSurface
    )
  })

  it("keeps an intentionally selected generic primitive slot when no explicit surface wraps it", () => {
    const owner = createMockElement({
      "data-react-grab-owner-id": "project-card",
    })
    const genericSlot = createMockElement(
      {
        "data-slot": "card-content",
      },
      {
        closestMap: {
          [explicitReactGrabSurfaceSelector]: null,
          [explicitReactGrabOwnerOrLinkSelector]: owner,
        },
      }
    )

    expect(resolveReactGrabSelectedSurfaceElement(genericSlot)).toBe(
      genericSlot
    )
  })

  it("builds resolved clipboard output for a primitive-owned surface", async () => {
    vi.stubGlobal("window", { __REACT_GRAB_SURFACES__: {} })
    const button = createMockElement(
      {
        class: "inline-flex rounded-md",
        "data-slot": "button",
        "data-react-grab-anchor": "Button",
        "data-react-grab-owner-id": "button-owner",
        "data-react-grab-owner-component": "Button",
        "data-react-grab-owner-source": "src/components/ui/button.tsx",
        "data-react-grab-owner-slot": "button",
      },
      { tagName: "button" }
    )

    debugSurfaceClass({
      ownerId: "button-owner",
      component: "Button",
      source: "src/components/ui/button.tsx",
      slot: "button",
      surfaceKind: "trigger",
      className: "inline-flex rounded-md",
      classAssemblyFile: "src/components/ui/button.tsx",
      primitiveImport: "@/components/ui/button",
    })

    const transform = createReactGrabClipboardTransformer({
      api: {
        copyElement: vi.fn(),
        registerPlugin: vi.fn(),
        unregisterPlugin: vi.fn(),
        getSource: vi.fn().mockResolvedValue({
          file: "src/components/ui/button.tsx",
          line: 45,
          importSource: "@/components/ui/button",
          componentName: "Button",
        }),
        getStackContext: vi.fn().mockResolvedValue(["CardHeader", "Button"]),
        getDisplayName: vi.fn().mockReturnValue("Button"),
      },
      getSelectionContext: () => ({
        selectedElement: button,
        selectedSurfaceElement: button,
        targetElement: button,
        trace: {
          selectedTag: "button",
          selectedClasses: "inline-flex rounded-md",
          resolvedOwnerId: "button-owner",
          resolvedOwnerComponent: "Button",
          resolvedOwnerSource: "src/components/ui/button.tsx",
          resolutionMode: "direct-anchor",
        },
      }),
    })

    const output = await transform("<button />", [button])

    expect(output).toContain(
      "[SURFACE]\nname: Button\nslot: button\nkind: trigger"
    )
    expect(output).toContain(
      "[FILES]\nsurface: src/components/ui/button.tsx:45 (@/components/ui/button)"
    )
    expect(output).toContain("[OWNER]\nstatus: resolved")
    expect(output).toContain("primary: src/components/ui/button.tsx")
    expect(output).toContain('[CLASS]\n"inline-flex rounded-md"')
  })

  it("reports misbuilt surfaces when explicit wrong-owner metadata exists", async () => {
    vi.stubGlobal("window", { __REACT_GRAB_SURFACES__: {} })
    const owner = createMockElement(
      {
        "data-react-grab-anchor": "WorkspaceAcceleratorHeaderPicker",
        "data-react-grab-owner-id": "picker-owner",
        "data-react-grab-owner-component": "WorkspaceAcceleratorHeaderPicker",
        "data-react-grab-owner-source":
          "src/features/workspace-accelerator-card/components/workspace-accelerator-header-picker.tsx",
      },
      { tagName: "button" }
    )

    const tooltip = createMockElement({
      class: "bg-popover text-popover-foreground",
      "data-slot": "tooltip-content",
      "data-react-grab-link-id": "picker-owner",
      "data-react-grab-surface-component": "TooltipContent",
      "data-react-grab-surface-source": "src/components/ui/tooltip.tsx",
      "data-react-grab-surface-slot": "tooltip-content",
      "data-react-grab-surface-kind": "content",
    })

    debugSurfaceClass({
      ownerId: "picker-owner",
      component: "TooltipContent",
      source: "src/components/ui/tooltip.tsx",
      slot: "tooltip-content",
      surfaceKind: "content",
      className: "bg-popover text-popover-foreground",
      classAssemblyFile: "src/components/ui/tooltip.tsx",
      primitiveImport: "@/components/ui/tooltip",
      tokenSource: "src/components/workspace/workspace-tutorial-theme.ts",
      canonicalOwnerFile:
        "src/components/workspace/workspace-tutorial-theme.ts",
      canonicalOwnerReason:
        "Shared tutorial token file owns the surface styling.",
      currentWrongOwnerFile:
        "src/features/workspace-accelerator-card/components/workspace-accelerator-tutorial-guard-tooltip.tsx",
      currentWrongOwnerReason:
        "Feature wrapper should not own the final surface colors.",
    })

    const transform = createReactGrabClipboardTransformer({
      api: {
        copyElement: vi.fn(),
        registerPlugin: vi.fn(),
        unregisterPlugin: vi.fn(),
        getSource: vi.fn().mockResolvedValue({
          file: "src/components/ui/tooltip.tsx",
          line: 44,
          importSource: "@/components/ui/tooltip",
          componentName: "TooltipContent",
        }),
        getStackContext: vi
          .fn()
          .mockResolvedValue([
            "WorkspaceAcceleratorTutorialGuardTooltip",
            "Tooltip",
            "TooltipContent",
          ]),
        getDisplayName: vi.fn().mockReturnValue("TooltipContent"),
      },
      getSelectionContext: () => ({
        selectedElement: tooltip,
        selectedSurfaceElement: tooltip,
        targetElement: owner,
        trace: {
          selectedTag: "div",
          selectedClasses: "bg-popover text-popover-foreground",
          resolvedOwnerId: "picker-owner",
          resolvedOwnerComponent: "WorkspaceAcceleratorHeaderPicker",
          resolvedOwnerSource:
            "src/features/workspace-accelerator-card/components/workspace-accelerator-header-picker.tsx",
          resolutionMode: "linked-surface",
        },
      }),
    })

    const output = await transform("<div />", [owner])

    expect(output).toContain("[OWNER]\nstatus: misbuilt")
    expect(output).toContain(
      "wrong: src/features/workspace-accelerator-card/components/workspace-accelerator-tutorial-guard-tooltip.tsx"
    )
    expect(output).toContain(
      "primary: src/components/workspace/workspace-tutorial-theme.ts"
    )
  })

  it("reports unresolved surfaces instead of guessing ownership", async () => {
    const div = createMockElement({ class: "foo bar" })

    const transform = createReactGrabClipboardTransformer({
      api: {
        copyElement: vi.fn(),
        registerPlugin: vi.fn(),
        unregisterPlugin: vi.fn(),
        getSource: vi.fn().mockResolvedValue(null),
        getStackContext: vi.fn().mockResolvedValue(["Card", "CardHeader"]),
        getDisplayName: vi.fn().mockReturnValue("CardHeader"),
      },
      getSelectionContext: () => ({
        selectedElement: div,
        selectedSurfaceElement: div,
        targetElement: null,
        trace: {
          selectedTag: "div",
          selectedClasses: "foo bar",
          resolvedOwnerId: null,
          resolvedOwnerComponent: null,
          resolvedOwnerSource: null,
          resolutionMode: "none",
        },
      }),
    })

    const output = await transform("<div />", [div])

    expect(output).toContain("[OWNER]\nstatus: unresolved")
    expect(output).toContain("primary: unknown")
    expect(output).toContain('[CLASS]\n"foo bar"')
  })

  it("keeps a generic clicked wrapper distinct instead of collapsing it to the owner trigger debug record", async () => {
    vi.stubGlobal("window", { __REACT_GRAB_SURFACES__: {} })
    const owner = createMockElement(
      {
        class: "trigger-class",
        "data-react-grab-anchor": "WorkspaceAcceleratorHeaderPicker",
        "data-react-grab-owner-id": "picker-owner",
        "data-react-grab-owner-component": "WorkspaceAcceleratorHeaderPicker",
        "data-react-grab-owner-source":
          "src/features/workspace-accelerator-card/components/workspace-accelerator-header-picker.tsx",
        "data-react-grab-owner-slot": "trigger",
        "data-react-grab-token-source":
          "src/components/workspace/workspace-tutorial-theme.ts",
        "data-react-grab-primitive-import": "@/components/ui/select",
      },
      { tagName: "button" }
    )
    const wrapper = createMockElement(
      {
        class: "first:pt-4 px-4 pb-4 pt-0",
        "data-slot": "card-content",
      },
      { tagName: "div" }
    )

    debugSurfaceClass({
      ownerId: "picker-owner",
      component: "WorkspaceAcceleratorHeaderPicker",
      source:
        "src/features/workspace-accelerator-card/components/workspace-accelerator-header-picker.tsx",
      slot: "trigger",
      surfaceKind: "trigger",
      className:
        "data-[placeholder]:text-muted-foreground bg-foreground text-background",
      classAssemblyFile: "src/components/ui/select.tsx",
      primitiveImport: "@/components/ui/select",
      tokenSource: "src/components/workspace/workspace-tutorial-theme.ts",
    })

    const transform = createReactGrabClipboardTransformer({
      api: {
        copyElement: vi.fn(),
        registerPlugin: vi.fn(),
        unregisterPlugin: vi.fn(),
        getSource: vi.fn().mockImplementation((element: Element) => {
          if (element === wrapper) {
            return {
              file: "src/components/ui/card.tsx",
              line: 109,
              importSource: "@/components/ui/card",
              componentName: "CardContent",
            }
          }

          return {
            file: "src/features/workspace-accelerator-card/components/workspace-accelerator-header-picker.tsx",
            line: 160,
            importSource:
              "@/features/workspace-accelerator-card/components/workspace-accelerator-header-picker",
            componentName: "WorkspaceAcceleratorHeaderPicker",
          }
        }),
        getStackContext: vi
          .fn()
          .mockResolvedValue([
            "CardContent",
            "WorkspaceAcceleratorHeaderPicker",
          ]),
        getDisplayName: vi.fn().mockReturnValue("CardContent"),
      },
      getSelectionContext: () => ({
        selectedElement: wrapper,
        selectedSurfaceElement: wrapper,
        targetElement: owner,
        trace: {
          selectedTag: "div",
          selectedClasses: "first:pt-4 px-4 pb-4 pt-0",
          resolvedOwnerId: "picker-owner",
          resolvedOwnerComponent: "WorkspaceAcceleratorHeaderPicker",
          resolvedOwnerSource:
            "src/features/workspace-accelerator-card/components/workspace-accelerator-header-picker.tsx",
          resolutionMode: "linked-surface",
        },
      }),
    })

    const output = await transform("<div />", [owner])

    expect(output).toContain(
      "[FILES]\nsurface: src/components/ui/card.tsx:109 (@/components/ui/card)"
    )
    expect(output).toContain(
      "semantic: src/features/workspace-accelerator-card/components/workspace-accelerator-header-picker.tsx"
    )
    expect(output).toContain("assembly: src/components/ui/card.tsx")
    expect(output).not.toContain(
      "token: src/components/workspace/workspace-tutorial-theme.ts"
    )
    expect(output).toContain('[CLASS]\n"first:pt-4 px-4 pb-4 pt-0"')
    expect(output).not.toContain("bg-foreground text-background")
  })

  it("uses owner canonical metadata for untagged nested surface reports", async () => {
    const ownerSource =
      "src/features/member-workspace/components/projects/member-workspace-project-card.tsx"
    const owner = createMockElement(
      {
        "data-react-grab-anchor": "MemberWorkspaceProjectCard",
        "data-react-grab-owner-id":
          "member-workspace-project-card:list:project-1",
        "data-react-grab-owner-component": "MemberWorkspaceProjectCard",
        "data-react-grab-owner-source": ownerSource,
        "data-react-grab-canonical-owner-source": ownerSource,
        "data-react-grab-canonical-owner-reason":
          "Project card owns its semantic sub-surfaces.",
      },
      { tagName: "div" }
    )
    const primitiveWrapper = createMockElement(
      {
        class: "first:pt-4 px-4",
        "data-slot": "card-content",
      },
      { tagName: "div" }
    )

    const transform = createReactGrabClipboardTransformer({
      api: {
        copyElement: vi.fn(),
        registerPlugin: vi.fn(),
        unregisterPlugin: vi.fn(),
        getSource: vi.fn().mockImplementation((element: Element) => {
          if (element === primitiveWrapper) {
            return {
              file: "src/components/ui/card.tsx",
              line: 109,
              importSource: "@/components/ui/card",
              componentName: "CardContent",
            }
          }

          return {
            file: ownerSource,
            line: 151,
            componentName: "MemberWorkspaceProjectCard",
          }
        }),
        getStackContext: vi
          .fn()
          .mockResolvedValue(["CardContent", "MemberWorkspaceProjectCard"]),
        getDisplayName: vi.fn().mockReturnValue("CardContent"),
      },
      getSelectionContext: () => ({
        selectedElement: primitiveWrapper,
        selectedSurfaceElement: primitiveWrapper,
        targetElement: owner,
        trace: {
          selectedTag: "div",
          selectedClasses: "first:pt-4 px-4",
          resolvedOwnerId: "member-workspace-project-card:list:project-1",
          resolvedOwnerComponent: "MemberWorkspaceProjectCard",
          resolvedOwnerSource: ownerSource,
          resolutionMode: "linked-surface",
        },
      }),
    })

    const output = await transform("<div />", [owner])

    expect(output).toContain(
      "[SURFACE]\nname: card-content\nslot: card-content\nkind: content"
    )
    expect(output).toContain("[OWNER]\nstatus: resolved")
    expect(output).toContain("id: member-workspace-project-card:list:project-1")
    expect(output).toContain(`primary: ${ownerSource}`)
    expect(output).toContain("other: src/components/ui/card.tsx")
    expect(output).toContain('[CLASS]\n"first:pt-4 px-4"')
  })

  it("serializes explicit tutorial panel wrapper surfaces as distinct layout containers", async () => {
    vi.stubGlobal("window", { __REACT_GRAB_SURFACES__: {} })
    const owner = createMockElement(
      {
        "data-react-grab-anchor": "WorkspaceCanvasTutorialPanel",
        "data-react-grab-owner-id":
          "workspace-canvas-tutorial-panel:accelerator-first-module",
        "data-react-grab-owner-component": "WorkspaceCanvasTutorialPanel",
        "data-react-grab-owner-source":
          "src/features/workspace-canvas-tutorial/components/workspace-canvas-tutorial-panel.tsx",
        "data-react-grab-owner-slot": "card",
      },
      { tagName: "div" }
    )
    const wrapper = createMockElement(
      {
        class: "relative grid min-h-0 h-full grid-rows-[auto_minmax(0,1fr)]",
        "data-react-grab-link-id":
          "workspace-canvas-tutorial-panel:accelerator-first-module",
        "data-react-grab-surface-component": "WorkspaceCanvasTutorialPanel",
        "data-react-grab-surface-source":
          "src/features/workspace-canvas-tutorial/components/workspace-canvas-tutorial-panel.tsx",
        "data-react-grab-surface-slot": "body-grid",
        "data-react-grab-surface-kind": "root",
      },
      { tagName: "div" }
    )
    debugSurfaceClass({
      ownerId: "workspace-canvas-tutorial-panel:accelerator-first-module",
      component: "WorkspaceCanvasTutorialPanel",
      source:
        "src/features/workspace-canvas-tutorial/components/workspace-canvas-tutorial-panel.tsx",
      slot: "card",
      surfaceKind: "root",
      className:
        "text-card-foreground bg-card/95 flex min-h-0 min-w-0 flex-col overflow-visible",
      classAssemblyFile: "src/components/ui/card.tsx",
      primitiveImport: "@/components/ui/card",
    })
    debugSurfaceClass({
      ownerId: "workspace-canvas-tutorial-panel:accelerator-first-module",
      component: "WorkspaceCanvasTutorialPanel",
      source:
        "src/features/workspace-canvas-tutorial/components/workspace-canvas-tutorial-panel.tsx",
      slot: "card-content",
      surfaceKind: "content",
      className:
        "first:pt-4 relative min-h-0 flex-1 bg-background/70 px-0 py-0",
      classAssemblyFile: "src/components/ui/card.tsx",
      primitiveImport: "@/components/ui/card",
    })

    const transform = createReactGrabClipboardTransformer({
      api: {
        copyElement: vi.fn(),
        registerPlugin: vi.fn(),
        unregisterPlugin: vi.fn(),
        getSource: vi.fn().mockResolvedValue({
          file: "src/features/workspace-canvas-tutorial/components/workspace-canvas-tutorial-panel.tsx",
          line: 493,
          componentName: "WorkspaceCanvasTutorialPanel",
        }),
        getStackContext: vi
          .fn()
          .mockResolvedValue(["WorkspaceCanvasTutorialPanel"]),
        getDisplayName: vi.fn().mockReturnValue("WorkspaceCanvasTutorialPanel"),
      },
      getSelectionContext: () => ({
        selectedElement: wrapper,
        selectedSurfaceElement: wrapper,
        targetElement: owner,
        trace: {
          selectedTag: "div",
          selectedClasses:
            "relative grid min-h-0 h-full grid-rows-[auto_minmax(0,1fr)]",
          resolvedOwnerId:
            "workspace-canvas-tutorial-panel:accelerator-first-module",
          resolvedOwnerComponent: "WorkspaceCanvasTutorialPanel",
          resolvedOwnerSource:
            "src/features/workspace-canvas-tutorial/components/workspace-canvas-tutorial-panel.tsx",
          resolutionMode: "linked-surface",
        },
      }),
    })

    const output = await transform("<div />", [owner])

    expect(output).toContain(
      "[SURFACE]\nname: WorkspaceCanvasTutorialPanel\nslot: body-grid\nkind: root"
    )
    expect(output).toContain(
      "[FILES]\nsurface: src/features/workspace-canvas-tutorial/components/workspace-canvas-tutorial-panel.tsx"
    )
    expect(output).toContain(
      "assembly: src/features/workspace-canvas-tutorial/components/workspace-canvas-tutorial-panel.tsx"
    )
    expect(output).toContain(
      '[CLASS]\n"relative grid min-h-0 h-full grid-rows-[auto_minmax(0,1fr)]"'
    )
    expect(output).not.toContain("bg-card/95 flex min-h-0 min-w-0")
  })

  it("keeps the explicit accelerator presentation card shell distinct from the outer tutorial card", async () => {
    vi.stubGlobal("window", { __REACT_GRAB_SURFACES__: {} })
    const owner = createMockElement(
      {
        "data-react-grab-anchor": "WorkspaceCanvasTutorialPanel",
        "data-react-grab-owner-id":
          "workspace-canvas-tutorial-panel:accelerator-close-module",
        "data-react-grab-owner-component": "WorkspaceCanvasTutorialPanel",
        "data-react-grab-owner-source":
          "src/features/workspace-canvas-tutorial/components/workspace-canvas-tutorial-panel.tsx",
        "data-react-grab-owner-slot": "card",
      },
      { tagName: "div" }
    )
    const shell = createMockElement(
      {
        class: "mx-auto",
        "data-react-grab-link-id":
          "workspace-canvas-tutorial-panel:accelerator-close-module",
        "data-react-grab-surface-component": "WorkspaceCanvasTutorialPanel",
        "data-react-grab-surface-source":
          "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2-tutorial-presentation.tsx",
        "data-react-grab-surface-slot": "presentation-accelerator-card-shell",
        "data-react-grab-surface-kind": "content",
      },
      { tagName: "div" }
    )

    debugSurfaceClass({
      ownerId: "workspace-canvas-tutorial-panel:accelerator-close-module",
      component: "WorkspaceCanvasTutorialPanel",
      source:
        "src/features/workspace-canvas-tutorial/components/workspace-canvas-tutorial-panel.tsx",
      slot: "card",
      surfaceKind: "root",
      className: "outer-card",
      classAssemblyFile: "src/components/ui/card.tsx",
      primitiveImport: "@/components/ui/card",
    })
    debugSurfaceClass({
      ownerId: "workspace-canvas-tutorial-panel:accelerator-close-module",
      component: "WorkspaceCanvasTutorialPanel",
      source:
        "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2-tutorial-presentation.tsx",
      slot: "presentation-accelerator-card-shell",
      surfaceKind: "content",
      className: "mx-auto",
      classAssemblyFile:
        "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2-tutorial-presentation.tsx",
      primitiveImport: "@/components/ui/card",
    })

    const transform = createReactGrabClipboardTransformer({
      api: {
        copyElement: vi.fn(),
        registerPlugin: vi.fn(),
        unregisterPlugin: vi.fn(),
        getSource: vi.fn().mockResolvedValue({
          file: "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2-tutorial-presentation.tsx",
          componentName: "WorkspaceCanvasTutorialPanel",
        }),
        getStackContext: vi
          .fn()
          .mockResolvedValue([
            "WorkspaceTutorialPresentationFrame",
            "WorkspaceCanvasTutorialPanel",
          ]),
        getDisplayName: vi.fn().mockReturnValue("WorkspaceCanvasTutorialPanel"),
      },
      getSelectionContext: () => ({
        selectedElement: shell,
        selectedSurfaceElement: shell,
        targetElement: owner,
        trace: {
          selectedTag: "div",
          selectedClasses: "mx-auto",
          resolvedOwnerId:
            "workspace-canvas-tutorial-panel:accelerator-close-module",
          resolvedOwnerComponent: "WorkspaceCanvasTutorialPanel",
          resolvedOwnerSource:
            "src/features/workspace-canvas-tutorial/components/workspace-canvas-tutorial-panel.tsx",
          resolutionMode: "linked-surface",
        },
      }),
    })

    const output = await transform("<div />", [owner])

    expect(output).toContain(
      "[SURFACE]\nname: WorkspaceCanvasTutorialPanel\nslot: presentation-accelerator-card-shell\nkind: content"
    )
    expect(output).toContain(
      "[FILES]\nsurface: src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2-tutorial-presentation.tsx (@/components/ui/card)"
    )
    expect(output).toContain(
      "assembly: src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-surface-v2-tutorial-presentation.tsx"
    )
    expect(output).toContain('[CLASS]\n"mx-auto"')
    expect(output).not.toContain('[CLASS]\n"outer-card"')
  })
})
