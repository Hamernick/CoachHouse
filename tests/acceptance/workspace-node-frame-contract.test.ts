import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const ROOT = process.cwd()

function readSource(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

describe("workspace node frame contract", () => {
  it("keeps the contract linked from AGENTS.md", () => {
    const agents = readSource("AGENTS.md")
    const contract = readSource("docs/agent/workspace-node-frame-contract.md")

    expect(agents).toContain("docs/agent/workspace-node-frame-contract.md")
    expect(contract).toContain("# Workspace Node Frame Contract")
    expect(contract).toContain("## Current Transitional State")
    expect(contract).toContain("## Target Pattern")
    expect(contract).toContain("## React Flow Boundary")
    expect(contract).toContain("## Anti-Patterns")
    expect(contract).toContain("WorkspaceNodeFrame")
    expect(contract).toContain("React Flow owns canvas behavior")
    expect(contract).toContain("Do not add new one-off canvas node shells.")
  })

  it("keeps card-style workspace node shells out of React Flow state ownership", () => {
    const nodeCardShell = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-node-card-shell.tsx"
    )
    const organizationShell = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-organization-card-shell.tsx"
    )
    const acceleratorShell = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-accelerator-card.tsx"
    )
    const fiscalShell = readSource(
      "src/features/fiscal-sponsorship/components/fiscal-sponsorship-panel.tsx"
    )

    for (const source of [
      nodeCardShell,
      organizationShell,
      acceleratorShell,
      fiscalShell,
    ]) {
      expect(source).not.toContain('from "@xyflow/react"')
      expect(source).not.toContain("useNodesState")
      expect(source).not.toContain("useEdgesState")
      expect(source).not.toContain("useStore(")
      expect(source).not.toContain("useReactFlow")
      expect(source).not.toContain("useUpdateNodeInternals")
    }
  })

  it("keeps no-footer card-style node spacing intentional", () => {
    const nodeCardShell = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-node-card-shell.tsx"
    )

    expect(nodeCardShell).toContain(
      'contentSurface === "plain" || !footer ? "pb-3" : "pb-0"'
    )
    expect(nodeCardShell).toContain("WORKSPACE_PARTICLE_CHROME.root")
    expect(nodeCardShell).toContain("WORKSPACE_PARTICLE_CHROME.body")
  })

  it("contains visual content without clipping React Flow handles", () => {
    const frameSource = readSource(
      "src/components/workspace/workspace-node-frame.tsx"
    )
    const ontologyNodeSource = readSource(
      "src/features/workspace-ontology/components/workspace-ontology-node.tsx"
    )

    expect(frameSource).toContain('data-workspace-node-part="surface"')
    expect(frameSource).toContain(
      "h-full min-h-0 w-full min-w-0 overflow-hidden rounded-[inherit]"
    )
    expect(frameSource).toContain('data-workspace-node-part="root"')
    expect(frameSource).toContain("overflow-visible")
    const frameRootStart = ontologyNodeSource.indexOf("<WorkspaceNodeFrameRoot")
    const frameRootEnd = ontologyNodeSource.indexOf(
      "</WorkspaceNodeFrameRoot>",
      frameRootStart
    )
    const frameRootBody = ontologyNodeSource.slice(frameRootStart, frameRootEnd)
    expect(frameRootBody.indexOf("<Handle")).toBeLessThan(
      frameRootBody.indexOf("{content}")
    )
    expect(frameRootBody.lastIndexOf("<Handle")).toBeGreaterThan(
      frameRootBody.indexOf("{content}")
    )
  })
})
