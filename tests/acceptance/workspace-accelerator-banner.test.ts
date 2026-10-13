import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { WorkspaceAcceleratorBanner } from "@/features/workspace-accelerator-card"

describe("workspace Accelerator banner", () => {
  it("offers a compact introduction with an accessible dismissal action", () => {
    const markup = renderToStaticMarkup(
      React.createElement(WorkspaceAcceleratorBanner, { onDismiss: () => {} })
    )
    expect(markup).toContain("Get started with the Accelerator")
    expect(markup).toContain("Choose a lesson below to begin.")
    expect(markup).toContain('aria-label="Dismiss Accelerator introduction"')
    expect(markup).toContain('type="button"')
    expect(markup).toContain('data-react-grab-owner-id="workspace-accelerator:banner"')
  })
})
