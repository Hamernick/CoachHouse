import { createElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { WorkspaceDockHost } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-dock-host"

vi.mock("react-dom", async (importOriginal) => ({
  ...await importOriginal<typeof import("react-dom")>(),
  createPortal: (children: ReactNode) => children,
}))

describe("floating workspace dock host", () => {
  it("renders retained content without a drawer, overlay, trigger or autofocus", () => {
    const html = renderToStaticMarkup(WorkspaceDockHost({
      floating: true,
      // The portal is mocked; no browser container is needed for this render.
      container: { nodeType: 1 } as HTMLElement,
      onMinimize: vi.fn(),
      request: null,
      legacyRootProps: { open: true },
      legacyContentProps: { style: { height: 800 } },
      legacyTrigger: createElement("button", null, "Legacy trigger"),
      children: createElement("input", { "aria-label": "Retained draft", defaultValue: "Draft" }),
    }))
    expect(html).toContain('aria-label="Workspace dock"')
    expect(html).toContain('value="Draft"')
    expect(html).not.toMatch(/drawer-content|drawer-overlay|role="dialog"|autofocus|tabindex|height:800/)
    expect(html).not.toContain("Legacy trigger")
  })
})
