import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import reactGrabPackage from "react-grab/package.json"

const layout = readFileSync(resolve("src/app/layout.tsx"), "utf8")

describe("stock React Grab integration", () => {
  it("loads the installed runtime only in development before React hydrates", () => {
    expect(layout).toContain('process.env.NODE_ENV === "development" && (')
    expect(layout).toContain('strategy="beforeInteractive"')
    expect(layout).toContain('crossOrigin="anonymous"')
    expect(layout).toContain('https://unpkg.com/react-grab@${reactGrabPackage.version}/dist/index.global.js')
    expect(reactGrabPackage.version).toBe("0.2.0")
  })

  it("does not install selection overrides, clipboard transforms or agent integrations", () => {
    expect(layout).not.toMatch(/ReactGrabLoader|registerPlugin|transformCopyContent|opencode|localStorage/)
  })
})
