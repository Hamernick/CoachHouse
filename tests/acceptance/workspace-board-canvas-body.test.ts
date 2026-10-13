import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  resolveWorkspaceCanvasTutorialCallout,
  resolveWorkspaceCanvasTutorialStep,
  resolveWorkspaceCanvasTutorialStepCount,
} from "@/features/workspace-canvas-tutorial"

const ROOT = process.cwd()

function readSource(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

function resolveTutorialStepIndex(stepId: string) {
  const stepCount = resolveWorkspaceCanvasTutorialStepCount()
  for (let index = 0; index < stepCount; index += 1) {
    if (resolveWorkspaceCanvasTutorialStep(index).id === stepId) {
      return index
    }
  }
  throw new Error(`Tutorial step not found: ${stepId}`)
}

describe("workspace board canvas body", () => {
  it("keeps team access visible while the setup guide owns tutorial presentation", () => {
    const tutorialCallout = resolveWorkspaceCanvasTutorialCallout(
      resolveTutorialStepIndex("collaboration"),
      []
    )
    const bodySource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-canvas-body.tsx"
    )
    const actionSource = readSource(
      "src/app/(dashboard)/my-organization/_components/workspace-board/workspace-board-team-access-header-action.tsx"
    )

    expect(tutorialCallout?.kind).toBe("team-access")
    expect(bodySource).toContain("<WorkspaceBoardTeamAccessHeaderAction")
    expect(bodySource).toContain("tutorialCallout={null}")
    expect(bodySource).toContain("<WorkspaceSetupGuide")
    expect(actionSource).toContain('<HeaderActionsPortal slot="right">')
    expect(bodySource).not.toContain("useAppShellRightRailControls")
    expect(bodySource).not.toContain("setRightOpenAuto")
  })
})
