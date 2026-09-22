import { expect, test, type Page } from "@playwright/test"
import { prepareVisualPage, reviewedPlatformScreenshotName } from "./reviewed-platform-screenshot"

test.beforeEach(async ({ page }) => {
  await prepareVisualPage(page)
})

async function closeEditor(page: Page) {
  await page
    .locator("[data-canvas-editor]")
    .getByRole("button", { name: "Collapse step", exact: true })
    .click()
  await expect(page.locator("[data-canvas-editor]")).toHaveCount(0)
}

test("decision nodes support keyboard, zoom, review persistence, and branch revision", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto("/documentation/tools/social-media#sandbox")
  await page.getByRole("button", { name: "Load example", exact: true }).click()
  const canvas = page.getByRole("region", { name: "Decision canvas" })
  await expect(
    page
      .locator("[data-decision-footer]")
      .getByRole("group", { name: "Canvas controls" })
  ).toBeVisible()
  await expect(canvas.locator(".react-flow__node")).toHaveCount(5)
  await expect(canvas.locator(".react-flow__edge")).toHaveCount(5)
  const viewport = canvas.locator(".react-flow__viewport")
  await expect(viewport).toBeVisible()
  const beforeZoom = await viewport.getAttribute("style")
  await page.getByRole("button", { name: "Zoom in", exact: true }).click()
  await expect(viewport).not.toHaveAttribute("style", beforeZoom!)
  await page.getByRole("button", { name: "Fit all steps", exact: true }).click()
  const start = page.getByRole("button", {
    name: "Start planning",
    exact: true,
  })
  await start.press("Enter")
  await expect(page.locator("[data-canvas-editor]")).toBeVisible()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.locator("[data-canvas-editor]")).toHaveCSS(
    "transform",
    "none"
  )
  expect(
    await page
      .locator("[data-canvas-editor]")
      .evaluate((el) => el.closest("[data-decision-viewport]") !== null)
  ).toBe(true)
  await page.keyboard.press("Escape")
  await expect(start).toBeFocused()
  await page
    .getByRole("button", { name: "Open Audience & purpose", exact: true })
    .click()
  for (const title of [
    "Audience & purpose",
    "Message & content",
    "Channels & cadence",
    "Ownership & safeguards",
  ]) {
    await expect(
      page
        .locator("[data-canvas-editor]")
        .getByRole("heading", { name: title, exact: true })
    ).toBeVisible()
    await page
      .getByRole("button", { name: "Reviewed & continue", exact: true })
      .click()
  }
  await page.getByRole("button", { name: "Finish review", exact: true }).click()
  await expect(canvas.getByRole("status")).toContainText("5/5")
  await page.reload()
  await expect(canvas.getByRole("status")).toContainText("5/5")
  await page
    .getByRole("button", { name: "Open Message & content", exact: true })
    .click()
  await page
    .getByLabel("Main message", { exact: true })
    .fill("An updated, sourced message.")
  await closeEditor(page)
  await expect(canvas.getByRole("status")).toContainText("2/5")
  await expect(
    page.getByRole("button", { name: "Open Channels & cadence", exact: true })
  ).toContainText("Reviewed")
  await page.reload()
  await expect(canvas.getByRole("status")).toContainText("2/5")
  await page.getByRole("button", { name: "List view", exact: true }).click()
  await expect(
    page.getByRole("list", { name: "Planner steps" }).getByRole("button")
  ).toHaveCount(5)
  page.once("dialog", (dialog) => dialog.accept())
  await page.getByRole("button", { name: "Reset", exact: true }).click()
  await expect(canvas.getByRole("status")).toContainText("0/5")
  expect(errors).toEqual([])
})

for (const width of [1440, 390]) {
  for (const theme of ["light", "dark"] as const) {
    test(`decision canvas and focused editor at ${width} in ${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 })
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" })
      await page.addInitScript(
        (mode) => localStorage.setItem("theme", mode),
        theme
      )
      await page.goto("/documentation/tools/social-media#sandbox")
      await page
        .getByRole("button", { name: "Load example", exact: true })
        .click()
      const canvas = page.getByRole("region", { name: "Decision canvas" })
      await canvas.scrollIntoViewIfNeeded()
      await expect(
        page.getByRole("button", {
          name: "Open Audience & purpose",
          exact: true,
        })
      ).toBeInViewport()
      await page.addStyleTag({
        content: "nextjs-portal { visibility: hidden !important; }",
      })
      await page.mouse.move(0, 0)
      await expect.soft(canvas).toHaveScreenshot(
        reviewedPlatformScreenshotName(`decision-canvas-${width}-${theme}.png`),
        { animations: "disabled" }
      )
      await page
        .getByRole("button", { name: "Start planning", exact: true })
        .click()
      const editor = page.locator("[data-canvas-editor]")
      await expect(
        page.getByLabel("Organization name", { exact: true })
      ).toHaveValue("Willow Street Family Resource Network")
      await expect(editor).toHaveCSS("transform", "none")
      await expect(page.getByRole("dialog")).toHaveCount(0)
      const frame = await page.locator("[data-decision-viewport]").boundingBox()
      const bounds = await editor.boundingBox()
      expect(Math.abs(bounds!.width - frame!.width)).toBeLessThan(3)
      expect(Math.abs(bounds!.height - frame!.height)).toBeLessThan(3)
      expect(bounds!.x).toBeGreaterThanOrEqual(frame!.x)
      expect(bounds!.y).toBeGreaterThanOrEqual(frame!.y)
      expect(
        await editor.evaluate((el) => el.scrollWidth <= el.clientWidth)
      ).toBe(true)
      await page.mouse.move(0, 0)
      await expect.soft(canvas).toHaveScreenshot(
        reviewedPlatformScreenshotName(`decision-editor-${width}-${theme}.png`),
        { animations: "disabled" }
      )
      await closeEditor(page)
      await page.getByRole("button", { name: "List view", exact: true }).click()
      await page
        .getByRole("list", { name: "Planner steps" })
        .getByRole("button")
        .last()
        .click()
      await expect(
        page.getByRole("button", { name: /Download.*CSV/ }).first()
      ).toBeVisible()
    })
  }
}

test("small mobile editors stay inside the canvas and keep footer navigation usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/documentation/tools/social-media#sandbox")
  await page.getByRole("button", { name: "Load example", exact: true }).click()
  const footer = page.locator("[data-decision-footer]")
  await expect(
    footer.getByRole("group", { name: "Canvas controls" })
  ).toBeVisible()
  for (const label of ["Zoom in", "Zoom out", "Fit all steps"]) {
    const button = footer.getByRole("button", { name: label, exact: true })
    const bounds = await button.boundingBox()
    expect(bounds!.width).toBeGreaterThanOrEqual(44)
    expect(bounds!.height).toBeGreaterThanOrEqual(44)
    await button.click()
  }
  await footer.getByRole("button", { name: "List view", exact: true }).click()
  await page
    .getByRole("list", { name: "Planner steps" })
    .getByRole("button")
    .first()
    .click()
  const editor = page.locator("[data-canvas-editor]")
  await expect(editor).toHaveCSS("transform", "none")
  await expect(page.getByRole("dialog")).toHaveCount(0)
  const before = await page.locator("[data-decision-viewport]").boundingBox()
  const box = await editor.boundingBox()
  expect(Math.abs(box!.width - before!.width)).toBeLessThan(3)
  expect(Math.abs(box!.height - before!.height)).toBeLessThan(3)
  const name = page.getByLabel("Organization name", { exact: true })
  await name.fill("Mobile canvas draft")
  expect(
    await name.evaluate((el) =>
      Number.parseFloat(getComputedStyle(el).fontSize)
    )
  ).toBeGreaterThanOrEqual(16)
  await page
    .getByRole("combobox", { name: "Organization stage", exact: true })
    .click()
  await page.keyboard.press("Escape")
  await expect(editor).toBeVisible()
  await expect(page.getByRole("listbox")).toHaveCount(0)
  const destination = page.getByLabel("Destination URL", { exact: true })
  await destination.fill("https://example.org/mobile")
  expect(
    await page.locator("[data-planner-editor]").evaluate((el) => el.scrollTop)
  ).toBeGreaterThan(0)
  await footer
    .getByRole("button", { name: "Reviewed & continue", exact: true })
    .click()
  await expect(
    editor.getByRole("heading", { name: "Message & content", exact: true })
  ).toBeVisible()
  expect(
    await page.locator("[data-planner-editor]").evaluate((el) => el.scrollTop)
  ).toBe(0)
  await footer.getByRole("button", { name: "Back", exact: true }).click()
  await expect(name).toHaveValue("Mobile canvas draft")
  await page.setViewportSize({ width: 568, height: 320 })
  await expect(editor).toHaveCSS("transform", "none")
  expect(await editor.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true
  )
  await closeEditor(page)
  await expect(
    page
      .getByRole("list", { name: "Planner steps" })
      .getByRole("button")
      .first()
  ).toBeFocused()
  expect(
    await page
      .locator("[data-documentation-scroll]")
      .evaluate((el) => el.scrollWidth <= el.clientWidth)
  ).toBe(true)
})
