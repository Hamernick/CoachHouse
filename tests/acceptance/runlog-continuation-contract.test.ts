import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const legacyArchivePath = "docs/runlog/archive/legacy-through-2026-07-14.md"
const legacyArchiveSha256 =
  "00bb1f5e0c5dd14f5ae0c93915c9818091886aee683338144c5db1d5690558f7"

describe("RUNLOG continuation contract", () => {
  it("directs agents to the indexed current monthly log", () => {
    const agentContract = readFileSync("AGENTS.md", "utf8")
    const runlogIndex = readFileSync("docs/RUNLOG.md", "utf8")
    const currentLogMatch = runlogIndex.match(
      /\[20\d{2}-\d{2}\]\((runlog\/20\d{2}-\d{2}\.md)\)/
    )

    expect(agentContract).toContain(
      "read `docs/RUNLOG.md`, then the latest dated entries in its linked current monthly log"
    )
    expect(agentContract).toContain("never append to the index or an archive")
    expect(runlogIndex).toContain(
      "Append the session summary to the current monthly log, not this index."
    )
    expect(currentLogMatch).not.toBeNull()

    const currentLogPath = path.join("docs", currentLogMatch?.[1] ?? "")
    expect(existsSync(currentLogPath)).toBe(true)
    expect(readFileSync(currentLogPath, "utf8")).toMatch(
      /^# RUNLOG — 20\d{2}-\d{2}/
    )
  })

  it("requires a visible branch choice before new-chat writes", () => {
    const agentContract = readFileSync("AGENTS.md", "utf8")
    const workflowContract = readFileSync(
      "docs/agent/workflow-quality.md",
      "utf8"
    )

    expect(agentContract).toContain("New-chat branch checkpoint")
    expect(workflowContract).toContain("## New Chat Worktree Checkpoint")
    expect(workflowContract).toContain("git status --short --branch")
    expect(workflowContract).toContain("git worktree list")
    expect(workflowContract).toContain("continue the current branch")
    expect(workflowContract).toContain("use a named existing branch/worktree")
    expect(workflowContract).toContain("create a clean isolated")
    expect(workflowContract).toContain(
      "do not create or switch branches, move existing changes, or write task files until the user chooses."
    )
  })

  it("preserves the legacy monolith byte-for-byte", () => {
    const archive = readFileSync(legacyArchivePath)
    const archiveSha256 = createHash("sha256").update(archive).digest("hex")

    expect(archiveSha256).toBe(legacyArchiveSha256)
  })
})
