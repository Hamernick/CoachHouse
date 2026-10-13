import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { runInNewContext } from "node:vm"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ThemeProvider } from "@/components/providers/theme-provider"

afterEach(() => vi.unstubAllGlobals())

function renderProvider() {
  return renderToStaticMarkup(
    React.createElement(ThemeProvider, null, React.createElement("p", null, "Workspace"))
  )
}

describe("theme provider bootstrap", () => {
  it("keeps the server bootstrap executable without delaying page content", () => {
    const markup = renderProvider()
    expect(markup).toContain('<script type="text/javascript"')
    expect(markup).toContain("<p>Workspace</p>")
  })

  it("marks client-created bootstrap copies as inert data", () => {
    vi.stubGlobal("window", {})
    const markup = renderProvider()
    expect(markup).toContain('<script type="text/plain"')
    expect(markup).not.toContain('type="text/javascript"')
    expect(markup).toContain("<p>Workspace</p>")
  })

  it.each([
    ["dark", false, "dark"],
    ["light", true, "light"],
    ["system", true, "dark"],
    [null, false, "light"],
  ])("applies saved %s with system-dark %s before hydration", (saved, systemDark, expected) => {
    const markup = renderProvider()
    const script = markup.match(/<script[^>]*>([\s\S]*?)<\/script>/)?.[1]
    expect(script).toBeTruthy()
    const add = vi.fn()
    const remove = vi.fn()
    const style = { colorScheme: "" }
    runInNewContext(script!, {
      document: { documentElement: { classList: { add, remove }, style } },
      localStorage: { getItem: () => saved },
      window: { matchMedia: () => ({ matches: systemDark }) },
    })
    expect(remove).toHaveBeenCalledWith("light", "dark")
    expect(add).toHaveBeenCalledWith(expected)
    expect(style.colorScheme).toBe(expected)
  })
})
