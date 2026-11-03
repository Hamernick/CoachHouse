import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import StatusPage from "@/app/(public)/status/page"
import DashboardError from "@/app/(dashboard)/error"
import { SUPPORT_EMAIL } from "@/components/app-shell/constants"

describe("public status page", () => {
  it("offers dashboard recovery outside the failing workspace route", () => {
    const markup = renderToStaticMarkup(React.createElement(DashboardError, { error: new Error("Workspace unavailable"), reset: () => {} }))
    expect(markup).toContain('href="/status"')
    expect(markup).toContain("Get help")
    expect(markup).toContain("Retry")
    expect(markup).not.toContain('href="/organization"')
    expect(markup).not.toContain('href="/workspace"')
  })

  it("avoids unmeasured health claims and provides the configured support path", () => {
    const markup = renderToStaticMarkup(React.createElement(StatusPage))

    expect(markup).toContain("Live status reporting is not configured")
    expect(markup).toContain("Public status unavailable")
    expect(markup).toContain(`mailto:${SUPPORT_EMAIL}`)
    expect(markup).not.toContain("All systems operational")
    expect(markup).not.toContain("Updated moments ago")
  })
})
