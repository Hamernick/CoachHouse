import { expect, test } from "@playwright/test"
import { build } from "vite"
import tailwindcss from "@tailwindcss/postcss"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import particleUiFoundation from "../../../src/components/ui/particle-ui/postcss.cjs"

let script = "", css = ""
test.beforeAll(async () => {
  const result = await build({
    configFile: false, logLevel: "error",
    worker: { format: "es" },
    resolve: { alias: { "@": resolve("src") } },
    plugins: [{ name: "isolated-planning-actions", enforce: "pre",
      resolveId(source) {
        if (source.endsWith("workspace-board-flow-surface-accelerator-graph-composition")) return "\0accelerator-identity-fixture"
        if (["@/features/workspace-particles/client", resolve("src/features/workspace-particles/client")].includes(source)) return resolve(__dirname, "particle-client.ts")
        if (["@/features/workspace-finance", resolve("src/features/workspace-finance")].includes(source)) return "\0finance-fixture"
        if (["@/features/workspace-ai/client", resolve("src/features/workspace-ai/client")].includes(source)) return "\0research-fixture"
        if (source === "next/navigation") return "\0navigation-fixture"
      },
      load(id) {
        if (id === "\0accelerator-identity-fixture") return 'export const ACCELERATOR_STEP_NODE_ID = "accelerator-active-step-node"'
        // Layout computation is independently covered; gestures use native edges.
        // Keep the worker out of this inline browser bundle.
        if (id.endsWith("/src/features/workspace-particles/lib/layout-worker-client.ts")) return 'export async function runParticleWorker(){return {ok:false,code:"unavailable",error:"Layout worker excluded from drag fixture"}}'
        if (id === "\0finance-fixture") return `export { WorkspaceOpportunitiesFeed } from ${JSON.stringify(resolve("src/features/workspace-finance/components/workspace-opportunities-feed.tsx"))}; export { WorkspaceOpportunityPreview } from ${JSON.stringify(resolve("src/features/workspace-finance/components/workspace-opportunity-preview.tsx"))}`
        if (id === "\0research-fixture") return 'export function WorkspaceResearch(){return null} export function SelectionAssistanceMenu(){return null}'
        if (id === "\0navigation-fixture") return 'export function usePathname(){return "/workspace"} export function useSearchParams(){return new URLSearchParams()} export function useRouter(){return {refresh(){localStorage.setItem("fixture-refreshed","true")},push(){}}}'
        if (!id.includes("/src/") || !/\.tsx?$/.test(id)) return
        const source = readFileSync(id, "utf8")
        if (!/^['"]use server['"]/.test(source.trimStart())) return
        const names = [...source.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)].map(match => match[1])
        return `import {callFixtureAction} from ${JSON.stringify(resolve(__dirname, "action-mocks.ts"))};\n` + names.map(name => `export async function ${name}(input){return callFixtureAction(${JSON.stringify(name)},input)}`).join("\n")
      },
    }],
    esbuild: { jsx: "automatic" }, css: { postcss: { plugins: [particleUiFoundation(), tailwindcss()] } },
    define: { "process.env.NODE_ENV": JSON.stringify("development") },
    build: { write: false, minify: false, rollupOptions: { input: resolve(__dirname, "fixture.tsx"), output: { inlineDynamicImports: true } } },
  })
  if (Array.isArray(result) || !("output" in result)) throw new Error("Expected fixture bundle")
  for (const entry of result.output) {
    if (entry.type === "chunk") script += entry.code
    else if (entry.fileName.endsWith(".css")) css += entry.source
  }
})
test.beforeEach(async ({ page }, testInfo) => {
  await page.route("https://planning.test/", route => route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' }))
  await page.goto("https://planning.test/")
  const nearCap = testInfo.titlePath.includes("near-cap actual source editor")
  // This source-editor flow does not use the unrelated planning-sidebar setup.
  // Mount its same 250-record fixture directly, including on actual reload.
  if (nearCap) {
    const mobile = testInfo.title.includes("touch reduced motion")
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1400, height: 1000 })
    await page.emulateMedia({ reducedMotion: mobile ? "reduce" : "no-preference" })
    await page.evaluate(() => localStorage.setItem("fixture-near-cap", "1"))
  }
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ type: "module", content: script })
  if (nearCap) return
  await expect(page.getByRole("complementary", { name: "Workspace planning" })).toBeVisible()
  const objectives = page.getByRole("button", { name: "Objectives", exact: true })
  await expect(objectives).toHaveAttribute("aria-expanded", "false")
  await objectives.click()
  const objective = page.getByRole("button", { name: /^Community workshop (Not started|0% work)$/, exact: true })
  await expect(objective).toHaveAttribute("aria-expanded", "false")
  await objective.click()
})

test("opportunity report body drags, saves position and keeps source controls interactive", async ({ page }) => {
  await page.getByRole("button", { name: "Show opportunity canvas" }).click()
  const body = page.getByText("Drag this opportunity report across the canvas.")
  await expect(body).toBeVisible()
  const node = page.locator(".react-flow__node").first()
  const before = (await node.boundingBox())!
  const target = (await body.boundingBox())!
  await page.mouse.move(target.x + 30, target.y + 8)
  await page.mouse.down()
  await page.mouse.move(target.x + 180, target.y + 108, { steps: 12 })
  await page.mouse.up()
  // React Flow consumes the first movement to activate dragging. Compare the
  // committed position to the rendered move, not the raw pointer distance.
  await expect.poll(async () => (await node.boundingBox())!.x - before.x).toBeGreaterThan(100)
  const moved = (await node.boundingBox())!
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("opportunity-canvas-graph") ?? "null")?.particles[0].position.x)).toBeCloseTo(70 + moved.x - before.x, 0)
  await page.getByRole("button", { name: "Preview Community partner", exact: true }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  expect((await node.boundingBox())!.x).toBeCloseTo(moved.x, 0)
  await page.reload()
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ type: "module", content: script })
  await page.getByRole("button", { name: "Show opportunity canvas" }).click()
  await expect(body).toBeVisible()
  expect((await node.boundingBox())!.x).toBeCloseTo(moved.x, 0)
})

test("fixed composer, preserved drafts, collapse and mobile width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const input = page.getByRole("textbox", { name: "New objective" })
  await input.fill("Draft objective")
  const before = await input.boundingBox()
  await page.getByRole("list", { name: "Objectives list" }).evaluate(el => { el.parentElement!.parentElement!.scrollTop = 9999 })
  expect((await input.boundingBox())!.y).toBe(before!.y)
  await page.getByRole("button", { name: "Opportunities", exact: true }).click()
  await expect(page.getByRole("textbox", { name: "New opportunity" })).toBeVisible()
  await page.getByRole("button", { name: "Opportunities", exact: true }).click()
  await page.getByRole("button", { name: "Objectives", exact: true }).click()
  await expect(input).toHaveValue("Draft objective")
  await page.getByRole("button", { name: "Objectives", exact: true }).click()
  await expect(input).toBeHidden()
  await page.getByRole("button", { name: "Objectives", exact: true }).click()
  await expect(input).toHaveValue("Draft objective")
  const sidebar = await page.getByRole("complementary").boundingBox()
  expect(sidebar!.x + sidebar!.width).toBeLessThanOrEqual(390)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test("objective deletion supports cancel, retry and preserves linked cards", async ({ page }) => {
  const options = page.getByRole("button", { name: "Options for Community workshop", exact: true })
  await options.click()
  await page.getByRole("menuitem", { name: "Delete", exact: true }).click()
  const dialog = page.getByRole("alertdialog")
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click()
  await expect(options).toBeVisible()
  await expect(options).toBeFocused()
  await options.click()
  await page.getByRole("menuitem", { name: "Delete", exact: true }).click()
  await page.evaluate(() => localStorage.setItem("fail-objective-delete", "true"))
  await dialog.getByRole("button", { name: "Delete", exact: true }).click()
  await expect(dialog.getByRole("alert")).toContainText("Could not delete")
  await expect(page.getByTestId("graph")).toContainText("Community workshop")
  await page.evaluate(() => localStorage.removeItem("fail-objective-delete"))
  await dialog.getByRole("button", { name: "Delete", exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(options).toHaveCount(0)
  await expect(page.getByRole("textbox", { name: "New objective" })).toBeFocused()
  const stored = JSON.parse(await page.getByTestId("graph").textContent() ?? "{}")
  expect(stored.particles.some((item: { title: string }) => item.title === "Community workshop")).toBe(false)
  expect(stored.particles.some((item: { title: string }) => item.title === "Invite community partners")).toBe(true)
})

test("objective creation and keyboard reordering use existing graph actions", async ({ page }) => {
  await page.getByRole("textbox", { name: "New objective" }).fill("New milestone")
  await page.getByRole("button", { name: "Add objective", exact: true }).click()
  await expect(page.getByRole("textbox", { name: "New objective" })).toHaveValue("")
  await expect(page.getByTestId("graph")).toContainText("New milestone")
  const first = page.getByRole("button", { name: /^Community workshop (Not started|0% work)/ })
  await first.focus(); await page.keyboard.press("Space")
  await expect(first).toHaveAttribute("aria-pressed", "true")
  await expect(page.getByRole("status").filter({ hasText: "position 1 of" })).toBeAttached()
  await page.keyboard.press("ArrowDown")
  await expect(page.getByRole("status").filter({ hasText: "position 2" })).toBeAttached()
  await page.keyboard.press("Space")
  await expect.poll(() => page.getByRole("list", { name: "Objectives list" }).locator(":scope > li").first().innerText()).toContain("Objective 2")
})

test("opportunity report saves through pinned actions and retains failed entries", async ({ page }) => {
  await page.getByRole("button", { name: "Opportunities", exact: true }).click()
  await page.getByRole("textbox", { name: "New opportunity" }).fill("New partnership")
  await page.getByRole("button", { name: "Add opportunity", exact: true }).click()
  await expect(page.getByRole("textbox", { name: "Opportunity", exact: true })).toHaveValue("New partnership")
  await page.evaluate(() => localStorage.setItem("fail-opportunity", "true"))
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await expect(page.getByRole("alert")).toContainText("Fixture save failed")
  await expect(page.getByRole("textbox", { name: "Opportunity", exact: true })).toHaveValue("New partnership")
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await expect(page.getByRole("heading", { name: "New partnership" })).toBeVisible()
  await expect(page.getByRole("textbox", { name: "New opportunity" })).toHaveValue("")
  await page.getByRole("button", { name: "Options for New partnership" }).click()
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click()
  await expect(page.getByRole("form", { name: "Edit opportunity" })).toBeVisible()
})

test("read-only keeps content and hides creation; dark reduced-motion layout", async ({ page }, testInfo) => {
  await page.getByRole("button", { name: "Toggle editing" }).click()
  await expect(page.getByRole("textbox", { name: "New objective" })).toHaveCount(0)
  await page.getByRole("button", { name: "Opportunities", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Community partnership" })).toBeVisible()
  await expect(page.getByRole("textbox", { name: "New opportunity" })).toHaveCount(0)
  await page.getByRole("button", { name: "Toggle theme" }).click()
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.getByRole("button", { name: "Opportunities", exact: true }).click()
  await page.getByRole("button", { name: "Objectives", exact: true }).click()
  await expect(page.getByRole("button", { name: "Objectives", exact: true })).toHaveAttribute("aria-expanded", "true")
  await expect(page.getByRole("tablist", { name: "Workspace feeds" })).toHaveCount(0)
  await expect(page.getByText("Planning", { exact: true })).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath("planning-sidebar-dark.png"), animations: "disabled" })
})


test("submenu rail follows selection and folds with the plan", async ({ page }, testInfo) => {
  const rows = page.getByRole("list", { name: "Workshop preparation particles" })
  const first = rows.getByRole("button", { name: /^Confirm the venue/ })
  const second = rows.getByRole("button", { name: /^Invite community partners/ })
  await first.click()
  await expect(first).toHaveAttribute("aria-pressed", "true")
  const rail = page.locator("[data-plan-active-rail]")
  await expect(rail).toBeVisible()
  await second.click()
  await expect(second).toHaveAttribute("aria-pressed", "true")
  await expect.poll(() => rail.evaluate(path => {
    const svg = path.closest("svg")!
    const row = svg.parentElement!.querySelector<HTMLElement>('[data-plan-member][data-selected="true"]')!
    const bounds = row.getBoundingClientRect()
    const end = (path as SVGPathElement).getPointAtLength((path as SVGPathElement).getTotalLength())
    return Math.abs(end.y - (bounds.top - svg.getBoundingClientRect().top + bounds.height / 2))
  })).toBeLessThan(1)
  await page.screenshot({ path: testInfo.outputPath("planning-submenu.png"), animations: "disabled" })
  await page.getByRole("button", { name: "Workshop preparation", exact: true }).click()
  await expect(rows).toBeHidden()
  await page.getByRole("button", { name: "Workshop preparation", exact: true }).click()
  await expect(rows).toBeVisible()
  await expect(second).toHaveAttribute("aria-pressed", "true")
})

for (const objective of [false, true]) test(`${objective ? "objective" : "plan"} disclosure animates height in both directions and respects reduced motion`, async ({ page }) => {
  const trigger = objective ? page.getByRole("button", { name: /^Community workshop/ }) : page.getByRole("button", { name: "Workshop preparation", exact: true })
  const content = page.locator(`[id="${await trigger.getAttribute("aria-controls")}"]`)
  const expandedHeight = await content.evaluate(element => element.getBoundingClientRect().height)
  expect(expandedHeight).toBeGreaterThan(0)
  for (const opening of [false, true]) {
    const heights = await trigger.evaluate(async button => {
      const panel = document.getElementById(button.getAttribute("aria-controls")!)!
      const samples: number[] = []
      ;(button as HTMLButtonElement).click()
      const started = performance.now()
      await new Promise<void>(resolve => {
        const sample = () => {
          samples.push(panel.getBoundingClientRect().height)
          if (performance.now() - started < 350) requestAnimationFrame(sample)
          else resolve()
        }
        requestAnimationFrame(sample)
      })
      return samples
    })
    expect(heights.filter(height => height > 2 && height < expandedHeight - 2).length).toBeGreaterThan(1)
    expect(heights.at(-1)).toBeCloseTo(opening ? expandedHeight : 0, 0)
  }
  await page.emulateMedia({ reducedMotion: "reduce" })
  await trigger.click()
  await expect(content).toBeHidden()
  await trigger.click()
  await expect(content).toBeVisible()
  expect(await content.evaluate(element => getComputedStyle(element).animationName)).toBe("none")
})

test("tree connectors share status and disclosure centerlines", async ({ page }) => {
  const geometry = await page.getByRole("list", { name: "Objectives list" }).evaluate(list => {
    const objective = list.querySelector("li")!
    const header = objective.querySelector(":scope > div")!
    const button = header.querySelector("button")!
    const mark = button.querySelector(":scope > span")!.getBoundingClientRect()
    const before = getComputedStyle(header, "::after")
    const planButton = [...objective.querySelectorAll("button")].find(button => button.textContent === "Workshop preparation")!
    const icon = planButton.querySelector("svg")!.getBoundingClientRect()
    const svg = objective.querySelector("[data-plan-submenu-rail]")!.getBoundingClientRect()
    const planHeader = planButton.parentElement!
    const elbow = getComputedStyle(planHeader, "::before")
    return { markCenter: mark.x + mark.width / 2, rootRail: header.getBoundingClientRect().x + parseFloat(before.left) + parseFloat(before.width) / 2,
      iconCenter: icon.x + icon.width / 2, childRail: svg.x + 8,
      elbowCenter: planHeader.getBoundingClientRect().x + parseFloat(elbow.left) + parseFloat(elbow.borderLeftWidth) / 2 }
  })
  expect(Math.abs(geometry.markCenter - geometry.rootRail)).toBeLessThan(0.1)
  expect(Math.abs(geometry.rootRail - geometry.elbowCenter)).toBeLessThan(0.1)
  expect(Math.abs(geometry.iconCenter - geometry.childRail)).toBeLessThan(0.1)
  for (const dark of [false, true]) {
    await page.evaluate(value => document.documentElement.classList.toggle("dark", value), dark)
    const samples = await page.locator("[data-plan-submenu-rail] > path").first().evaluate(path => {
      const canvas = document.createElement("canvas")
      const context = canvas.getContext("2d")!
      context.fillStyle = getComputedStyle(path).stroke
      context.fillRect(0, 0, 2, 1)
      const single = [...context.getImageData(0, 0, 1, 1).data]
      context.fillRect(0, 0, 1, 1)
      return { single, overlap: [...context.getImageData(0, 0, 1, 1).data] }
    })
    expect(samples.single[3]).toBe(255)
    expect(samples.overlap).toEqual(samples.single)
  }
})


test("collapsed organization morph shell stays behind its button", async ({ page }, testInfo) => {
  await page.getByRole("button", { name: "Show overlay samples" }).click()
  await page.getByRole("button", { name: "Show organization morph" }).click()
  const trigger = page.getByRole("button", { name: "Open organization: Example organization" })
  const shell = page.locator('[data-workspace-presentation="sidebar"]')
  for (let cycle = 0; cycle < 2; cycle++) {
    await expect(trigger).toBeVisible()
    expect(await shell.evaluate(element => Number(getComputedStyle(element).zIndex))).toBeLessThan(await trigger.evaluate(element => Number(getComputedStyle(element).zIndex)))
    await trigger.click()
    await expect(shell).toHaveAttribute("aria-hidden", "false")
    await page.getByRole("button", { name: "Close organization fixture" }).click()
    await expect(shell).toHaveAttribute("aria-hidden", "true")
  }
  await expect(trigger).toBeVisible()
  await expect.poll(async () => Math.abs((await shell.boundingBox())!.height - (await trigger.boundingBox())!.height)).toBeLessThan(1)
  await expect.poll(async () => Math.abs((await shell.boundingBox())!.width - (await trigger.boundingBox())!.width)).toBeLessThan(1)
  await page.screenshot({ path: testInfo.outputPath("organization-trigger-restored.png"), animations: "disabled" })
})

test("canvas overlays share dock glass with accessible solid fallback", async ({ page }, testInfo) => {
  await page.getByRole("button", { name: "Show overlay samples" }).click()
  const surfaces = page.locator(".canvas-glass")
  await expect(surfaces).toHaveCount(5)
  for (const dark of [false, true]) {
    await page.evaluate(value => document.documentElement.classList.toggle("dark", value), dark)
    const readMaterials = () => surfaces.evaluateAll(elements => elements.map(element => {
      const style = getComputedStyle(element)
      return { background: style.backgroundColor, border: style.borderTopColor, blur: style.getPropertyValue("backdrop-filter") || style.getPropertyValue("-webkit-backdrop-filter"), shadow: style.boxShadow }
    }))
    await expect.poll(async () => {
      const values = await readMaterials()
      return values.every(value => JSON.stringify(value) === JSON.stringify(values[0]))
    }).toBe(true)
    const materials = await readMaterials()
    expect(materials[0].blur).toBe("blur(24px)")
    await page.screenshot({ path: testInfo.outputPath(`overlay-glass-${dark ? "dark" : "light"}.png`), animations: "disabled" })
  }
  await page.emulateMedia({ contrast: "more" })
  const readFallback = () => surfaces.evaluateAll(elements => elements.map(element => {
    const style = getComputedStyle(element)
    const context = document.createElement("canvas").getContext("2d")!
    context.fillStyle = style.backgroundColor; context.fillRect(0, 0, 1, 1)
    return { blur: style.getPropertyValue("backdrop-filter") || style.getPropertyValue("-webkit-backdrop-filter"), alpha: context.getImageData(0, 0, 1, 1).data[3] }
  }))
  await expect.poll(async () => (await readFallback()).every(value => value.blur === "none" && value.alpha === 255)).toBe(true)
})


test("objective status submenu has colored choices and persists selection", async ({ page }) => {
  const options = page.getByRole("button", { name: "Options for Community workshop", exact: true })
  await options.click()
  const status = page.getByRole("menuitem", { name: "Status", exact: true })
  await status.focus()
  await page.keyboard.press("ArrowRight")
  const initial = page.getByRole("menuitemradio", { name: "Not started", exact: true })
  await expect(initial).toHaveAttribute("aria-checked", "true")
  const choices = page.getByRole("menuitemradio")
  await expect(choices).toHaveCount(4)
  const colors = await choices.evaluateAll(items => items.map(item => getComputedStyle(item.querySelector("span[aria-hidden]")!).backgroundColor))
  expect(new Set(colors).size).toBe(4)
  await page.getByRole("menuitemradio", { name: "In progress", exact: true }).click()
  await expect(page.getByRole("list", { name: "Objectives list" }).locator(":scope > li").first()).toHaveAttribute("data-status", "in_progress")
  await options.click()
  await page.getByRole("menuitem", { name: "Status", exact: true }).focus()
  await page.keyboard.press("ArrowRight")
  await expect(page.getByRole("menuitemradio", { name: "In progress", exact: true })).toHaveAttribute("aria-checked", "true")
})


test("compact feeds share one panel, preserve drafts and restore Escape focus", async ({ page }) => {
  const sidebar = page.getByRole("complementary", { name: "Workspace planning" })
  const objectives = page.getByRole("button", { name: "Objectives", exact: true })
  const opportunities = page.getByRole("button", { name: "Opportunities", exact: true })
  const canvas = (await page.getByTestId("planning-canvas").boundingBox())!
  expect((await sidebar.boundingBox())!.x).toBeCloseTo(canvas.x + 8, 0)
  await expect(sidebar.getByRole("button", { name: "Opportunities", exact: true })).toBeVisible()
  await page.getByRole("textbox", { name: "New objective" }).fill("Retained objective")
  await opportunities.click()
  await expect(objectives).toHaveAttribute("aria-expanded", "false")
  const input = page.getByRole("textbox", { name: "New opportunity" })
  await input.fill("Retained opportunity")
  await input.press("Escape")
  await expect(opportunities).toBeFocused()
  await expect(input).toBeHidden()
  await expect.poll(async () => (await sidebar.boundingBox())!.height).toBeLessThan(90)
  expect((await sidebar.boundingBox())!.width).toBeLessThanOrEqual(288)
  await opportunities.click()
  await expect(input).toHaveValue("Retained opportunity")
  await objectives.click()
  await expect(input).toBeHidden()
  await expect(page.getByRole("textbox", { name: "New objective" })).toHaveValue("Retained objective")
  await page.getByRole("button", { name: "Opportunity actions" }).click()
  await page.getByRole("menuitem", { name: "Add opportunity", exact: true }).click()
  await expect(page.getByRole("form", { name: "Add opportunity" })).toBeVisible()
  await expect(opportunities).toHaveAttribute("aria-expanded", "true")
})

test("contextual placement moves only the attached managed card and fades removal", async ({ page }) => {
  await page.getByRole("button", { name: "Show placement canvas" }).click()
  await page.getByRole("button", { name: "Add unassigned", exact: true }).click()
  await expect(page.getByText("Unassigned", { exact: true })).toBeVisible()
  const read = () => page.evaluate(() => JSON.parse(localStorage.getItem("placement-graph")!))
  const before = await read()
  const created = before.particles.find((item: { title: string }) => item.title === "Unassigned item")
  expect(created.position).toEqual({ x: -1100, y: 100 })
  const node = page.locator(`.react-flow__node[data-id="${created.id}"]`)
  const samples = await page.evaluate(async () => {
    const result: string[] = []
    const element = [...document.querySelectorAll<HTMLElement>(".react-flow__node")].find(node => node.textContent?.includes("Unassigned item"))!
    const button = [...document.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent === "Attach to plan")!
    button.click()
    const start = performance.now()
    while (performance.now() - start < 400) {
      result.push(element.style.transform)
      await new Promise(requestAnimationFrame)
    }
    return result
  })
  expect(new Set(samples).size).toBeGreaterThan(3)
  const after = await read()
  const attached = after.particles.find((item: { id: string }) => item.id === created.id)
  expect(attached.position.x).toBe(644)
  expect(after.connections).toEqual([])
  expect(after.particles.find((item: { title: string }) => item.title === "Manually placed").position).toEqual({ x: 644, y: 500 })
  await expect(page.getByText("Preparation", { exact: true })).toBeVisible()
  await expect(node).toBeInViewport()
  await page.screenshot({ path: `test-results/planning-sidebar/placement-${test.info().project.name}.png` })
  await page.getByRole("button", { name: "Remove item", exact: true }).click()
  await expect(node).toHaveCount(0)
})

test("contextual placement respects reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.getByRole("button", { name: "Show placement canvas" }).click()
  await page.getByRole("button", { name: "Add unassigned", exact: true }).click()
  await page.getByRole("button", { name: "Attach to plan", exact: true }).click()
  const node = page.locator(".react-flow__node").filter({ hasText: "Unassigned item" })
  await expect(node).toHaveCSS("transform", /644/)
  await page.getByRole("button", { name: "Remove item", exact: true }).click()
  await expect(node).toHaveCount(0)
})


test("opportunity filters archive, reload, restore and recover failures", async ({ page }) => {
  await page.evaluate(() => localStorage.setItem("opportunity-fixtures", JSON.stringify([
    { id: "00000000-0000-4000-8000-000000000051", title: "Suggested partnership", origin: "suggested", status: "saved" },
    { id: "00000000-0000-4000-8000-000000000052", title: "Submitted grant", origin: "suggested", status: "applied" },
    { id: "00000000-0000-4000-8000-000000000053", title: "Awarded grant", origin: "suggested", status: "awarded" },
  ])))
  const reload = async () => { await page.reload(); await page.addStyleTag({ content: css }); await page.addScriptTag({ type: "module", content: script }); await page.getByRole("button", { name: "Opportunities", exact: true }).click() }
  await reload()
  const archive = async () => { await page.getByRole("button", { name: "Opportunity actions", exact: true }).click(); await page.getByRole("menuitem", { name: "View archive", exact: true }).click() }
  await expect(page.getByRole("tablist", { name: "Filter opportunities" })).toHaveCount(0)
  await expect(page.getByRole("definition")).toHaveCount(2)
  await expect(page.getByRole("heading", { name: "Suggested partnership" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Save Suggested partnership", exact: true })).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Community partnership" })).toBeVisible()
  await expect(page.getByRole("button", { name: /^(Save|Saved) Suggested partnership$/ })).toHaveCount(0)
  await page.evaluate(() => localStorage.setItem("fail-status", "true"))
  await page.getByRole("button", { name: "Options for Suggested partnership", exact: true }).click()
  await page.getByRole("menuitem", { name: "Archive", exact: true }).click()
  await expect(page.getByText("Fixture status failed")).toBeVisible()
  await expect(page.getByRole("heading", { name: "Suggested partnership" })).toBeVisible()
  await page.getByRole("button", { name: "Options for Suggested partnership", exact: true }).click()
  await page.getByRole("menuitem", { name: "Archive", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Suggested partnership" })).toHaveCount(0)
  await expect(page.getByRole("region", { name: "Current opportunities", exact: true })).toBeFocused()
  await page.evaluate(() => localStorage.setItem("fail-archive-load", "true"))
  await archive()
  await expect(page.getByRole("alert")).toContainText("Archived opportunities couldn’t be loaded.")
  await page.getByRole("button", { name: "Retry", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Suggested partnership" })).toBeVisible()
  await reload()
  await archive()
  await expect(page.getByRole("heading", { name: "Suggested partnership" })).toBeVisible()
  await page.getByRole("button", { name: "Options for Suggested partnership", exact: true }).click()
  await page.getByRole("menuitem", { name: "Restore", exact: true }).click()
  await expect(page.getByText("No archived opportunities.")).toBeVisible()
  await page.getByRole("button", { name: "Back to opportunities", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Suggested partnership" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Submitted grant" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Awarded grant" })).toBeVisible()
  await page.screenshot({ path: test.info().outputPath("opportunity-overflow-tabs.png") })
})


test("opportunity statistics stay pinned above a long mobile list", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => localStorage.setItem("opportunity-fixtures", JSON.stringify(Array.from({ length: 24 }, (_, i) => ({ id: `fixture-${i}`, title: `Opportunity ${i}`, origin: "suggested", status: "new" })))))
  await page.reload(); await page.addStyleTag({ content: css }); await page.addScriptTag({ type: "module", content: script })
  await page.getByRole("button", { name: "Opportunities", exact: true }).click()
  const tabs = page.locator('dl[aria-label="Opportunity statistics"]')
  const input = page.getByRole("textbox", { name: "New opportunity" })
  await expect(tabs).toBeVisible(); await expect(input).toBeVisible()
  const top = (await tabs.boundingBox())!.y
  const footer = (await input.boundingBox())!.y
  const scroller = page.locator('[data-scroll-fade-managed="true"]').filter({ has: page.getByRole("list", { name: "Opportunities feed" }) })
  expect(await scroller.evaluate(el => el.scrollHeight - el.clientHeight)).toBeGreaterThan(100)
  await scroller.evaluate(el => { el.scrollTop = el.scrollHeight })
  expect(Math.abs((await tabs.boundingBox())!.y - top)).toBeLessThan(2)
  expect(Math.abs((await input.boundingBox())!.y - footer)).toBeLessThan(2)
  await page.getByRole("button", { name: "Opportunity actions", exact: true }).click()
  await page.getByRole("menuitem", { name: "View archive", exact: true }).click()
  await expect(page.getByRole("button", { name: "Back to opportunities" })).toBeInViewport()
  await page.getByRole("button", { name: "Toggle theme" }).click()
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.getByRole("button", { name: "Back to opportunities" }).click()
  await expect(input).toBeInViewport()
  await page.screenshot({ path: test.info().outputPath("opportunity-tabs-mobile-dark.png"), animations: "disabled" })
})


test("opportunity editor replaces the feed and returns to its filter, scroll and focus", async ({ page }) => {
  await page.evaluate(() => localStorage.setItem("opportunity-fixtures", JSON.stringify(Array.from({ length: 14 }, (_, i) => ({ id: `00000000-0000-4000-8000-${String(i + 200).padStart(12, "0")}`, title: `Draft ${i}`, origin: "manual", status: "new" })))))
  await page.reload(); await page.addStyleTag({ content: css }); await page.addScriptTag({ type: "module", content: script })
  await page.getByRole("button", { name: "Opportunities", exact: true }).click()
  await page.getByRole("textbox", { name: "New opportunity" }).fill("Keep this draft")
  const options = page.getByRole("button", { name: "Options for Draft 13", exact: true })
  await options.scrollIntoViewIfNeeded()
  const scroller = page.locator('[data-scroll-fade-managed="true"]').filter({ has: page.getByRole("list", { name: "Opportunities feed" }) })
  const scroll = await scroller.evaluate(el => el.scrollTop)
  expect(scroll).toBeGreaterThan(0)
  await options.click()
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click()
  const editor = page.getByRole("form", { name: "Edit opportunity" })
  await expect(editor).toBeVisible()
  await expect(page.getByRole("list", { name: "Opportunities feed" })).toHaveCount(0)
  await expect(page.getByRole("tablist", { name: "Filter opportunities" })).toHaveCount(0)
  await expect(page.getByRole("textbox", { name: "New opportunity" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Save", exact: true })).toHaveCount(1)
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeInViewport()
  await expect(editor.getByRole("button", { name: "Save", exact: true })).toHaveCount(0)
  const title = page.getByRole("textbox", { name: "Opportunity", exact: true })
  const pencil = title.locator("..").locator("[data-edit-indicator]")
  await page.getByRole("button", { name: "Save", exact: true }).focus()
  await page.getByRole("button", { name: "Show placement canvas", exact: true }).hover()
  await expect(pencil).toHaveCSS("opacity", "0")
  const before = await title.boundingBox()
  await title.hover();
  await page.screenshot({ path: test.info().outputPath("hover.png") }); await expect(pencil).toHaveCSS("opacity", "1")
  const after = (await title.boundingBox())!
  expect(after.width).toBe(before!.width); expect(after.height).toBe(before!.height)
  await page.getByRole("button", { name: "Show placement canvas", exact: true }).hover(); await expect(pencil).toHaveCSS("opacity", "0")
  const footer = page.locator("[data-opportunity-editor-toolbar]")
  const footerBox = (await footer.boundingBox())!
  expect(await footer.evaluate(el => getComputedStyle(el).position)).toBe("static")
  const saveBox = (await page.getByRole("button", { name: "Save", exact: true }).boundingBox())!
  expect(saveBox.x + saveBox.width).toBeLessThanOrEqual(footerBox.x + footerBox.width + 1)
  expect(saveBox.height).toBe(28)
  expect(footerBox.y + footerBox.height).toBeLessThanOrEqual((await title.boundingBox())!.y)
  await page.screenshot({ path: test.info().outputPath("opportunity-editor-toolbar.png") })

  await page.getByRole("button", { name: "Cancel editing opportunity" }).click()
  await expect(options).toBeFocused()
  await expect(page.locator('dl[aria-label="Opportunity statistics"]')).toBeVisible()
  await expect.poll(async () => Math.abs(await scroller.evaluate(el => el.scrollTop) - scroll)).toBeLessThan(2)
  await expect(page.getByRole("textbox", { name: "New opportunity" })).toHaveValue("Keep this draft")
  await options.click(); await page.getByRole("menuitem", { name: "Edit", exact: true }).click()
  await page.getByRole("textbox", { name: "Opportunity", exact: true }).fill("Updated partnership")
  await page.getByRole("button", { name: "Opportunities", exact: true }).click()
  await page.getByRole("button", { name: "Opportunities", exact: true }).click()
  await expect(page.getByRole("textbox", { name: "Opportunity", exact: true })).toHaveValue("Updated partnership")
  await page.evaluate(() => localStorage.setItem("fail-opportunity", "true"))
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await expect(page.getByRole("alert")).toContainText("Fixture save failed")
  await expect(editor).toBeVisible()
  await expect(page.getByRole("textbox", { name: "Opportunity", exact: true })).toHaveValue("Updated partnership")
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await expect(editor).toHaveCount(0)
  await expect(page.locator('dl[aria-label="Opportunity statistics"]')).toBeVisible()
  await expect(page.getByRole("button", { name: "Options for Updated partnership", exact: true })).toBeFocused()
  await expect(page.getByRole("textbox", { name: "New opportunity" })).toHaveValue("Keep this draft")
})


test("opportunity drag persists order, changes tabs and reuses canvas cards", async ({ page }) => {
  await page.evaluate(() => localStorage.setItem("opportunity-fixtures", JSON.stringify([{ id: "00000000-0000-4000-8000-000000000051", title: "Second opportunity", origin: "manual", status: "new" }])))
  await page.reload(); await page.addStyleTag({ content: css }); await page.addScriptTag({ type: "module", content: script })
  await page.getByRole("button", { name: "Opportunities", exact: true }).click()
  const handle = page.getByRole("button", { name: "Community partnership", exact: true })
  await handle.click({ trial: true }); await handle.focus(); await page.keyboard.press("Space");
  await expect(handle).toHaveAttribute("aria-pressed", "true")
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  await page.keyboard.press("ArrowDown");
  await expect(page.getByText("Position 2.", { exact: true })).toBeAttached()
  await page.keyboard.press("Space")
  const list = page.getByRole("list", { name: "Opportunities feed" })
  await expect(list.getByRole("heading").first()).toContainText("Second opportunity")
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("fixture-opportunity-order") ?? "[]")[0])).toBe("00000000-0000-4000-8000-000000000051")
  await page.reload(); await page.addStyleTag({ content: css }); await page.addScriptTag({ type: "module", content: script })
  await page.getByRole("button", { name: "Opportunities", exact: true }).click()
  await expect(list.getByRole("heading").first()).toContainText("Second opportunity")
  const dragTo = async (x: number, y: number, filter?: string) => {
    await handle.click({ trial: true })
    const bounds = (await handle.boundingBox())!
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
    await page.mouse.down(); await page.mouse.move(x, y, { steps: 20 });
    if (filter) await expect(page.locator(`[data-opportunity-drop-tab="${filter}"]`)).toHaveAttribute("data-drop-active", "true")
    await page.mouse.up()
  }
  await dragTo(780, 750)
  const graph = () => page.getByTestId("graph").textContent().then(text => JSON.parse(text!))
  await expect.poll(async () => (await graph()).particles.filter((item: any) => item.data.widget?.kind === "opportunity").length).toBe(1)
  const first = (await graph()).particles.find((item: any) => item.data.widget?.kind === "opportunity")
  expect(first.positionMode).toBe("manual")
  await dragTo(730, 700)
  await expect.poll(async () => (await graph()).particles.find((item: any) => item.data.widget?.kind === "opportunity").position).not.toEqual(first.position)
  const next = (await graph()).particles.filter((item: any) => item.data.widget?.kind === "opportunity")
  expect(next).toHaveLength(1); expect(next[0].id).toBe(first.id)
  expect(next[0].position).not.toEqual(first.position)
})


test("failed opportunity load keeps navigation and creation available with retry", async ({ page }) => {
  await page.evaluate(() => localStorage.setItem("opportunities-error", "true"))
  await page.reload(); await page.addStyleTag({ content: css }); await page.addScriptTag({ type: "module", content: script })
  await page.getByRole("button", { name: "Opportunities", exact: true }).click()
  await expect(page.getByRole("alert").filter({ hasText: "Opportunities couldn’t be loaded." })).toBeVisible()
  await expect(page.getByRole("tablist", { name: "Filter opportunities" })).toHaveCount(0)
  await expect(page.locator('dl[aria-label="Opportunity statistics"] dd')).toHaveText(["—", "—"])
  await expect(page.getByRole("textbox", { name: "New opportunity" })).toBeVisible()
  await page.getByRole("button", { name: "Retry", exact: true }).click()
  await expect.poll(() => page.evaluate(() => localStorage.getItem("fixture-refreshed"))).toBe("true")
  await page.getByRole("textbox", { name: "New opportunity" }).fill("Recoverable draft")
  await page.getByRole("button", { name: "Add opportunity", exact: true }).click()
  await expect(page.getByRole("form", { name: "Add opportunity" })).toBeVisible()
  await expect(page.getByRole("textbox", { name: "Opportunity", exact: true })).toHaveValue("Recoverable draft")
  await page.getByRole("button", { name: "Cancel adding opportunity" }).click()
  await expect(page.getByRole("textbox", { name: "New opportunity" })).toHaveValue("Recoverable draft")
})


test("opportunity views animate out and in with compact pinned top actions", async ({ page }) => {
  await page.getByRole("button", { name: "Opportunities", exact: true }).click()
  await page.getByRole("button", { name: "Options for Community partnership", exact: true }).click()
  const sample = (element: Element) => new Promise<{ kind: string; opacity: number; active: number }[]>(resolve => {
    const samples: { kind: string; opacity: number; active: number }[] = []
    const start = performance.now()
    ;(element as HTMLElement).click()
    const frame = () => {
      const views = [...document.querySelectorAll<HTMLElement>("[data-opportunity-view]")]
      for (const view of views) samples.push({kind:view.dataset.opportunityView!,opacity:Number(getComputedStyle(view).opacity),active:views.filter(item=>!item.inert).length})
      if (performance.now() - start < 550) requestAnimationFrame(frame); else resolve(samples)
    }
    requestAnimationFrame(frame)
  })
  const opening = await page.getByRole("menuitem", { name: "Edit", exact: true }).evaluate(sample)
  for (const kind of ["list", "editor"]) expect(opening.some(item => item.kind === kind && item.opacity > 0.01 && item.opacity < 0.99)).toBe(true)
  expect(opening.every(item => item.active <= 1)).toBe(true)
  const closing = await page.getByRole("button", { name: "Cancel editing opportunity" }).evaluate(sample)
  for (const kind of ["editor", "list"]) expect(closing.some(item => item.kind === kind && item.opacity > 0.01 && item.opacity < 0.99)).toBe(true)
  expect(closing.every(item => item.active <= 1)).toBe(true)
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.getByRole("button", { name: "Options for Community partnership", exact: true }).click()
  const reduced = await page.getByRole("menuitem", { name: "Edit", exact: true }).evaluate(sample)
  expect(reduced.some(item => item.opacity > 0.01 && item.opacity < 0.99)).toBe(false)
  await page.setViewportSize({ width: 390, height: 720 })
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeInViewport()
  const toolbar = (await page.locator("[data-opportunity-editor-toolbar]").boundingBox())!
  expect(toolbar.x).toBeGreaterThanOrEqual(0); expect(toolbar.x + toolbar.width).toBeLessThanOrEqual(390)
})

test("opportunity titles replace grips and show available image thumbnails", async ({ page }) => {
  const fileId = "00000000-0000-4000-8000-000000000099"
  await page.route("**/api/account/organization-document-files?**", route => route.fulfill({ json: { url: "https://planning.test/thumbnail.svg" } }))
  await page.route("https://planning.test/thumbnail.svg", route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="green"/></svg>' }))
  await page.evaluate(fileId => localStorage.setItem("opportunity-fixtures", JSON.stringify([{ id: "00000000-0000-4000-8000-000000000051", title: "Image opportunity", origin: "manual", status: "new", report: { version: 1, blocks: [{ id: "00000000-0000-4000-8000-000000000098", title: "", kind: "image", fileId, alt: "Community garden" }] } }])), fileId)
  await page.reload(); await page.addStyleTag({ content: css }); await page.addScriptTag({ type: "module", content: script })
  await page.getByRole("button", { name: "Opportunities", exact: true }).click()
  const title = page.getByRole("button", { name: "Image opportunity", exact: true })
  await expect(title).toContainText("Image opportunity")
  await expect(title).toContainText("Amount not specified")
  const thumbnail = title.locator("[data-opportunity-thumbnail]")
  await expect(thumbnail).toBeVisible()
  await expect.poll(() => thumbnail.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)
  expect((await thumbnail.boundingBox())!.width).toBe(32)
  await expect(page.getByRole("button", { name: "Community partnership", exact: true })).toContainText("Community partnership")
  await expect(page.locator(".lucide-grip-vertical")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Community partnership", exact: true }).locator("img")).toHaveCount(0)
  await thumbnail.evaluate(image => image.dispatchEvent(new Event("error")))
  await expect(thumbnail).toHaveCount(0)
  await expect(title).toContainText("Image opportunity")
  await expect(title).toContainText("Amount not specified")
})

test("opportunity source icons reuse the cached provider and recover image failures", async ({ page }) => {
  await page.evaluate(() => localStorage.setItem("opportunity-fixtures", JSON.stringify([
    { id: "icon-grants", title: "Research grant", origin: "suggested", status: "saved", attribution: "grants_gov" },
    { id: "icon-private", title: "Private link", origin: "manual", status: "new", sources: [{kind:"link",url:"http://127.0.0.1/private"}] },
  ])))
  await page.reload(); await page.addStyleTag({ content: css }); await page.addScriptTag({ type: "module", content: script })
  await page.getByRole("button", { name: "Opportunities", exact: true }).click()
  const provider = page.getByRole("img", { name: "Source website: www.grants.gov", exact: true })
  await expect(provider).toBeVisible()
  await expect.poll(() => provider.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)
  await expect(provider).toHaveAttribute("referrerpolicy", "no-referrer")
  await provider.evaluate(image=>image.dispatchEvent(new Event("error")))
  await expect(provider).toHaveCount(0)
  await expect(page.locator('[data-opportunity-site-icon][title="Source website: www.grants.gov"] svg')).toBeVisible()
  await expect(page.getByRole("button", {name:"Private link",exact:true}).locator("[data-opportunity-site-icon]")).toHaveCount(0)
})

test("report Add stays centered below content with compact bottom spacing", async ({ page }) => {
  await page.getByRole("button", {name:"Opportunities",exact:true}).click()
  await page.getByRole("button", {name:"Add opportunity",exact:true}).click()
  const form = page.getByRole("form", {name:"Add opportunity",exact:true})
  const add = form.getByRole("button", {name:"Add component",exact:true})
  await expect(add).toBeVisible()
  const geometry = await add.evaluate(el=>{const r=el.getBoundingClientRect();const f=el.closest('form')!.getBoundingClientRect();return {center:Math.abs(r.x+r.width/2-f.x-f.width/2),bottom:f.bottom-r.bottom}})
  expect(geometry.center).toBeLessThan(1)
  expect(geometry.bottom).toBe(8)
  await expect(page.locator("[data-opportunity-editor-toolbar]").getByRole("button",{name:"Add component"})).toHaveCount(0)
  await add.click()
  await page.getByRole("menuitem", {name:"Text",exact:true}).click()
  await expect(page.getByRole("textbox", {name:"Text heading",exact:true})).toBeFocused()
  await page.getByRole("button",{name:"Options for Text",exact:true}).click()
  await page.getByRole("menuitem",{name:"Remove component",exact:true}).click()
  await expect(add).toBeFocused()
})

test("opportunity shadcn picker saves single dates and ranges across reload", async ({ page }) => {
  await page.evaluate(()=>localStorage.setItem("opportunity-fixtures",JSON.stringify([{id:"00000000-0000-4000-8000-000000000071",title:"Timeline report",origin:"manual",status:"new",dueAt:"2026-10-13T12:00:00.000Z",report:{version:1,blocks:[]}}])))
  const reload=async()=>{await page.reload();await page.addStyleTag({content:css});await page.addScriptTag({type:"module",content:script});await page.getByRole("button",{name:"Opportunities",exact:true}).click()}
  const edit=async()=>{await page.getByRole("button",{name:"Options for Timeline report",exact:true}).click();await page.getByRole("menuitem",{name:"Edit",exact:true}).click()}
  await reload();await edit()
  await page.getByRole("button",{name:"Timeline, 2026-10-13",exact:true}).click()
  await page.getByRole("button",{name:/October 15/}).click()
  const single=page.getByRole("button",{name:"Timeline, 2026-10-15",exact:true})
  await expect(single).toBeFocused();await single.click()
  await page.getByText("Range",{exact:true}).click()
  await page.getByRole("button",{name:/October 13/}).click()
  await expect(page.getByRole("status").filter({hasText:"Choose an end date"})).toBeVisible()
  await page.getByRole("button",{name:/October 20/}).click()
  const range=page.getByRole("button",{name:"Timeline, 2026-10-13 to 2026-10-20",exact:true})
  await expect(range).toBeFocused()
  await range.click();await page.getByRole("button",{name:/October 13/}).click();await expect(page.getByRole("status").filter({hasText:"Choose an end date"})).toBeVisible();await page.keyboard.press("Escape")
  await expect(range).toBeVisible()
  await page.getByRole("button",{name:"Save",exact:true}).click()
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("saved-opportunity")!))
  expect(saved.report.timeline).toEqual({from:"2026-10-13",to:"2026-10-20"})
  expect(saved.dueAt).toBe("2026-10-20T12:00:00.000Z")
  await page.evaluate(()=>localStorage.setItem("opportunity-fixtures",JSON.stringify([JSON.parse(localStorage.getItem("saved-opportunity")!)])))
  await reload();await edit();await range.click()
  await expect(page.locator('[data-range-start="true"]')).toHaveCount(1)
  await expect(page.locator('[data-range-end="true"]')).toHaveCount(1)
  await page.setViewportSize({width:390,height:844})
  const picker=await page.getByRole("dialog",{name:"Timeline picker",exact:true}).boundingBox()
  expect(picker!.x).toBeGreaterThanOrEqual(0);expect(picker!.x+picker!.width).toBeLessThanOrEqual(390)
  await page.getByRole("button",{name:"Clear dates",exact:true}).click()
  await expect(page.getByRole("button",{name:"Timeline, optional",exact:true})).toBeFocused()
  await page.getByRole("button",{name:"Save",exact:true}).click()
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("saved-opportunity")!))).toMatchObject({deadline:"",dueAt:null})
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("saved-opportunity")!).report.timeline)).toBeUndefined()
})

test("planning sidebar fits content and caps overflowing lists with a pinned input", async ({ page }) => {
  await page.evaluate(() => localStorage.setItem("objective-fixture-count", "1"))
  await page.reload(); await page.addStyleTag({ content: css }); await page.addScriptTag({ type: "module", content: script })
  await page.getByRole("button", { name: "Objectives", exact: true }).click()
  await page.getByRole("button", { name: /^Community workshop (Not started|0% work)$/, exact: true }).click()
  const sidebar = page.getByRole("complementary", { name: "Workspace planning" })
  const input = page.getByRole("textbox", { name: "New objective" })
  const metrics = () => sidebar.evaluate(el => ({ height: el.getBoundingClientRect().height, available: el.parentElement!.clientHeight, content: el.querySelector('[aria-hidden="false"]')!.getBoundingClientRect().height }))
  await expect.poll(async () => (await metrics()).height).toBeGreaterThan(100)
  await sidebar.evaluate(async el => {
    await Promise.all(el.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {})))
  })
  const expanded = await metrics()
  expect(expanded.height).toBeLessThan(expanded.available - 100)
  const objective = page.getByRole("button", { name: /^Community workshop (Not started|0% work)$/, exact: true })
  await objective.click()
  await expect.poll(async () => (await metrics()).height).toBeLessThan(expanded.height - 50)
  await objective.click()
  await expect.poll(async () => Math.abs((await metrics()).height - expanded.height)).toBeLessThan(1)
  await input.fill("Second objective"); await page.getByRole("button", { name: "Add objective", exact: true }).click()
  await expect.poll(async () => (await metrics()).height).toBeGreaterThan(expanded.height + 30)
  await page.evaluate(() => localStorage.removeItem("objective-fixture-count"))
  await page.reload(); await page.addStyleTag({ content: css }); await page.addScriptTag({ type: "module", content: script })
  await page.getByRole("button", { name: "Objectives", exact: true }).click()
  await page.getByRole("button", { name: /^Community workshop (Not started|0% work)$/, exact: true }).click()
  await page.setViewportSize({ width: 390, height: 720 })
  await expect.poll(async () => {const m=await metrics(); return Math.abs(m.height-m.available)}).toBeLessThan(1)
  const scroller = page.locator('[data-scroll-fade-managed="true"]').filter({ has: page.getByRole("list", { name: "Objectives list" }) })
  expect(await scroller.evaluate(el => el.scrollHeight - el.clientHeight)).toBeGreaterThan(100)
  const before = (await input.boundingBox())!
  await scroller.evaluate(el => { el.scrollTop = el.scrollHeight })
  expect((await input.boundingBox())!.y).toBeCloseTo(before.y, 0)
  const bounds = (await sidebar.boundingBox())!
  expect(before.y + before.height).toBeLessThanOrEqual(bounds.y + bounds.height)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390)
})

test("Sources searches grants inline, adds a named pill and saves it without leaving the editor", async ({ page }) => {
  await page.getByRole("button",{name:"Opportunities",exact:true}).click()
  await page.getByRole("textbox",{name:"New opportunity"}).fill("Community funding")
  await page.getByRole("button",{name:"Add opportunity",exact:true}).click()
  const sources=page.getByRole("combobox",{name:"Sources",exact:true})
  await sources.fill("community")
  expect(await page.evaluate(()=>localStorage.getItem("funding-search-count"))).toBeNull()
  await sources.press("ArrowDown");await sources.press("Enter")
  const result=page.getByRole("option",{name:/Community facilities grant/})
  await expect(result).toBeVisible()
  await result.click()
  await expect(page.getByRole("button",{name:"Preview Community facilities grant",exact:true})).toBeVisible()
  await expect(sources).toHaveValue("")
  await page.getByRole("button",{name:"Save",exact:true}).click()
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("saved-opportunity")!).sources)).toEqual([{kind:"link",url:"https://www.grants.gov/search-results-detail/123",title:"Community facilities grant"}])
  await page.getByRole("button",{name:"Options for Community funding",exact:true}).click()
  await page.getByRole("menuitem",{name:"Edit",exact:true}).click()
  await expect(page.getByRole("button",{name:"Preview Community facilities grant",exact:true})).toBeVisible()
  await sources.fill("community");await page.getByRole("option",{name:"Search Grants.gov",exact:true}).click()
  await expect(page.getByRole("status").filter({hasText:"No new grants found."})).toBeVisible()
  await sources.press("Escape")
  await expect(page.getByRole("form",{name:"Edit opportunity"})).toBeVisible()
})

test("Sources handles grant errors, empty results and stale responses without auto-searching mentions", async ({ page }) => {
  await page.getByRole("button",{name:"Opportunities",exact:true}).click()
  await page.getByRole("textbox",{name:"New opportunity"}).fill("Funding draft")
  await page.getByRole("button",{name:"Add opportunity",exact:true}).click()
  const sources=page.getByRole("combobox",{name:"Sources",exact:true})
  await sources.fill("@person")
  await expect(page.getByRole("option",{name:"Search Grants.gov",exact:true})).toHaveCount(0)
  expect(await page.evaluate(()=>localStorage.getItem("funding-search-count"))).toBeNull()
  await sources.fill("community")
  await page.evaluate(()=>localStorage.setItem("funding-search-error","true"))
  await page.getByRole("option",{name:"Search Grants.gov",exact:true}).click()
  await expect(page.getByRole("alert").filter({hasText:"Grants.gov is unavailable"})).toBeVisible()
  await page.getByRole("option",{name:"Retry Grants.gov",exact:true}).click()
  await expect(page.getByRole("option",{name:/Community facilities grant/})).toBeVisible()
  await sources.fill("slow");await page.getByRole("option",{name:"Search Grants.gov",exact:true}).click()
  await expect(page.getByRole("status").filter({hasText:"Searching Grants.gov"})).toBeVisible()
  await sources.fill("empty");await page.getByRole("option",{name:"Search Grants.gov",exact:true}).click()
  await expect(page.getByRole("status").filter({hasText:"No new grants found."})).toBeVisible()
  await expect(page.getByRole("option",{name:/Stale grant/})).toHaveCount(0)
  await sources.fill("Local foundation");await sources.press("Enter")
  await expect(page.getByRole("button",{name:"Preview Local foundation",exact:true})).toBeVisible()
  await expect(page.getByRole("form",{name:"Add opportunity"})).toBeVisible()
})


test("canvas drag preserves edge identity and suspends overlay blur", async ({ page }) => {
  await page.getByRole("button", { name: "Show drag performance canvas" }).click()
  const node = page.locator('.react-flow__node[data-id="card-0"]')
  const box = (await node.boundingBox())!
  const before = Number(await page.getByTestId("edge-builds").textContent())
  const glass = page.getByTestId("drag-glass")
  const readBlur = () => glass.evaluate(el => { const style = getComputedStyle(el); return style.getPropertyValue("backdrop-filter") || style.getPropertyValue("-webkit-backdrop-filter") })
  const initialBlur = await readBlur()
  await page.mouse.move(box.x + 50, box.y + 15)
  await page.mouse.down()
  await page.mouse.move(box.x + 170, box.y + 65, { steps: 24 })
  await expect(node).toHaveClass(/dragging/)
  const during = Number(await page.getByTestId("edge-builds").textContent())
  console.log(JSON.stringify({ extraEdgeBuilds: during - before, initialBlur, dragBlur: await readBlur() }))
  expect(during - before).toBe(0)
  await expect.poll(readBlur).toBe("none")
  await page.mouse.up()
  await expect(node).not.toHaveClass(/dragging/)
  await expect.poll(readBlur).toBe(initialBlur)
  expect((await node.boundingBox())!.x).toBeGreaterThan(box.x + 80)
})

for (const reducedMotion of [false, true]) {
  test(`workspace loading keeps its footprint and reveals ready panels (reduced motion: ${reducedMotion})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: reducedMotion ? "reduce" : "no-preference", colorScheme: reducedMotion ? "dark" : "light" })
    if (reducedMotion) {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.evaluate(() => document.documentElement.classList.add("dark"))
    }
    await page.getByRole("button", { name: "Show workspace loading" }).click()
    const loading = page.locator('[data-workspace-loading]')
    await expect(page.getByRole("status", { name: "Loading canvas" })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    const frameBounds = () => page.getByTestId("loading-frame").evaluate(el => {
      const rect = el.getBoundingClientRect()
      return { x: rect.x + scrollX, y: rect.y + scrollY, width: rect.width, height: rect.height }
    })
    const before = await frameBounds()
    const panel = page.getByRole("tabpanel", { name: "People" })
    await expect(panel.locator('[data-workspace-panel-loading]')).toBeVisible()
    expect(await panel.evaluate(el => getComputedStyle(el).animationName)).toBe("none")
    if (reducedMotion) {
      expect(await loading.locator('[data-slot="skeleton"]').first().evaluate(el => getComputedStyle(el).animationName)).toBe("none")
    }
    await page.getByRole("button", { name: "Resolve workspace content" }).click()
    await expect(loading).toHaveCount(0)
    await expect(page.getByRole("status", { name: "Loading canvas" })).toHaveCount(0)
    await expect(panel.getByRole("button", { name: "Open contact" })).toBeVisible()
    const after = await frameBounds()
    expect(after).toEqual(before)
    expect(await panel.evaluate(el => getComputedStyle(el).animationName)).toBe(reducedMotion ? "none" : "workspace-content-reveal")
    await panel.getByRole("button", { name: "Open contact" }).focus()
    await expect(panel.getByRole("button", { name: "Open contact" })).toBeFocused()
  })
}

test("200 rich cards keep retained planning out of pointer updates and save only on release", async ({ page }) => {
  await page.getByRole("button", { name: "Show loaded canvas" }).click()
  const node = page.locator('.react-flow__node[data-id="00000000-0000-4000-8001-000000000000"]')
  await expect(node.getByText("Load card 1", { exact: true })).toBeVisible()
  await expect.poll(() => page.locator('.react-flow__node').count()).toBeLessThan(30)
  await expect(page.locator('.react-flow__edge[data-id="00000000-0000-4000-8003-000000000999"] .react-flow__edge-path')).toBeAttached()
  const before = (await node.boundingBox())!
  await page.mouse.move(before.x + 120, before.y + 16)
  await page.mouse.down()
  await page.mouse.move(before.x + 130, before.y + 20, { steps: 2 })
  await expect(node).toHaveClass(/dragging/)
  await page.evaluate(() => (window as unknown as { resetDragLoadMetrics: () => void }).resetDragLoadMetrics())
  await page.mouse.move(before.x + 260, before.y + 110, { steps: 40 })
  const metrics = await page.evaluate(() => (window as unknown as { dragLoadMetrics: { planningMs: number; nodeUpdates: number; saves: number } }).dragLoadMetrics)
  console.log("loaded canvas", metrics)
  expect(metrics.nodeUpdates).toBeGreaterThan(20)
  expect(metrics.planningMs).toBeLessThan(50)
  expect(metrics.saves).toBe(0)
  await page.mouse.up()
  await expect.poll(() => page.evaluate(() => (window as unknown as { dragLoadMetrics: { saves: number } }).dragLoadMetrics.saves)).toBe(1)
  const after = (await node.boundingBox())!
  expect(after.x - before.x).toBeGreaterThan(100)
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("drag-load-position") ?? "null"))
  expect(saved.position.x).toBeCloseTo(450 + after.x - before.x, 0)
  await page.getByRole("button", { name: "Opportunities", exact: true }).click()
  await expect(page.getByRole("list", { name: "Opportunities feed" })).toBeVisible()
})

 test("opening an opportunity replaces feed and stats with a navigable report", async ({ page }) => {
  await page.evaluate(() => localStorage.setItem("opportunity-fixtures", JSON.stringify([
    { id: "00000000-0000-4000-8000-000000000051", title: "Second report", origin: "manual", status: "new" },
  ])))
  await page.reload(); await page.addStyleTag({ content: css }); await page.addScriptTag({ type: "module", content: script })
  await page.getByRole("button", { name: "Opportunities", exact: true }).click()
  await page.getByRole("textbox", { name: "New opportunity" }).fill("Keep draft")
  await page.getByRole("button", { name: "Community partnership", exact: true }).click()
  await expect(page.getByRole("region", { name: "Opportunity report" })).toBeVisible()
  await expect(page.getByRole("list", { name: "Opportunities feed" })).toHaveCount(0)
  await expect(page.locator('dl[aria-label="Opportunity statistics"]')).toHaveCount(0)
  await expect(page.getByRole("textbox", { name: "New opportunity" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Previous opportunity" })).toBeDisabled()
  await page.getByRole("button", { name: "Next opportunity" }).click()
  await expect(page.getByRole("heading", { name: "Second report", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Options for Second report" }).click()
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click()
  await expect(page.getByRole("form", { name: "Edit opportunity" })).toBeVisible()
  await page.getByRole("button", { name: "Cancel editing opportunity" }).click()
  await expect(page.getByRole("region", { name: "Opportunity report" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Second report", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Previous opportunity" }).click()
  await expect(page.getByRole("heading", { name: "Community partnership", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Back", exact: true }).click()
  await expect(page.getByRole("list", { name: "Opportunities feed" })).toBeVisible()
  await expect(page.locator('dl[aria-label="Opportunity statistics"]')).toBeVisible()
  await expect(page.getByRole("textbox", { name: "New opportunity" })).toHaveValue("Keep draft")
  await expect(page.getByRole("button", { name: "Options for Community partnership" })).toBeFocused()
})

test("deadline metric requests calendar date and calendar links respect organization and drafts", async ({ page }) => {
  const id = "00000000-0000-4000-8000-000000000051"
  const dueAt = new Date(Date.now() + 2 * 86_400_000).toISOString()
  await page.evaluate(({ id, dueAt }) => localStorage.setItem("opportunity-fixtures", JSON.stringify([{ id, title: "Dated grant", origin: "manual", status: "new", dueAt }])), { id, dueAt })
  await page.reload(); await page.addStyleTag({ content: css }); await page.addScriptTag({ type: "module", content: script })
  await page.getByRole("button", { name: "Opportunities", exact: true }).click()
  await page.evaluate(() => window.addEventListener("coach-house:workspace-calendar-open", event => localStorage.setItem("calendar-open-at", String((event as CustomEvent).detail.at))))
  await page.getByRole("button", { name: /^Open calendar:/ }).click()
  expect(await page.evaluate(() => localStorage.getItem("calendar-open-at"))).toBe(String(Date.parse(dueAt)))
  const request = (orgId: string) => page.evaluate(({ id, orgId }) => {
    const event = new CustomEvent("coach-house:open-opportunity", { detail: { id, orgId }, cancelable: true })
    window.dispatchEvent(event)
    return event.defaultPrevented
  }, { id, orgId })
  expect(await request("wrong-organization")).toBe(false)
  await expect(page.getByRole("region", { name: "Opportunity report" })).toHaveCount(0)
  expect(await request("00000000-0000-4000-8000-000000000001")).toBe(true)
  await expect(page.getByRole("region", { name: "Opportunity report" })).toBeVisible()
  await page.getByRole("button", { name: "Options for Dated grant" }).click()
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click()
  await expect(page.getByRole("form", { name: "Edit opportunity" })).toBeVisible()
  await page.getByRole("textbox", { name: "Opportunity", exact: true }).fill("Keep unsaved work")
  expect(await request("00000000-0000-4000-8000-000000000001")).toBe(true)
  await expect(page.getByRole("textbox", { name: "Opportunity", exact: true })).toHaveValue("Keep unsaved work")
  await expect(page.getByText("Finish editing this opportunity first.")).toBeVisible()
})


test("manual plan keyboard reorder and detach preserve source records", async ({ page }) => {
  const list = page.getByRole("list", { name: "Workshop preparation particles", exact: true })
  const first = list.getByRole("button", { name: /^Confirm the venue and accessibility requirements/ })
  await first.focus()
  await page.keyboard.press("Space")
  await expect(first).toHaveAttribute("aria-pressed", "true")
  await page.keyboard.press("ArrowDown")
  await expect(page.getByRole("status").filter({ hasText: "position 2 of 2" })).toBeAttached()
  await page.keyboard.press("Space")
  await expect(list.locator(":scope > li").first()).toContainText("Invite community partners")
  await page.getByRole("button", { name: "Options for Invite community partners", exact: true }).click()
  await page.getByRole("menuitem", { name: "Remove from plan", exact: true }).click()
  await expect(list).not.toContainText("Invite community partners")
  const saved = JSON.parse(await page.getByTestId("graph").textContent() ?? "{}")
  expect(saved.particles.some((item: { title: string }) => item.title === "Invite community partners")).toBe(true)
})

test("walkthrough returns selection and viewport without changing plan data", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  const before = await page.getByTestId("graph").textContent()
  const originViewport = await page.evaluate(() => localStorage.getItem("navigation-viewport"))
  const options = page.getByRole("button", { name: "Options for Workshop preparation", exact: true })
  await options.click()
  await page.getByRole("menuitem", { name: "Walk through", exact: true }).click()
  const walkthrough = page.getByRole("region", { name: "Plan walkthrough" })
  await expect(walkthrough).toContainText("1 of 2")
  await expect(walkthrough).toContainText("Confirm the venue")
  await expect.poll(() => page.evaluate(() => localStorage.getItem("navigation-duration"))).toBe("0")
  await walkthrough.getByRole("button", { name: "Next", exact: true }).focus()
  await page.keyboard.press("Enter")
  await expect(walkthrough).toContainText("Invite community partners")
  await expect(walkthrough).toContainText("2 of 2")
  await walkthrough.getByRole("button", { name: "Back", exact: true }).click()
  await expect(walkthrough).toContainText("1 of 2")
  await walkthrough.getByRole("button", { name: "Exit", exact: true }).click()
  await expect(walkthrough).toHaveCount(0)
  await expect(options).toBeFocused()
  await expect(page.getByTestId("navigation-selection")).toHaveText("00000000-0000-4000-8000-000000000100")
  expect(await page.getByTestId("graph").textContent()).toBe(before)
  expect(await page.evaluate(() => localStorage.getItem("returned-viewport"))).toBe(originViewport)
})

test("walkthrough guards drafts, redacts removed targets and permits direct navigation", async ({ page }) => {
  await page.getByRole("button", { name: "Options for Workshop preparation", exact: true }).click()
  await page.getByRole("menuitem", { name: "Walk through", exact: true }).click()
  const walkthrough = page.getByRole("region", { name: "Plan walkthrough" })
  await page.getByRole("button", { name: "Toggle dirty editor", exact: true }).click()
  await walkthrough.getByRole("button", { name: "Next", exact: true }).click()
  await expect(walkthrough).toContainText("1 of 2")
  await walkthrough.getByRole("button", { name: "Exit", exact: true }).click()
  await expect(walkthrough).toBeVisible()
  await page.getByRole("button", { name: "Toggle dirty editor", exact: true }).click()
  await page.getByRole("button", { name: "Revoke current target", exact: true }).click()
  await expect(walkthrough).toContainText("Item unavailable")
  await expect(walkthrough).not.toContainText("Confirm the venue")
  await walkthrough.getByRole("button", { name: "Next", exact: true }).click()
  await expect(walkthrough).toContainText("Invite community partners")
  await page.getByRole("list", { name: "Workshop preparation particles" }).getByRole("button", { name: "Invite community partners Not started", exact: true }).click()
  await expect(walkthrough).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem("returned-viewport"))).toBe(await page.evaluate(() => localStorage.getItem("navigation-viewport")))
})


test("walkthrough restores sharing scope and drops revoked share members", async ({ page }) => {
  await page.getByRole("button", { name: "Open shared selection", exact: true }).click()
  const before = JSON.parse((await page.getByTestId("inspection-state").textContent())!)
  const start = async () => {
    await page.getByRole("button", { name: "Options for Workshop preparation", exact: true }).click()
    await page.getByRole("menuitem", { name: "Walk through", exact: true }).click()
  }
  await start()
  const walkthrough = page.getByRole("region", { name: "Plan walkthrough" })
  await walkthrough.getByRole("button", { name: "Exit", exact: true }).click()
  expect(JSON.parse((await page.getByTestId("inspection-state").textContent())!)).toEqual(before)
  await start()
  await walkthrough.getByRole("button", { name: "Next", exact: true }).click()
  await page.getByRole("button", { name: "Revoke current target", exact: true }).click()
  await walkthrough.getByRole("button", { name: "Exit", exact: true }).click()
  expect(JSON.parse((await page.getByTestId("inspection-state").textContent())!)).toEqual({ ...before, shareIds: [before.id] })
})


test("new inspection interrupts real camera animation and delayed scene fits", async ({ page }) => {
  await page.getByRole("button", { name: "Show camera fixture", exact: true }).click()
  await page.getByRole("button", { name: "Focus distant card", exact: true }).click()
  const viewport = page.getByTestId("camera-viewport")
  await expect.poll(async () => JSON.parse((await viewport.textContent())!).x).toBeLessThan(-20)
  await page.getByRole("button", { name: "Inspect first card", exact: true }).click()
  await expect(page.getByTestId("camera-inspector")).toHaveText("00000000-0000-4000-8000-000000000001")
  const stopped = JSON.parse((await viewport.textContent())!)
  // Observe beyond the old transition's duration; no late camera takeover.
  await page.waitForTimeout(500)
  expect(JSON.parse((await viewport.textContent())!)).toEqual(stopped)
  await page.getByRole("button", { name: "Queue delayed scene", exact: true }).click()
  await page.getByRole("button", { name: "Inspect first card", exact: true }).click()
  await page.getByRole("button", { name: "Refresh camera inputs", exact: true }).click()
  await page.waitForTimeout(450)
  expect(JSON.parse((await viewport.textContent())!)).toEqual(stopped)
})


for (const mobile of [false, true]) {
  test(`measured card focus avoids overlays (${mobile ? "mobile reduced motion" : "desktop"})`, async ({ page }) => {
    if (mobile) {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.emulateMedia({ reducedMotion: "reduce" })
    }
    await page.getByRole("button", { name: "Show camera fixture", exact: true }).click()
    await page.getByRole("button", { name: "Show measured focus obstacles" }).click()
    const card = page.locator('.react-flow__node[data-id="00000000-0000-4000-8000-000000000002"]')
    await expect(card).toHaveCSS("width", "816px")
    await page.getByRole("button", { name: "Focus distant card", exact: true }).click()
    await expect.poll(async () => {
      const bounds = await card.boundingBox()
      if (!bounds) return false
      for (const name of ["focus-island", "focus-composer"]) {
        const obstacle = (await page.getByTestId(name).boundingBox())!
        if (bounds.x < obstacle.x + obstacle.width && bounds.x + bounds.width > obstacle.x && bounds.y < obstacle.y + obstacle.height && bounds.y + bounds.height > obstacle.y) return false
      }
      const size = page.viewportSize()!
      return bounds.x >= 23 && bounds.y >= 23 && bounds.x + bounds.width <= size.width - 23 && bounds.y + bounds.height <= size.height - 23
    }).toBe(true)
    await expect(page.getByTestId("camera-inspector")).toBeEmpty()
  })
}

for (const mobile of [false, true]) {
  test(`fully covered canvas opens read-only preview (${mobile ? "mobile" : "desktop"})`, async ({ page }) => {
    if (mobile) {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.emulateMedia({ reducedMotion: "reduce" })
    }
    await page.getByRole("button", { name: "Show camera fixture", exact: true }).click()
    await page.getByRole("button", { name: "Cover canvas", exact: true }).click()
    const viewport = await page.getByTestId("camera-viewport").textContent()
    await page.getByRole("button", { name: "Focus distant card", exact: true }).click()
    const preview = page.getByRole("region", { name: "Card 2 preview" })
    await expect(preview).toBeVisible()
    await expect(preview).toBeFocused()
    await expect(page.getByTestId("camera-mode")).toHaveText("preview")
    await expect(preview.locator('input:not([disabled]), textarea:not([disabled])')).toHaveCount(0)
    const bounds = (await preview.boundingBox())!
    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize()!.width)
    await expect(page.getByTestId("camera-viewport")).toHaveText(viewport!)
    await preview.getByRole("button", { name: "Edit", exact: true }).click()
    await expect(page.getByTestId("camera-mode")).toHaveText("details")
    await expect(preview).toHaveCount(0)
    await page.getByRole("button", { name: "Focus distant card", exact: true }).click()
    await preview.getByRole("button", { name: "Close preview", exact: true }).click()
    await expect(preview).toHaveCount(0)
    await expect(page.locator('.react-flow__node[data-id="00000000-0000-4000-8000-000000000002"]')).toBeFocused()
    await expect(page.getByTestId("camera-viewport")).toHaveText(viewport!)
  })
}


for (const reduced of [false, true]) {
  test(`in-place inspection keeps anchor and returns focus (${reduced ? "reduced" : "normal"})`, async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1000 })
    await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" })
    await page.getByRole("button", { name: "Show expansion fixture", exact: true }).click()
    const first = page.locator('.react-flow__node[data-id="00000000-0000-4000-9000-000000000001"]')
    const state = async () => JSON.parse((await page.getByTestId("inspection-state").textContent())!)
    await expect(first.getByRole("button", { name: "Open Inspection 1", exact: true })).toBeVisible()
    const before = (await first.boundingBox())!
    const original = await state()
    await first.locator("h3").click()
    expect((await state()).expanded).toBeNull()
    await first.focus()
    await page.keyboard.press("Enter")
    const close = first.getByRole("button", { name: "Collapse Inspection 1", exact: true })
    await expect(close).toBeFocused()
    await expect(first.getByText("Item 8", { exact: true })).toBeVisible()
    await expect.poll(async () => (await first.boundingBox())!.width).toBe(560)
    const after = (await first.boundingBox())!
    expect(after.x).toBeCloseTo(before.x, 1)
    expect(after.y).toBeCloseTo(before.y, 1)
    await expect(first.getByRole("checkbox").first()).toBeDisabled()
    expect((await state()).writes).toBe(0)
    expect((await state()).viewport).toEqual(original.viewport)
    expect((await state()).positions).toEqual(original.positions)
    await page.keyboard.press("Escape")
    await expect(first).toBeFocused()
    await expect.poll(async () => (await first.boundingBox())!.width).toBe(before.width)
    await first.getByRole("button", { name: "Open Inspection 1", exact: true }).click()
    await page.getByRole("button", { name: "Open Inspection 2", exact: true }).click()
    await expect(page.locator('[data-particle-expanded="true"]')).toHaveCount(1)
    await expect(first.getByRole("button", { name: "Open Inspection 1", exact: true })).toBeVisible()
    await page.getByRole("button", { name: "Collapse Inspection 2", exact: true }).click()
    await first.getByRole("button", { name: "Open Inspection 1", exact: true }).click()
    await first.getByRole("button", { name: "Edit", exact: true }).click()
    await expect(page.getByRole("region", { name: "Source editor" })).toBeVisible()
    await expect(page.locator('[data-particle-expanded="true"]')).toHaveCount(0)
    await page.getByRole("button", { name: "Close editor", exact: true }).click()
    await first.getByRole("button", { name: "Open Inspection 1", exact: true }).click()
    await page.getByRole("button", { name: "Collaborator moves card", exact: true }).click()
    await expect(page.locator('[data-particle-expanded="true"]')).toHaveCount(0)
    await expect.poll(async () => (await state()).positions[0]).toEqual({ x: 100, y: 220 })
    expect((await state()).writes).toBe(0)
  })
}

test("in-place inspection falls back on mobile and protects dirty editors", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole("button", { name: "Show expansion fixture", exact: true }).click()
  await page.getByRole("button", { name: "Open Inspection 1", exact: true }).click()
  const preview = page.getByRole("region", { name: "Inspection 1 preview" })
  await expect(preview).toBeFocused()
  await expect(preview.getByText("Item 8", { exact: true })).toBeVisible()
  await expect(page.locator('[data-particle-expanded="true"]')).toHaveCount(0)
  await page.getByRole("button", { name: "Close preview", exact: true }).click()
  await page.setViewportSize({ width: 1400, height: 1000 })
  await page.getByRole("button", { name: "Open dirty editor", exact: true }).click()
  page.once("dialog", dialog => dialog.dismiss())
  await page.getByRole("button", { name: "Open Inspection 2", exact: true }).click()
  await expect(page.getByRole("region", { name: "Source editor" })).toBeVisible()
  await expect(page.locator('[data-particle-expanded="true"]')).toHaveCount(0)
  expect(JSON.parse((await page.getByTestId("inspection-state").textContent())!).writes).toBe(0)
})


for (const change of ["overlay", "moving overlay", "viewport", "resize"] as const) {
  test(`open inspection adapts to ${change}`, async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1000 })
    await page.getByRole("button", { name: "Show expansion fixture", exact: true }).click()
    const node = page.locator('.react-flow__node[data-id="00000000-0000-4000-9000-000000000001"]')
    await node.getByRole("button", { name: "Open Inspection 1", exact: true }).click()
    await expect(node.getByRole("button", { name: "Collapse Inspection 1", exact: true })).toBeFocused()
    await expect.poll(async () => (await node.boundingBox())!.width).toBe(560)
    if (change === "overlay") await page.getByRole("button", { name: "Toggle overlay", exact: true }).click()
    else if (change === "moving overlay") await page.getByRole("button", { name: "Move overlay", exact: true }).click()
    else if (change === "viewport") await page.getByRole("button", { name: "Pan canvas", exact: true }).click()
    else await page.setViewportSize({ width: 620, height: 1000 })
    await expect(page.getByRole("region", { name: "Inspection 1 preview" })).toBeFocused()
    await expect(page.locator('[data-particle-expanded="true"]')).toHaveCount(0)
    const state = JSON.parse((await page.getByTestId("inspection-state").textContent())!)
    expect(state.writes).toBe(0)
    expect(state.positions).toEqual([{ x: 60, y: 200 }, { x: 740, y: 200 }])
    if (change !== "viewport") expect(state.viewport).toEqual({ x: 0, y: 0, zoom: 1 })
    if (change === "overlay") {
      await page.getByRole("button", { name: "Close preview", exact: true }).click()
      await page.getByRole("button", { name: "Toggle overlay", exact: true }).click()
      await expect(page.locator('[data-particle-expanded="true"]')).toHaveCount(0)
      await node.getByRole("button", { name: "Open Inspection 1", exact: true }).click()
      await expect(node.getByRole("button", { name: "Collapse Inspection 1", exact: true })).toBeFocused()
    }
  })
}

for (const reduced of [false, true]) {
  test(`inspection size motion respects ${reduced ? "reduced" : "normal"} preference`, async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1000 })
    await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" })
    await page.getByRole("button", { name: "Show expansion fixture", exact: true }).click()
    const node = page.locator('.react-flow__node[data-id="00000000-0000-4000-9000-000000000001"]')
    await expect(node).toBeVisible()
    await page.evaluate(() => {
      const samples: number[] = []
      Object.assign(window, { inspectionWidths: samples })
      const start = performance.now()
      const sample = () => {
        samples.push(document.querySelector('.react-flow__node[data-id="00000000-0000-4000-9000-000000000001"]')!.getBoundingClientRect().width)
        if (performance.now() - start < 1500) requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    })
    await node.getByRole("button", { name: "Open Inspection 1", exact: true }).click()
    await expect.poll(async () => (await node.boundingBox())!.width).toBe(560)
    const animation = await node.locator("[data-particle-frame] > .nowheel").evaluate(element => getComputedStyle(element).animationName)
    if (reduced) expect(animation).toBe("none")
    else expect(animation).toContain("inspection-reveal")
    const samples = await page.evaluate(() => (window as unknown as { inspectionWidths: number[] }).inspectionWidths)
    expect(samples.some(width => width > 401 && width < 559)).toBe(!reduced)
    await node.getByRole("button", { name: "Collapse Inspection 1", exact: true }).click()
    await expect.poll(async () => (await node.boundingBox())!.width).toBe(400)
    expect(JSON.parse((await page.getByTestId("inspection-state").textContent())!).writes).toBe(0)
  })
}


test("responsibility edits save, reload and preserve drafts on failure", async ({ page }) => {
  await page.getByRole("button", { name: "Show responsibility fixture" }).click()
  await page.getByRole("button", { name: "Assign owner", exact: true }).click()
  await expect(page.getByRole("combobox", { name: "Search people" })).toBeFocused()
  await page.keyboard.type("Alex")
  await expect(page.getByRole("option", { name: "Sam Chen", exact: true })).toHaveCount(0)
  await page.getByRole("option", { name: "Alex Rivera", exact: true }).click()
  await page.getByRole("button", { name: "Add or remove contributors" }).click()
  await page.getByRole("option", { name: "Sam Chen", exact: true }).click()
  await expect(page.getByRole("list", { name: "Assigned contributors" })).toContainText("Sam Chen")
  await page.getByRole("button", { name: "Save changes", exact: true }).click()
  await expect(page.getByTestId("responsibility-state")).toContainText('"dirty":false')
  await page.reload()
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ type: "module", content: script })
  await page.getByRole("button", { name: "Show responsibility fixture" }).click()
  await expect(page.getByRole("button", { name: "Alex Rivera", exact: true })).toBeVisible()
  await expect(page.getByRole("list", { name: "Assigned contributors" })).toContainText("Sam Chen")
  await page.getByRole("button", { name: "Alex Rivera", exact: true }).click()
  await page.getByRole("option", { name: "Sam Chen", exact: true }).click()
  await expect(page.getByRole("list", { name: "Assigned contributors" })).toHaveCount(0)
  await page.getByRole("button", { name: "Toggle connection failure" }).click()
  await page.getByRole("button", { name: "Save changes", exact: true }).click()
  await expect(page.getByText("Changes could not be saved. Your draft is still here.", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Sam Chen", exact: true })).toBeVisible()
  await expect(page.getByTestId("responsibility-state")).toContainText('"dirty":true')
  await page.getByRole("button", { name: "Toggle connection failure" }).click()
  await page.getByRole("button", { name: "Retry save", exact: true }).click()
  await expect(page.getByTestId("responsibility-state")).toContainText('000000000702')
})


test("membership responsibility saves only one plan and retains failed drafts", async ({ page }) => {
  await page.evaluate(() => { localStorage.setItem("membership-fixture", "true"); localStorage.setItem("objective-fixture-count", "1") })
  const reload = async () => { await page.reload(); await page.addStyleTag({ content: css }); await page.addScriptTag({ type: "module", content: script }) }
  await reload()
  await page.getByRole("button", { name: "Objectives", exact: true }).click()
  await page.getByRole("button", { name: /^Community workshop (Not started|0% work)$/, exact: true }).click()
  const trigger = () => page.getByRole("button", { name: "Responsibility for Confirm the venue and accessibility requirements in Workshop preparation", exact: true })
  const other = () => page.getByRole("button", { name: "Responsibility for Confirm the venue and accessibility requirements in Another plan", exact: true })
  await trigger().click()
  await page.getByRole("button", { name: "Assign owner", exact: true }).click()
  await page.getByRole("option", { name: "Alex Rivera", exact: true }).click()
  await page.getByRole("button", { name: "Add or remove contributors", exact: true }).click()
  await page.getByRole("option", { name: "Sam Chen", exact: true }).click()
  await page.evaluate(() => localStorage.setItem("membership-save-failure", "true"))
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await expect(page.getByRole("alert")).toHaveText("Not saved. Your draft is kept.")
  await expect(page.getByRole("button", { name: "Alex Rivera", exact: true })).toBeVisible()
  await page.evaluate(() => localStorage.removeItem("membership-save-failure"))
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await expect(trigger()).toContainText("Alex Rivera")
  await expect(other()).toContainText("Assign")
  await reload()
  await page.getByRole("button", { name: "Objectives", exact: true }).click()
  await page.getByRole("button", { name: /^Community workshop (Not started|0% work)$/, exact: true }).click()
  await expect(trigger()).toContainText("Alex Rivera")
  await expect(other()).toContainText("Assign")
  await trigger().click()
  await page.getByRole("button", { name: "Alex Rivera", exact: true }).click()
  await page.getByRole("option", { name: "Sam Chen", exact: true }).click()
  await expect(page.getByRole("list", { name: "Assigned contributors" })).toHaveCount(0)
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await expect(trigger()).toContainText("Sam Chen")
  await expect(other()).toContainText("Assign")
})


test("objective assignment rail saves outside the shell and preserves failed drafts", async ({ page }) => {
  await page.getByRole("button", { name: "Show responsibility fixture" }).click()
  await page.getByRole("button", { name: "Show assignment canvas" }).click()
  const rail = page.locator("[data-particle-assignment-rail]")
  const node = page.locator(".react-flow__node").first()
  const shell = node.locator("[data-particle-frame]")
  await expect(rail).toBeVisible()
  const bounds = (await node.boundingBox())!, card = (await shell.boundingBox())!, hit = (await rail.boundingBox())!
  expect(bounds.height - card.height).toBeCloseTo(52, 0)
  expect(hit.y).toBeCloseTo(card.y + card.height, 0)
  expect(hit.y + hit.height).toBeLessThanOrEqual(bounds.y + bounds.height + 1)
  await rail.getByRole("button", { name: "Responsibility for Workshop", exact: true }).focus()
  await page.keyboard.press("Enter")
  await page.getByRole("button", { name: "Assign owner", exact: true }).click()
  await page.getByRole("option", { name: "Alex Rivera" }).click()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await expect(rail).toContainText("Alex Rivera")
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("responsibility-graph") ?? "null")?.particles[0].responsibility?.ownerId)).toBe("00000000-0000-4000-8000-000000000701")
  await page.getByRole("button", { name: "Toggle connection failure" }).click()
  await rail.getByRole("button").click()
  await page.getByRole("button", { name: "Alex Rivera", exact: true }).click()
  await page.getByRole("option", { name: "Sam Chen" }).click()
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await expect(page.getByRole("alert")).toContainText("Your draft is kept")
  await expect(page.getByRole("button", { name: "Sam Chen", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Discard", exact: true }).click()
  await page.getByRole("button", { name: "Toggle connection failure" }).click()
  await page.getByRole("button", { name: "Retry save", exact: true }).click()
  await expect(rail).toContainText("Sam Chen")
  await rail.getByRole("button").click()
  await page.getByRole("button", { name: "Add or remove contributors", exact: true }).click()
  await page.getByRole("option", { name: "Alex Rivera" }).click()
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await expect(rail.getByLabel("Contributor: Alex Rivera")).toBeVisible()
  await page.getByRole("button", { name: "Remove available people" }).click()
  await expect(rail).toContainText("Unavailable person")
  expect((await node.boundingBox())!.x).toBeCloseTo(bounds.x, 0)
  expect((await node.boundingBox())!.y).toBeCloseTo(bounds.y, 0)
})


test.describe("touch assignment rail", () => {
  test.use({ hasTouch: true, viewport: { width: 600, height: 900 } })
  test("keeps the full touch target inside measured bounds", async ({ page }) => {
    await page.getByRole("button", { name: "Show responsibility fixture" }).click()
    await page.getByRole("button", { name: "Show assignment canvas" }).click()
    const rail = page.locator("[data-particle-assignment-rail]")
    const trigger = rail.getByRole("button")
    await expect(trigger).toBeVisible()
    const target = (await trigger.boundingBox())!, box = (await page.locator(".react-flow__node").first().boundingBox())!
    expect(target.height).toBeGreaterThanOrEqual(44)
    expect(target.y + target.height).toBeLessThanOrEqual(box.y + box.height + 1)
    await trigger.tap()
    await page.getByRole("button", { name: "Assign owner", exact: true }).tap()
    await page.getByRole("option", { name: "Alex Rivera" }).tap()
    await page.getByRole("button", { name: "Save", exact: true }).tap()
    await expect(rail).toContainText("Alex Rivera")
  })
})

test("shared assignment rail selects an explicit context, isolates writes and reloads", async ({ page }) => {
  await page.evaluate(() => localStorage.setItem("assignment-membership-fixture", "true"))
  await page.getByRole("button", { name: "Show responsibility fixture" }).click()
  await page.getByRole("button", { name: "Show assignment canvas" }).click()
  const rail = page.locator("[data-particle-assignment-rail]")
  await expect(rail).toContainText("Choose plan")
  await rail.getByRole("button").click()
  await expect(page.getByRole("button", { name: "Assign owner", exact: true })).toHaveCount(0)
  await page.getByRole("combobox", { name: "Plan context" }).selectOption({ label: "Workshop / Preparation" })
  await page.getByRole("button", { name: "Assign owner", exact: true }).click()
  await page.getByRole("option", { name: "Alex Rivera" }).click()
  await expect(page.getByRole("combobox", { name: "Plan context" })).toBeDisabled()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await expect(rail).toContainText("Alex Rivera")
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("responsibility-graph")!))
  expect(saved.particles[0].responsibility).toBeUndefined()
  expect(saved.particles[1].data.planning.plans[0].assignments[0].responsibility.ownerId).toBe("00000000-0000-4000-8000-000000000701")
  expect(saved.particles[1].data.planning.proposals[0].assignments).toBeUndefined()
  expect(saved.particles[2].data.planning.plans[0].assignments).toBeUndefined()
  await page.reload(); await page.addStyleTag({ content: css }); await page.addScriptTag({ type: "module", content: script })
  await page.getByRole("button", { name: "Show responsibility fixture" }).click()
  await page.getByRole("button", { name: "Show assignment canvas" }).click()
  await rail.getByRole("button").click()
  await page.getByRole("combobox", { name: "Plan context" }).selectOption({ label: "Workshop / Preparation" })
  await expect(page.getByRole("button", { name: "Alex Rivera", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Close", exact: true }).click()
  await page.getByRole("button", { name: "Walk alternative" }).click()
  await expect(rail).toContainText("Workshop / Alternative · Proposed")
  await expect(rail).not.toContainText("Alex Rivera")
})

test("shared assignment rail protects drafts and applies proposal-author permissions", async ({ page }) => {
  await page.evaluate(() => localStorage.setItem("assignment-membership-fixture", "true"))
  await page.getByRole("button", { name: "Show responsibility fixture" }).click()
  await page.getByRole("button", { name: "Show assignment canvas" }).click()
  await page.getByRole("button", { name: "Toggle organization owner" }).click()
  const rail = page.locator("[data-particle-assignment-rail]")
  await rail.getByRole("button").click()
  await page.getByRole("combobox", { name: "Plan context" }).selectOption({ label: "Workshop / Preparation" })
  await expect(page.getByRole("button", { name: "Assign owner", exact: true })).toBeDisabled()
  await page.getByRole("combobox", { name: "Plan context" }).selectOption({ label: "Workshop / Alternative · Proposed" })
  await page.getByRole("button", { name: "Assign owner", exact: true }).click()
  await page.getByRole("option", { name: "Sam Chen" }).click()
  await page.getByRole("button", { name: "Simulate plan change" }).click()
  await expect(page.getByRole("status").filter({ hasText: "Plan changed." })).toContainText("Plan changed. Your draft is kept.")
  await expect(page.getByRole("button", { name: "Sam Chen", exact: true })).toBeDisabled()
  await page.getByRole("button", { name: "Load latest" }).click()
  await page.getByRole("button", { name: "Assign owner", exact: true }).click()
  await page.getByRole("option", { name: "Sam Chen" }).click()
  await page.getByRole("button", { name: "Toggle connection failure" }).click()
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await expect(page.getByRole("alert")).toContainText("Your draft is kept")
  await page.getByRole("button", { name: "Toggle connection failure" }).click()
  await page.getByRole("button", { name: "Retry save", exact: true }).click()
  await expect(rail).toContainText("Sam Chen")
  await page.getByRole("button", { name: "Load latest" }).click()
  await page.getByRole("button", { name: "Add or remove contributors" }).click()
  await page.getByRole("option", { name: "Alex Rivera" }).click()
  await page.getByRole("button", { name: "Remove plan memberships" }).click()
  await expect(page.getByRole("status").filter({ hasText: "Plan no longer available." })).toContainText("Plan no longer available. Your draft is kept.")
  await expect(page.getByRole("button", { name: "Save", exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "Discard", exact: true }).click()
  await expect(rail).toHaveCount(0)
})


test("progress modes save, reload and render separate work and time without completing the objective", async ({ page }) => {
  await page.evaluate(() => localStorage.setItem("progress-fixture", "true"))
  await page.getByRole("button", { name: "Show responsibility fixture" }).click()
  await page.getByRole("combobox", { name: "Measure progress" }).selectOption({ label: "Work and time" })
  await page.getByLabel("Start", { exact: true }).fill("2026-01-01T09:00")
  await page.getByLabel("End", { exact: true }).fill("2026-01-02T09:00")
  await page.getByRole("button", { name: "Save changes", exact: true }).click()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("responsibility-graph") ?? "null")?.particles[0].data.progress?.mode)).toBe("both")
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("responsibility-graph")!))
  expect(saved.particles[0].status).toBe("backlog")
  expect(saved.particles[0].data.progress.startsAt).toMatch(/Z$/)
  await page.getByRole("button", { name: "Show assignment canvas" }).click()
  await expect(page.getByLabel("Objective progress")).toContainText("2 of 4 required work complete")
  await expect(page.getByLabel("Objective progress")).toContainText("Period ended")
  await expect(page.getByRole("progressbar", { name: "2 of 4 required work complete", exact: true })).toHaveAttribute("aria-valuenow", "50")
  await page.reload()
  await page.addStyleTag({ content: css }); await page.addScriptTag({ type: "module", content: script })
  await page.getByRole("button", { name: "Show responsibility fixture" }).click()
  await expect(page.getByRole("combobox", { name: "Measure progress" })).toHaveValue("both")
  await page.getByRole("combobox", { name: "Measure progress" }).selectOption({ label: "Ongoing" })
  await page.getByRole("button", { name: "Save changes", exact: true }).click()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("responsibility-graph") ?? "null")?.particles[0].data.progress?.mode)).toBe("ongoing")
  await page.getByRole("button", { name: "Show assignment canvas" }).click()
  await expect(page.getByLabel("Objective progress")).toContainText("Ongoing")
  await expect(page.getByLabel("Objective progress").getByRole("progressbar")).toHaveCount(0)
})

test("progress mode edits preserve failed drafts and disable non-owner controls", async ({ page }) => {
  await page.evaluate(() => localStorage.setItem("progress-fixture", "true"))
  await page.getByRole("button", { name: "Show responsibility fixture" }).click()
  await page.getByRole("button", { name: "Toggle organization owner" }).click()
  await expect(page.getByRole("combobox", { name: "Measure progress" })).toBeDisabled()
  await page.getByRole("button", { name: "Toggle organization owner" }).click()
  await page.getByRole("combobox", { name: "Measure progress" }).selectOption({ label: "Ongoing" })
  await page.getByRole("button", { name: "Toggle connection failure" }).click()
  await page.getByRole("button", { name: "Save changes", exact: true }).click()
  await expect(page.getByTestId("responsibility-state")).toContainText('"dirty":true')
  await expect(page.getByRole("combobox", { name: "Measure progress" })).toHaveValue("ongoing")
  expect(await page.evaluate(() => localStorage.getItem("responsibility-graph"))).toBeNull()
  await page.getByRole("button", { name: "Toggle connection failure" }).click()
  await page.getByRole("button", { name: "Retry save", exact: true }).click()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("responsibility-graph") ?? "null")?.particles[0].data.progress?.mode)).toBe("ongoing")
})


test("required work progress updates from completion and optional scope edits without completing the objective", async ({ page }) => {
  await page.evaluate(() => localStorage.setItem("membership-fixture", "true"))
  const first = page.getByRole("button", { name: "Options for Confirm the venue and accessibility requirements", exact: true })
  await first.click()
  await page.getByRole("menuitem", { name: "Status", exact: true }).hover()
  await page.getByRole("menuitemradio", { name: "Done", exact: true }).click()
  await expect(page.getByText("1 of 2 required work complete · 50%", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Options for Invite community partners", exact: true }).click()
  await page.getByRole("menuitemcheckbox", { name: "Required work", exact: true }).click()
  await expect(page.getByText("1 of 1 required work complete · 100%", { exact: true })).toBeVisible()
  await expect(page.getByRole("list", { name: "Workshop preparation particles" })).toContainText("Optional")
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("membership-graph")!))
  const objective = saved.particles.find((item: { title: string }) => item.title === "Community workshop")
  expect(objective.status).toBe("backlog")
  expect(objective.data.planning.plans[0].optionalParticleIds).toEqual(["00000000-0000-4000-8000-000000000004"])
})


test.describe("near-cap actual source editor", () => {
  test.use({ hasTouch: true })
  for (const mobile of [false, true]) {
    test(`250 records retain draft, conflict and failed-save recovery (${mobile ? "touch reduced motion" : "keyboard"})`, async ({ page }) => {
      const state = page.getByTestId("inspection-state")
      await expect(state).toContainText('"count":250')
      const open = page.getByRole("button", { name: "Open dirty editor", exact: true })
      if (mobile) await open.tap(); else { await open.focus(); await page.keyboard.press("Enter") }
      const title = page.getByRole("textbox", { name: "Title", exact: true })
      await title.fill("Draft that must survive")
      await title.evaluate((el: HTMLInputElement) => el.setSelectionRange(6, 10))
      // Deliver a newer collaborator snapshot without taking focus from typing.
      await page.getByRole("button", { name: "Collaborator moves card" }).evaluate((el: HTMLButtonElement) => el.click())
      await expect(page.getByText("This Particle changed. Copy your draft or load the latest details.")).toBeVisible()
      await expect(title).toHaveValue("Draft that must survive")
      await expect(title).toBeFocused()
      expect(await title.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd])).toEqual([6, 10])
      expect(JSON.parse((await state.textContent())!).positions[0]).toEqual({ x: 100, y: 220 })
      expect(JSON.parse((await state.textContent())!).writes).toBe(0)
      page.once("dialog", dialog => dialog.dismiss())
      await page.keyboard.press("Escape")
      await expect(title).toHaveValue("Draft that must survive")
      await page.getByRole("button", { name: "Load latest", exact: true }).click()
      await title.fill("Recovered near-cap edit")
      await page.evaluate(() => localStorage.setItem("fixture-near-cap-save-failure", "1"))
      await page.getByRole("button", { name: "Save changes", exact: true }).click()
      await expect(page.getByText("Changes could not be saved. Your draft is still here.")).toBeVisible()
      await expect(title).toHaveValue("Recovered near-cap edit")
      await page.evaluate(() => localStorage.removeItem("fixture-near-cap-save-failure"))
      await page.getByRole("button", { name: "Save changes", exact: true }).click()
      await expect(state).toContainText('"title":"Recovered near-cap edit"')
      expect(JSON.parse((await state.textContent())!).positions[0]).toEqual({ x: 100, y: 220 })
      await page.reload()
      await page.addStyleTag({ content: css })
      await page.addScriptTag({ type: "module", content: script })
      await expect(page.getByTestId("inspection-state")).toContainText('"title":"Recovered near-cap edit"')
      await expect(page.getByTestId("inspection-state")).toContainText('"count":250')
    })
  }
})
