import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

import { describe, expect, it } from "vitest"
import {
  getMemberWorkspaceSectionLabel,
  isDonorAudience,
  MEMBER_WORKSPACE_SECTIONS,
} from "@/features/member-workspace"

function withFeatureBoundaryFixture(run: (root: string) => void) {
  const root = mkdtempSync(join(tmpdir(), "member-workspace-boundaries-"))
  const write = (relativePath: string, source: string) => {
    const target = join(root, relativePath)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, source)
  }

  try {
    for (const feature of ["provider-feature", "consumer-feature"]) {
      for (const file of [
        "README.md", "index.ts", "types.ts", "components/index.ts",
        "lib/index.ts", "server/actions.ts",
      ]) {
        write(`src/features/${feature}/${file}`, "")
      }
      write(`tests/acceptance/${feature}.test.ts`, "")
    }
    write("src/features/provider-feature/server.ts", 'import "server-only"\nexport { load } from "./server/load"\n')
    write("src/features/provider-feature/server/load.ts", "export const load = () => []\n")
    write("src/features/consumer-feature/server/actions.ts", 'import { load } from "@/features/provider-feature/server"\n')
    write("src/components/consumer.ts", 'import { load } from "@/features/provider-feature/server"\n')
    run(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

function runFeatureGuard(root: string, script: string) {
  return execFileSync(process.execPath, [join(process.cwd(), "scripts", script)], {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
  })
}

describe("member-workspace feature contract", () => {
  it("exposes the canonical member workspace sections in order", () => {
    expect(MEMBER_WORKSPACE_SECTIONS).toEqual([
      "projects",
      "my-tasks",
      "people",
    ])
  })

  it("labels each section for the shell header", () => {
    expect(
      MEMBER_WORKSPACE_SECTIONS.map((section) =>
        getMemberWorkspaceSectionLabel(section),
      ),
    ).toEqual([
      "Organizations",
      "Tasks",
      "People",
    ])
  })

  it("treats the fund onboarding track as donor-only", () => {
    expect(isDonorAudience("fund")).toBe(true)
    expect(isDonorAudience("build")).toBe(false)
    expect(isDonorAudience("find")).toBe(false)
    expect(isDonorAudience("support")).toBe(false)
    expect(isDonorAudience(null)).toBe(false)
  })

  it("allows guarded public server facades from components and other features", () => {
    withFeatureBoundaryFixture((root) => {
      expect(runFeatureGuard(root, "check-feature-contract.mjs")).toContain("Feature contract check passed.")
      expect(runFeatureGuard(root, "check-import-boundaries.mjs")).toContain("Import boundaries check passed.")
    })
  })

  it("requires an actual server-only import on public server facades", () => {
    withFeatureBoundaryFixture((root) => {
      writeFileSync(join(root, "src/features/provider-feature/server.ts"), '// import "server-only"\nexport { load } from "./server/load"\n')

      expect(() => runFeatureGuard(root, "check-feature-contract.mjs")).toThrow("public server entrypoint must import 'server-only'")
      expect(() => runFeatureGuard(root, "check-import-boundaries.mjs")).toThrow("/server imports require a root server.ts with a side-effect 'server-only' import")
    })
  })

  it("does not expose a private server directory as a public server facade", () => {
    withFeatureBoundaryFixture((root) => {
      rmSync(join(root, "src/features/provider-feature/server.ts"))
      writeFileSync(join(root, "src/features/provider-feature/server/index.ts"), 'import "server-only"\nexport { load } from "./load"\n')

      for (const script of ["check-feature-contract.mjs", "check-import-boundaries.mjs"]) {
        expect(() => runFeatureGuard(root, script)).toThrow("/server imports require a root server.ts with a side-effect 'server-only' import")
      }
    })
  })

  it("still rejects private server imports from components and other features", () => {
    withFeatureBoundaryFixture((root) => {
      const privateImport = 'import { load } from "@/features/provider-feature/server/load"\n'
      writeFileSync(join(root, "src/components/consumer.ts"), privateImport)
      writeFileSync(join(root, "src/features/consumer-feature/server/actions.ts"), privateImport)

      expect(() => runFeatureGuard(root, "check-feature-contract.mjs")).toThrow("cross-feature imports must use public entrypoint")
      expect(() => runFeatureGuard(root, "check-import-boundaries.mjs")).toThrow("imports from features must use a public entrypoint")
    })
  })
})
