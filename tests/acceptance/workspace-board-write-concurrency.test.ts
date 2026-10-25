import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it, vi } from "vitest"

import { buildDefaultBoardState } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-layout"
import { mergeNewerPersistedWorkspaceNodeState } from "@/app/(dashboard)/my-organization/_lib/workspace-board-state-persistence"
import {
  commitWorkspaceBoardState,
  WORKSPACE_BOARD_WRITE_CONFLICT_ERROR,
} from "@/app/(dashboard)/my-organization/_lib/workspace-board-state-write"

describe("workspace board write concurrency", () => {
  it("awaits calendar authorization and never writes an unauthorized graph", async () => {
    const write = vi.fn(async () => ({ status: "written" as const }))
    const defaults = buildDefaultBoardState()
    await expect(commitWorkspaceBoardState({
      readSnapshot: async () => ({ snapshot: { exists: true, revision: "1", state: defaults } }),
      buildState: () => defaults,
      updateParticleGraph: async () => { await Promise.resolve(); throw new Error("Calendar permission denied") },
      writeSnapshot: write,
    })).rejects.toThrow("Calendar permission denied")
    expect(write).not.toHaveBeenCalled()
  })
  it("retries a stale save and preserves the concurrent node position", async () => {
    const defaults = buildDefaultBoardState()
    const incoming = {
      ...defaults,
      updatedAt: "2026-08-11T15:00:00.000Z",
    }
    let persisted = {
      ...defaults,
      updatedAt: "2026-08-11T15:00:00.000Z",
    }
    let revision = "revision-1"
    let injectConcurrentSave = true
    let readCount = 0
    let writeCount = 0

    const result = await commitWorkspaceBoardState({
      readSnapshot: async () => {
        readCount += 1
        return {
          snapshot: {
            exists: true,
            revision,
            state: structuredClone(persisted),
          },
        }
      },
      buildState: (current) =>
        mergeNewerPersistedWorkspaceNodeState({
          incoming,
          persisted: current,
        }),
      writeSnapshot: async (snapshot, nextState) => {
        writeCount += 1
        if (injectConcurrentSave) {
          persisted = {
            ...persisted,
            updatedAt: "2026-08-11T15:01:00.000Z",
            nodes: persisted.nodes.map((node) =>
              node.id === "fiscal-sponsorship"
                ? {
                    ...node,
                    x: 420,
                    y: 920,
                    positionMode: "manual" as const,
                  }
                : node
            ),
          }
          revision = "revision-2"
          injectConcurrentSave = false
        }
        if (snapshot.revision !== revision) return { status: "conflict" }
        persisted = nextState
        revision = "revision-3"
        return { status: "written" }
      },
    })

    expect(result).toMatchObject({ ok: true })
    expect(readCount).toBe(2)
    expect(writeCount).toBe(2)
    expect(
      "boardState" in result
        ? result.boardState.nodes.find(
            (node) => node.id === "fiscal-sponsorship"
          )
        : null
    ).toMatchObject({ x: 420, y: 920, positionMode: "manual" })
  })

  it("returns a clear error after bounded conflicts", async () => {
    let readCount = 0
    let writeCount = 0
    const result = await commitWorkspaceBoardState({
      maxAttempts: 3,
      readSnapshot: async () => {
        readCount += 1
        return {
          snapshot: {
            exists: true,
            revision: `revision-${readCount}`,
            state: buildDefaultBoardState(),
          },
        }
      },
      buildState: (current) => current ?? buildDefaultBoardState(),
      writeSnapshot: async () => {
        writeCount += 1
        return { status: "conflict" }
      },
    })

    expect(result).toEqual({ error: WORKSPACE_BOARD_WRITE_CONFLICT_ERROR })
    expect(readCount).toBe(3)
    expect(writeCount).toBe(3)
  })

  it("guards both Workspace save actions with the row revision", () => {
    const root = process.cwd()
    const actionSource = readFileSync(
      join(
        root,
        "src/app/(dashboard)/my-organization/_lib/workspace-actions.ts"
      ),
      "utf8"
    )
    const writerSource = readFileSync(
      join(
        root,
        "src/app/(dashboard)/my-organization/_lib/workspace-board-state-write.ts"
      ),
      "utf8"
    )

    expect(actionSource.match(/persistWorkspaceBoardState\(\{/g)?.length).toBe(
      2
    )
    expect(actionSource).not.toContain(".upsert(boardUpsertPayload")
    expect(actionSource).toContain("ignoreDuplicates: true")
    expect(writerSource).toContain('.eq("updated_at", revision)')
    expect(writerSource).toContain("MAX_WORKSPACE_BOARD_WRITE_ATTEMPTS = 4")
    expect(writerSource).toContain("isUniqueViolation(error)")
  })
})
