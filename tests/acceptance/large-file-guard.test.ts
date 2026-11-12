import { execFileSync, spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { QUALITY_GATE_PROFILES } from "../../scripts/run-quality-gate.mjs"

const temporaryDirectories: string[] = []
const guardPath = path.resolve("scripts/check-large-files.mjs")

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

function runGuard(files: Record<string, number>) {
  const directory = mkdtempSync(path.join(tmpdir(), "coach-house-file-budget-"))
  temporaryDirectories.push(directory)
  execFileSync("git", ["init", "--quiet", directory])
  for (const [file, size] of Object.entries(files)) {
    const destination = path.join(directory, file)
    mkdirSync(path.dirname(destination), { recursive: true })
    writeFileSync(destination, Buffer.alloc(size, "x"))
  }
  execFileSync("git", ["add", "--", ...Object.keys(files)], { cwd: directory })
  return spawnSync(process.execPath, [guardPath], { cwd: directory, encoding: "utf8" })
}

describe("large-file guard", () => {
  it("allows the two approved documents up to their fixed limits", () => {
    const result = runGuard({
      "docs/plans/2026-10-27-particle-system-execution-spec.md": 1700 * 1024,
      "docs/runlog/2026-10.md": 1400 * 1024,
    })

    expect(result.status, result.stderr).toBe(0)
  })

  it.each([
    ["docs/plans/2026-10-27-particle-system-execution-spec.md", 1700 * 1024],
    ["docs/runlog/2026-10.md", 1400 * 1024],
    ["docs/plans/another-plan.md", 512 * 1024],
    ["docs/runlog/2026-11.md", 1024 * 1024],
    ["archive/docs/runlog/2026-10.md", 512 * 1024],
    ["src/oversized.ts", 220 * 1024],
  ])("rejects %s one byte over its budget", (file, maxBytes) => {
    const result = runGuard({ [file]: maxBytes + 1 })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`${file}:`)
    expect(result.stderr).toContain("exceeds")
  })

  it("runs as part of the pre-push and quality gates", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"))

    expect(packageJson.scripts["check:large-files"]).toBe(
      "node scripts/check-large-files.mjs"
    )
    expect(QUALITY_GATE_PROFILES.prepush).toContain("check:large-files")
    expect(QUALITY_GATE_PROFILES.full).toContain("check:large-files")
  })

  it("budgets public SVGs and duplicate public assets", () => {
    const scriptSource = readFileSync("scripts/check-large-files.mjs", "utf8")

    expect(scriptSource).toContain("public SVG asset")
    expect(scriptSource).toContain("64 * KB")
    expect(scriptSource).toContain("duplicate public assets")
    expect(scriptSource).toContain('execFileSync("git", ["ls-files", "-z"]')
  })

  it("keeps the RUNLOG index and monthly shards bounded", () => {
    const scriptSource = readFileSync("scripts/check-large-files.mjs", "utf8")

    expect(scriptSource).toContain('label: "run log index"')
    expect(scriptSource).toContain('label: "monthly run log"')
    expect(scriptSource).toContain('file === "docs/RUNLOG.md"')
    expect(scriptSource).toContain("/^docs\\/runlog\\/\\d{4}-\\d{2}\\.md$/")
    expect(scriptSource).toContain(
      'file === "docs/runlog/archive/legacy-through-2026-07-14.md"'
    )
  })
})
