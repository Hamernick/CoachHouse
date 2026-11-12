import { test, expect, type Page } from "@playwright/test"
import { edgeTarget, buttonRect, overlaps, home, type Point } from "./geometry"
const inputName = "Plan an objective or search Particles"
async function boot(page: Page) {
  const errors: string[] = []
  page.on("pageerror", error => errors.push(error.message))
  await page.goto("/")
  await expect(page.getByRole("textbox", { name: inputName })).toBeVisible()
  return errors
}
async function assertClear(page: Page) {
  const button = await page.getByTestId("return-indicator").boundingBox()
  expect(button).not.toBeNull()
  const size = page.viewportSize()!
  expect(button!.x).toBeGreaterThanOrEqual(9)
  expect(button!.y).toBeGreaterThanOrEqual(9)
  expect(button!.x + button!.width).toBeLessThanOrEqual(size.width - 9)
  expect(button!.y + button!.height).toBeLessThanOrEqual(size.height - 9)
  for (const overlay of await page.locator("[data-prototype-obstacle]").all()) {
    expect(overlaps(button!, (await overlay.boundingBox())!, 8)).toBe(false)
  }
}
test("geometry remains collision free around every edge, corner and crowded perimeter", () => {
  for (const size of [{ x: 1280, y: 900 }, { x: 390, y: 844 }]) {
    const obstacles = [{ x: 12, y: 12, width: 208, height: 260 }, { x: 12, y: size.y - 72, width: 240, height: 60 }, { x: size.x - 160, y: 12, width: 148, height: 48 }]
    let previous: Point | null = null
    for (let i = 0; i < 360; i++) {
      const angle = i * Math.PI / 180
      const point: Point = edgeTarget({ x: size.x / 2 + Math.cos(angle) * 3000, y: size.y / 2 + Math.sin(angle) * 3000 }, size, obstacles, previous)!
      expect(point).not.toBeNull()
      for (const rect of obstacles) expect(overlaps(buttonRect(point), rect, 9)).toBe(false)
      previous = point
    }
  }
})
test("intro matches reference, suggestions populate and dismiss, hover preview stays readable", async ({ page }) => {
  const errors = await boot(page)
  await expect(page.getByRole("heading", { name: "Hey, Caleb. Ready to dive in?" })).toBeVisible()
  await page.getByRole("button", { name: "Turn an idea into a plan", exact: true }).hover()
  await expect(page.getByText("Build a clear objective with practical next steps.")).toBeVisible()
  await page.screenshot({ path: "docs/prototypes/canvas-chat/results/intro-preview.png" })
  await page.getByRole("button", { name: "Turn an idea into a plan", exact: true }).click()
  await expect(page.getByRole("textbox", { name: inputName })).toHaveText("Help us plan a community workshop")
  await page.getByRole("button", { name: "Dismiss Turn an idea into a plan" }).click()
  await expect(page.getByRole("button", { name: "Turn an idea into a plan", exact: true })).toHaveCount(0)
  expect(errors).toEqual([])
})
test("pan in every direction, avoid windows, retain draft and return to bottom", async ({ page }) => {
  const errors = await boot(page)
  const input = page.getByRole("textbox", { name: inputName })
  await input.fill("Keep my unfinished idea")
  await page.getByRole("button", { name: "Documents", exact: true }).click()
  for (const delta of [[3200,0],[-3200,0],[0,3200],[0,-3200],[2800,2800],[-2800,-2800],[2800,-2800],[-2800,2800]]) {
    await page.mouse.move(900, 190)
    await page.mouse.wheel(delta[0], delta[1])
    await expect(page.getByTestId("return-indicator")).toHaveAttribute("data-mode", "edge")
    await assertClear(page)
    await page.getByRole("button", { name: "Return to chat", exact: true }).click()
    await expect(page.getByTestId("return-indicator")).toHaveCount(0)
    await expect(input).toHaveText("Keep my unfinished idea")
    await expect(input).toBeFocused()
    const box = await page.locator(".composer-zone").boundingBox()
    expect(Math.abs(box!.y + box!.height - home({ x: 1280, y: 900 }).y)).toBeLessThan(2)
  }
  expect(errors).toEqual([])
})
test("generation offscreen, bounded thread and explicit idempotent add survive reload", async ({ page }) => {
  const errors = await boot(page)
  const input = page.getByRole("textbox", { name: inputName })
  await input.fill("Plan a community workshop")
  await input.press("Enter")
  await expect(page.locator("[data-returning=true]")).toHaveCount(0)
  await page.mouse.move(1000, 200); await page.mouse.wheel(3200, 100)
  await expect(page.getByTestId("return-indicator")).toHaveAttribute("data-mode", "edge")
  await expect(page.locator(".message.assistant")).toHaveCount(1)
  await page.getByRole("button", { name: "Return to chat", exact: true }).click()
  await page.getByRole("button", { name: "Add to canvas", exact: true }).dblclick()
  await expect(page.locator(".react-flow__node")).toHaveCount(1)
  await expect(page.getByRole("button", { name: "Added to canvas" })).toBeDisabled()
  for (let i=0;i<3;i++) { await input.fill(`Next step ${i}`); await input.press("Enter"); await expect(page.locator(".message.assistant")).toHaveCount(i+2) }
  expect(await page.getByRole("log").evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true)
  const box = await page.locator(".composer-zone").boundingBox()
  expect(Math.abs(box!.y + box!.height - 800)).toBeLessThan(2)
  await page.screenshot({ path: "docs/prototypes/canvas-chat/results/conversation.png" })
  await page.reload(); await expect(page.locator(".react-flow__node")).toHaveCount(1)
  expect(errors).toEqual([])
})
test("drag adds once, narrow viewport and reduced motion keep the indicator usable", async ({ page }) => {
  const errors = await boot(page)
  await page.getByRole("textbox", { name: inputName }).fill("Prepare a board meeting")
  await page.getByRole("textbox", { name: inputName }).press("Enter")
  const preview=page.locator(".message.assistant [data-preview-id]")
  await expect(preview).toBeVisible()
  await preview.dragTo(page.locator(".react-flow__pane"),{targetPosition:{x:950,y:200}})
  await expect(page.locator(".react-flow__node")).toHaveCount(1)
  await page.setViewportSize({width:390,height:844}); await page.emulateMedia({reducedMotion:"reduce"})
  await page.getByRole("button",{name:"Use dark mode"}).click()
  await page.getByRole("button",{name:"Return to chat",exact:true}).click()
  await page.mouse.move(380,400); await page.mouse.wheel(3200,2400)
  await expect(page.getByTestId("return-indicator")).toHaveAttribute("data-mode","edge")
  await assertClear(page)
  await page.screenshot({path:"docs/prototypes/canvas-chat/results/mobile-indicator.png"})
  await page.getByRole("button",{name:"Return to chat",exact:true}).click()
  await expect(page.getByTestId("return-indicator")).toHaveCount(0)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  expect(errors).toEqual([])
})
