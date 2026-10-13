import { resolveWorkspaceDrawerGuideState } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-drawer-state"
import { describe, expect, it } from "vitest"
import { setupGuideFocusCard, nextSetupGuideStage, normalizeSetupGuideProgress, resolveSetupGuideResumeStage, resolveSetupGuideStage, setupGuideEditorHref, setupGuideReturnHref, SETUP_GUIDE_STAGE_IDS, type SetupGuideStage } from "@/features/workspace-canvas-tutorial/lib/setup-guide"
import { setupGuideStackSpace, setupGuideStackViewport } from "@/features/workspace-canvas-tutorial/lib/setup-guide-stack"
import { setupGuideConnectorPath } from "@/features/workspace-canvas-tutorial/lib/setup-guide-connector"
import { placeSetupGuide } from "@/features/workspace-canvas-tutorial/lib/setup-guide-placement"
import { getOrganizationLaunchReturnHref, resolveEditorReturnDestination } from "@/lib/workspace/editor-navigation"

const empty = { name: "", programCount: 0, canEdit: true, hasAcceleratorAccess: true }

describe("sequential workspace walkthrough", () => {
  it("teaches every stop in order even for an already complete organization", () => {
    const saved = { ...empty, name: "Saved", mission: "Help people", programCount: 1, isPublic: true }
    expect(nextSetupGuideStage("welcome", saved)).toBe("identity")
    let stage: SetupGuideStage = SETUP_GUIDE_STAGE_IDS[0]
    const visited: SetupGuideStage[] = [stage]
    while (stage !== "next") { stage = nextSetupGuideStage(stage, saved); visited.push(stage) }
    expect(visited).toEqual(SETUP_GUIDE_STAGE_IDS)
    expect(resolveSetupGuideStage("program", empty).complete).toBe(false)
    expect(resolveSetupGuideStage("review", empty).complete).toBe(false)
  })
  it("opens the real drawer for each contextual step and preserves return context", () => {
    expect(new URL(setupGuideReturnHref("people"), "https://local.test").searchParams.get("drawer")).toBe("people")
    expect(setupGuideReturnHref("story")).toContain("focus=roadmap-guide")
    expect(setupGuideReturnHref("review")).toContain("focus=organization-launch")
    const url = new URL(setupGuideEditorHref("identity", "company", "name"), "https://workspace.local")
    expect(url.searchParams.get("view")).toBe("editor")
    expect(getOrganizationLaunchReturnHref(url.search)).toBe(setupGuideReturnHref("identity"))
    expect(resolveEditorReturnDestination(setupGuideReturnHref("review")).label).toBe("Setup")
  })
  it("returns program editing to the Activity walkthrough in the Organization drawer", () => {
    const step = resolveSetupGuideStage("program", empty)
    expect(step.href).toBeNull()
    const editor = new URL(setupGuideEditorHref("program", "programs"), "https://workspace.local")
    expect(editor.searchParams.get("view")).toBe("editor")
    expect(editor.searchParams.get("tab")).toBe("programs")
    const returnHref = getOrganizationLaunchReturnHref(editor.search)
    expect(returnHref).toBe(setupGuideReturnHref("program"))
    const destination = new URL(returnHref!, "https://workspace.local").searchParams
    expect(destination.get("tab")).toBe("programs")
    expect(resolveWorkspaceDrawerGuideState(destination)).toEqual({ tab: "organization", snapPoint: 1 })
    expect(resolveWorkspaceDrawerGuideState(new URL(setupGuideReturnHref("people"), "https://workspace.local").searchParams)).toEqual({ tab: "people", snapPoint: 0.48 })
    expect(resolveWorkspaceDrawerGuideState(new URL(setupGuideReturnHref("story"), "https://workspace.local").searchParams)).toEqual({ tab: "accelerator", snapPoint: 1 })
  })
  it.each([
    ["people", "people", null, null],
    ["program", "organization", "programs", null],
    ["story", "accelerator", null, "roadmap-guide"],
    ["review", "accelerator", null, "organization-launch"],
  ] as const)("restores the saved %s step with its actual drawer destination", (stage, drawer, tab, focus) => {
    const resumed = resolveSetupGuideResumeStage(null, { version: 2, stage, status: "paused" })
    const params = new URL(setupGuideReturnHref(resumed), "https://workspace.local").searchParams
    expect(params.get("guideStep")).toBe(stage)
    expect(params.get("drawer")).toBe(drawer)
    expect(params.get("tab")).toBe(tab)
    expect(params.get("focus")).toBe(focus)
    expect(resolveWorkspaceDrawerGuideState(params)?.tab).toBe(drawer)
  })
  it("prioritizes explicit steps and safely handles old or invalid saved progress", () => {
    const saved = { version: 1, stage: "program", status: "paused" }
    expect(resolveSetupGuideResumeStage("welcome", saved)).toBe("welcome")
    expect(resolveSetupGuideResumeStage("unknown", saved)).toBe("program")
    expect(resolveSetupGuideResumeStage(null, { stage: "program" })).toBe("welcome")
    expect(resolveSetupGuideResumeStage(null, null)).toBe("welcome")
  })
  it("does not convert guide progress into saved work or public visibility", () => {
    expect(resolveSetupGuideStage("review", empty).body).toContain("Staying private")
    expect(resolveSetupGuideStage("welcome", empty).label).toBe("Get started")
    expect(resolveSetupGuideStage("next", empty).href).toBe("/workspace")
    expect(setupGuideFocusCard("next")).toBe("organization-overview")
  })
  it("keeps readonly users out of editor-only/publication destinations", () => {
    for (const id of ["identity", "program", "review"] as const) {
      const stage = resolveSetupGuideStage(id, { ...empty, canEdit: false })
      expect(stage.href).toBeNull()
    }
  })
  it("introduces the locked Accelerator overview for free users", () => {
    const stage = resolveSetupGuideStage("story", { ...empty, hasAcceleratorAccess: false })
    expect(stage.title).toBe("Build faster")
    expect(stage.body).toContain("Upgrade")
    expect(stage.body).toContain("guided lessons, checklists, and frameworks")
    expect(stage.href).toBeNull()
  })
  it("migrates earlier progress without replaying a finished tour and rejects invalid stages", () => {
    expect(normalizeSetupGuideProgress({ version: 1, stage: "story", status: "paused" })).toEqual({ version: 2, stage: "story", status: "paused" })
    expect(normalizeSetupGuideProgress({ version: 1, stage: "next", status: "finished" })?.status).toBe("finished")
    expect(normalizeSetupGuideProgress({ version: 2, stage: "people", status: "active" })?.stage).toBe("people")
    expect(normalizeSetupGuideProgress({ version: 0, stage: "calendar", status: "finished" })).toBeNull()
    expect(normalizeSetupGuideProgress({ version: 2, stage: "story", status: "saved" })).toBeNull()
    expect(resolveEditorReturnDestination("//bad.example").label).toBe("Documents")
  })
})

describe("contextual guide placement", () => {
  const card = { width: 344, height: 310 }
  it.each([
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 667, height: 320 },
    { width: 1024, height: 768 },
    { width: 390, height: 240, top: 280, left: 12 },
  ])("keeps the full panel reachable inside the visible viewport: %o", (viewport) => {
    const top = "top" in viewport ? viewport.top ?? 0 : 0
    const left = "left" in viewport ? viewport.left ?? 0 : 0
    for (const compact of [false, true]) {
      const result = placeSetupGuide(null, viewport, { width: 440, height: 600 }, { compact, contextual: true })
      expect(result.left).toBeGreaterThanOrEqual(left + 16)
      expect(result.top).toBeGreaterThanOrEqual(top + 16)
      expect(result.left + result.width).toBeLessThanOrEqual(left + viewport.width - 16)
      expect(result.top + Math.min(600, result.maxHeight)).toBeLessThanOrEqual(top + viewport.height - 16)
    }
  })
  it("respects phone notches and home-indicator insets in landscape", () => {
    const viewport = { width: 844, height: 390, insets: { left: 44, right: 44, top: 0, bottom: 21 } }
    const result = placeSetupGuide({ left: 700, top: 280, width: 100, height: 80 }, viewport, { width: 440, height: 500 })
    expect(result.left).toBeGreaterThanOrEqual(60)
    expect(result.left + result.width).toBeLessThanOrEqual(784)
    expect(result.top + result.maxHeight).toBeLessThanOrEqual(353)
  })
  it("places mobile guidance above a control when there is enough room", () => {
    const target = { left: 16, top: 600, width: 300, height: 44 }
    const result = placeSetupGuide(target, { width: 390, height: 844 }, card)
    expect(result.top + card.height).toBeLessThan(target.top)
  })
  it("sits beside a visible target without covering it on desktop", () => {
    const target = { left: 300, top: 120, width: 400, height: 300 }
    const result = placeSetupGuide(target, { width: 1440, height: 900 }, card)
    expect(result.left).toBeGreaterThan(target.left + target.width)
    expect(result.top).toBeGreaterThanOrEqual(16)
  })
  it("flips to the left near the right edge", () => {
    const target = { left: 1000, top: 600, width: 200, height: 100 }
    const result = placeSetupGuide(target, { width: 1280, height: 800 }, card)
    expect(result.left + result.width).toBeLessThan(target.left)
    expect(result.top + card.height).toBeLessThanOrEqual(784)
  })
  it("keeps mobile and missing-target cards inside the viewport", () => {
    for (const target of [null, { left: 8, top: 200, width: 320, height: 120 }]) {
      const result = placeSetupGuide(target, { width: 320, height: 568 }, card)
      expect(result.left).toBeGreaterThanOrEqual(16)
      expect(result.left + result.width).toBeLessThanOrEqual(304)
      expect(result.top + card.height).toBeLessThanOrEqual(552)
    }
  })
})


describe("walkthrough drawer entry", () => {
  it.each(["welcome", "identity", "identity-edit", "next"])("starts %s on the canvas with a collapsed Organization rail", (stage) => {
    expect(resolveWorkspaceDrawerGuideState(new URLSearchParams(`guide=1&guideStep=${stage}`)))
      .toEqual({ tab: "organization", snapPoint: "68px" })
  })
  it.each([
    ["identity-drawer", "organization", 0.48],
    ["people", "people", 0.48],
    ["program", "organization", 1],
    ["story", "accelerator", 1],
    ["review", "accelerator", 1],
  ])("opens the actual drawer for %s", (stage, tab, snapPoint) => {
    expect(resolveWorkspaceDrawerGuideState(new URLSearchParams(`guide=1&guideStep=${stage}`)))
      .toEqual({ tab, snapPoint })
  })
  it("leaves normal browsing and editor links under their own drawer control", () => {
    for (const search of ["", "guide=0", "guideStep=welcome", "drawer=people", "guide=1&guideStep=identity&view=editor", "guide=1&guideStep=story&drawer=documents", "guide=1&drawer=roadmap"]) {
      expect(resolveWorkspaceDrawerGuideState(new URLSearchParams(search))).toBeNull()
    }
  })
  it("clears a stale drawer destination on welcome", () => {
    expect(resolveWorkspaceDrawerGuideState(new URLSearchParams("guide=1&guideStep=welcome&drawer=people")))
      .toEqual({ tab: "organization", snapPoint: "68px" })
  })
})


describe("guided preview placement", () => {
  it("centers welcome inside an offset canvas, excluding the sidebar", () => {
    const result = placeSetupGuide(null, { left: 256, top: 80, width: 1000, height: 720 }, { width: 380, height: 320 })
    expect(result.left + result.width / 2).toBe(756)
    expect(result.top + 160).toBe(440)
  })
  it.each([{ width: 1100, height: 800 }, { width: 390, height: 660 }, { width: 667, height: 320 }])("keeps the People tab exposed even when the guide needs scrolling: %o", (canvas) => {
    const target = { left: 90, top: canvas.height * 0.52, width: 80, height: 36 }
    const result = placeSetupGuide(target, canvas, { width: 380, height: 370 }, { above: true, contextual: true })
    const bottom = result.top + Math.min(370, result.maxHeight)
    expect(bottom <= target.top || result.top >= target.top + target.height).toBe(true)
    expect(result.left + result.width).toBeLessThanOrEqual(canvas.width - 16)
    expect(bottom).toBeLessThanOrEqual(canvas.height - 16)
  })
  it("introduces editing without navigating to an editor", () => {
    expect(nextSetupGuideStage("identity")).toBe("identity-edit")
    expect(nextSetupGuideStage("identity-edit")).toBe("identity-drawer")
    expect(nextSetupGuideStage("identity-drawer")).toBe("people")
    for (const stage of SETUP_GUIDE_STAGE_IDS.filter((stage) => stage !== "next")) {
      expect(resolveSetupGuideStage(stage, empty).href).toBeNull()
    }
    expect(setupGuideReturnHref("identity-drawer")).toContain("drawer=organization")
  })
})


describe("guide connector", () => {
  it("connects the guide edge to the tab edge without crossing either surface", () => {
    expect(setupGuideConnectorPath(
      { left: 200, top: 100, width: 380, height: 300 },
      { left: 300, top: 430, width: 80, height: 36 },
    )).toBe("M 390 400 C 390 415, 340 415, 340 430")
    expect(setupGuideConnectorPath(
      { left: 700, top: 100, width: 380, height: 300 },
      { left: 300, top: 100, width: 300, height: 300 },
    )).toBe("M 700 250 C 650 250, 650 250, 600 250")
  })
})


describe("canvas and guide column framing", () => {
  it.each([230, 280, 320])("fits a %ipx content-height guide without adding blank space", (guideHeight) => {
    const viewport = { width: 1000, height: 900 }
    const bounds = { x: 400, y: 100, width: 672, height: 480 }
    const camera = setupGuideStackViewport(bounds, viewport, guideHeight)
    const target = { left: bounds.x * camera.zoom + camera.x, top: bounds.y * camera.zoom + camera.y, width: bounds.width * camera.zoom, height: bounds.height * camera.zoom }
    const panel = placeSetupGuide(target, viewport, { width: 380, height: guideHeight }, { stack: true })
    expect(panel.panelHeight).toBeUndefined()
    expect(panel.top - target.top - target.height).toBeCloseTo(20)
    expect((target.top + panel.top + guideHeight) / 2).toBeCloseTo(viewport.height / 2)
  })

  it.each([
    { width: 320, height: 460 }, { width: 390, height: 700 },
    { width: 760, height: 600 }, { width: 667, height: 220 }, { width: 1280, height: 800 },
  ])("centers the combined group without overlaps: %o", (viewport) => {
    const bounds = { x: 1800, y: -600, width: 672, height: 800 }
    const camera = setupGuideStackViewport(bounds, viewport)
    const target = { left: bounds.x * camera.zoom + camera.x, top: bounds.y * camera.zoom + camera.y, width: bounds.width * camera.zoom, height: bounds.height * camera.zoom }
    const panel = placeSetupGuide(target, viewport, { width: 380, height: 360 }, { stack: true })
    const { guideHeight, gap } = setupGuideStackSpace(viewport.height)
    expect(target.left + target.width / 2).toBeCloseTo(viewport.width / 2)
    expect(panel.left + panel.width / 2).toBeCloseTo(viewport.width / 2)
    expect(panel.top - target.top - target.height).toBeCloseTo(gap)
    expect((target.top + panel.top + guideHeight) / 2).toBeCloseTo(viewport.height / 2)
    expect(target.top).toBeGreaterThanOrEqual(15.99)
    expect(panel.top + guideHeight).toBeLessThanOrEqual(viewport.height - 15.99)
    expect(camera.zoom).toBeLessThanOrEqual(0.78)
    expect(panel.panelHeight).toBeUndefined()
  })
})
