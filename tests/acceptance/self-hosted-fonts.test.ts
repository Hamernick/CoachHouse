import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

const FONT_ENTRYPOINTS = [
  "src/app/layout.tsx",
  "src/app/(platform-lab)/internal/platform-lab/layout.tsx",
  "src/app/(public)/page.tsx",
  "src/features/build-collect-navigation/components/public-home-landing.tsx",
]

describe("self-hosted application fonts", () => {
  it("does not require Google font downloads during builds", () => {
    for (const file of FONT_ENTRYPOINTS) {
      const source = readFileSync(resolve(process.cwd(), file), "utf8")

      expect(source).not.toContain("next/font/google")
    }
  })

  it("loads each application font from local package assets", () => {
    const rootLayout = readFileSync(
      resolve(process.cwd(), "src/app/layout.tsx"),
      "utf8"
    )
    const platformLabLayout = readFileSync(
      resolve(
        process.cwd(),
        "src/app/(platform-lab)/internal/platform-lab/layout.tsx"
      ),
      "utf8"
    )

    for (const family of ["inter", "jetbrains-mono"]) {
      expect(rootLayout).toContain(`@fontsource-variable/${family}/wght.css`)
    }

    expect(platformLabLayout).toContain("@fontsource-variable/geist/wght.css")
    expect(platformLabLayout).toContain(
      "@fontsource-variable/geist-mono/wght.css"
    )
  })

  it("inherits the self-hosted Inter family on the current public landing", () => {
    const rootLayout = readFileSync(
      resolve(process.cwd(), "src/app/layout.tsx"),
      "utf8"
    )
    const globals = readFileSync(
      resolve(process.cwd(), "src/app/globals.css"),
      "utf8"
    )
    const homePage = readFileSync(
      resolve(process.cwd(), "src/app/(public)/page.tsx"),
      "utf8"
    )
    const landing = readFileSync(
      resolve(
        process.cwd(),
        "src/features/build-collect-navigation/components/public-home-landing.tsx"
      ),
      "utf8"
    )

    expect(homePage).toContain("return <PublicHomeLanding />")
    expect(rootLayout).toMatch(/<body\b[^>]*className="[^"]*\bfont-sans\b/)
    expect(globals).toContain("--font-sans: var(--font-geist-sans)")
    expect(globals).toMatch(/--font-geist-sans:\s*"Inter Variable"/)
    expect(landing).not.toMatch(/\bfont-(?:display|heading|mono|serif)\b/)
  })
})
