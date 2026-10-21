import { prepareVisualPage } from "./reviewed-platform-screenshot"
import { expect, test, type Page } from "@playwright/test"
import { mockPublicResourceDirectory } from "./fixtures/public-resource-directory"

async function stabilizeForScreenshot(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
      }

      * {
        scrollbar-width: none !important;
      }

      *::-webkit-scrollbar {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
      }

      [data-testid="react-grab-overlay"] {
        display: none !important;
      }

      [data-home-canvas-hero-media],
      [data-home-canvas-hero-copy] > *,
      [data-home-canvas-reveal] {
        opacity: 1 !important;
        visibility: visible !important;
        transform: none !important;
      }

      [data-home-map-preview-map] {
        display: none !important;
      }

      [data-home-map-preview-fallback] {
        opacity: 1 !important;
        visibility: visible !important;
      }
    `,
  })

  await page.waitForTimeout(100)
}

async function waitForHomeCanvasHydration(page: Page) {
  await page.waitForFunction(() => {
    const panel = document.querySelector("[data-home-canvas-panel]")
    return Object.keys(panel ?? {}).some((key) =>
      key.startsWith("__reactProps$")
    )
  })
}

test("map-first public home", async ({ page }) => {
  await page.goto("/home-canvas")
  await page.waitForSelector("[data-public-home-hero]", { state: "visible" })
  await stabilizeForScreenshot(page)

  const hero = page.locator("[data-public-home-hero]")
  await expect(page.locator("[data-home-map-preview]")).toHaveAttribute(
    "data-home-map-controls-position",
    "bottom-right"
  )
  await expect(hero).toHaveScreenshot("public-home-map-hero.png", {
    animations: "disabled",
    caret: "hide",
    scale: "css",
    maxDiffPixelRatio: 0.02,
  })
})

test("public home keeps the app shell", async ({ page }) => {
  await page.goto("/home-canvas")
  await page.waitForSelector("[data-public-home-hero]", { state: "visible" })
  await stabilizeForScreenshot(page)

  await expect(page).toHaveScreenshot("public-home-shell.png", {
    animations: "disabled",
    caret: "hide",
    scale: "css",
    maxDiffPixelRatio: 0.02,
  })
})

test("public home canvas product navigator", async ({ page }) => {
  await page.goto("/home-canvas")
  await page.waitForSelector("[data-public-home-product-navigator]", {
    state: "visible",
  })
  await stabilizeForScreenshot(page)

  const navigator = page.locator("[data-public-home-product-navigator]")
  await expect(navigator.getByRole("button")).toHaveCount(2)
  await expect(navigator.getByRole("link", { name: "Find" })).toHaveAttribute(
    "aria-current",
    "true"
  )
  await expect(
    navigator.getByRole("button", { name: "Build" })
  ).toHaveAttribute("aria-pressed", "false")
  await expect(navigator.getByRole("button", { name: "Fund" })).toHaveAttribute(
    "aria-pressed",
    "false"
  )
})

test("public home mobile hero", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/home-canvas")
  await page.waitForSelector("[data-public-home-hero]", { state: "visible" })
  await page.waitForLoadState("networkidle")
  await stabilizeForScreenshot(page)

  const panel = page.locator('[data-home-canvas-panel="hero"]')
  const navigator = page.locator("[data-public-home-product-navigator]")
  const copy = page.locator("[data-home-canvas-hero-copy]")
  const navigatorBox = await navigator.boundingBox()
  const copyBox = await copy.boundingBox()
  expect(navigatorBox).not.toBeNull()
  expect(copyBox).not.toBeNull()
  expect(copyBox!.y).toBeGreaterThanOrEqual(
    navigatorBox!.y + navigatorBox!.height
  )
  expect(
    await panel.evaluate(
      (element) => element.scrollWidth <= element.clientWidth
    )
  ).toBe(true)
})

test("public home short mobile hero clears the product navigator", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/home-canvas")
  await stabilizeForScreenshot(page)

  const panel = page.locator('[data-home-canvas-panel="hero"]')
  const navigator = page.locator("[data-public-home-product-navigator]")
  const copy = page.locator("[data-home-canvas-hero-copy]")
  const navigatorBox = await navigator.boundingBox()
  const copyBox = await copy.boundingBox()
  expect(navigatorBox).not.toBeNull()
  expect(copyBox).not.toBeNull()
  expect(copyBox!.y).toBeGreaterThanOrEqual(
    navigatorBox!.y + navigatorBox!.height
  )
  expect(
    await panel.evaluate(
      (element) => element.scrollHeight > element.clientHeight
    )
  ).toBe(true)

  await panel.evaluate((element) =>
    element.scrollTo({ top: element.scrollHeight })
  )
  const panelBottomBox = await panel.boundingBox()
  const copyBottomBox = await copy.boundingBox()
  expect(panelBottomBox).not.toBeNull()
  expect(copyBottomBox).not.toBeNull()
  expect(copyBottomBox!.y + copyBottomBox!.height).toBeLessThanOrEqual(
    panelBottomBox!.y + panelBottomBox!.height + 1
  )
})

test("public home landscape hero remains reachable", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/home-canvas")

  const panel = page.locator('[data-home-canvas-panel="hero"]')
  await expect(panel).toBeVisible()
  await expect
    .poll(() =>
      panel.evaluate((element) => element.scrollHeight > element.clientHeight)
    )
    .toBe(true)

  await panel.evaluate((element) =>
    element.scrollTo({ top: element.scrollHeight })
  )
  const panelBox = await panel.boundingBox()
  const copyBox = await page
    .locator("[data-home-canvas-hero-copy]")
    .boundingBox()
  expect(panelBox).not.toBeNull()
  expect(copyBox).not.toBeNull()
  expect(copyBox!.y + copyBox!.height).toBeLessThanOrEqual(
    panelBox!.y + panelBox!.height + 1
  )
})

test("pricing is embedded in Build", async ({ page }) => {
  await page.goto("/home-canvas?section=platform")
  await page.waitForSelector("[data-public-home-build-pricing]", {
    state: "attached",
  })
  await waitForHomeCanvasHydration(page)
  await stabilizeForScreenshot(page)

  const pricing = page.locator("[data-public-home-build-pricing]")
  await pricing.evaluate((element) =>
    element.scrollIntoView({ block: "start" })
  )
  await expect(page).toHaveScreenshot("pricing-embed-shell.png", {
    animations: "disabled",
    caret: "hide",
    scale: "css",
    maxDiffPixelRatio: 0.018,
  })
})

test("Build workspace preview reflows at 320 pixels", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/home-canvas?section=platform")
  await stabilizeForScreenshot(page)

  const preview = page.locator("[data-public-home-workspace-preview]")
  await preview.scrollIntoViewIfNeeded()
  await expect(preview).toBeVisible()
  expect(
    await preview.evaluate(
      (element) => element.scrollWidth <= element.clientWidth
    )
  ).toBe(true)
  const status = preview.getByText("On track")
  const statusBox = await status.boundingBox()
  const previewBox = await preview.boundingBox()
  expect(statusBox).not.toBeNull()
  expect(previewBox).not.toBeNull()
  expect(statusBox!.x + statusBox!.width).toBeLessThanOrEqual(
    previewBox!.x + previewBox!.width
  )
})

test("Fund reuses the fiscal sponsorship workspace card", async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto("/home-canvas?section=accelerator", {
    waitUntil: "domcontentloaded",
  })
  await page.waitForSelector(
    '[data-fiscal-sponsorship-surface="workspace-card"]',
    { state: "visible" }
  )
  await waitForHomeCanvasHydration(page)
  await stabilizeForScreenshot(page)

  const fiscalCard = page.locator(
    '[data-fiscal-sponsorship-surface="workspace-card"]'
  )
  const startApplication = fiscalCard.getByRole("link", {
    name: "Start application",
  })
  await expect(startApplication).toBeEnabled()
  await startApplication.click()
  await expect(page).toHaveURL(/section=signup&intent=fund/)
})

test("Fund fiscal sponsorship card wraps at 320 pixels", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/home-canvas?section=accelerator")
  const fiscalCard = page.locator(
    '[data-fiscal-sponsorship-surface="workspace-card"]'
  )
  await fiscalCard.waitFor({ state: "visible", timeout: 30_000 })
  await stabilizeForScreenshot(page)

  await expect(fiscalCard.locator('[data-slot="card-title"]')).toHaveText(
    "Fiscal Sponsorship"
  )
  expect(
    await fiscalCard.evaluate(
      (element) => element.scrollWidth <= element.clientWidth
    )
  ).toBe(true)
  await expect(
    fiscalCard.getByText("Application intake", { exact: true })
  ).toBeVisible()
  await expect(
    fiscalCard.getByText("Required documents", { exact: true })
  ).toBeVisible()
  await expect(
    fiscalCard.getByText("Submit grant request", { exact: true })
  ).toBeVisible()
})

// Resources replaced the old permanent drawer and Find/Guides/My Map tabs.
// Keep responsive/search coverage against the shipped map + floating dock flow.
for (const width of [390, 768, 1024, 1440]) {
  test(`public Resources keeps its map and search dock reachable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await mockPublicResourceDirectory(page)
    await page.goto("/resources")
    const map = page.locator("[data-public-map-card]")
    const dock = page.getByRole("navigation", { name: "Resource search and collection" })
    await expect(map).toBeVisible()
    await expect(dock).toBeVisible()
    await expect(dock.getByRole("searchbox", { name: "Find organizations and resources" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Find Nearby" })).toBeVisible()
    await expect(page.locator('[data-slot="drawer-content"]')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    const mapBox = await map.boundingBox()
    const dockBox = await dock.boundingBox()
    expect(mapBox!.y).toBeGreaterThanOrEqual(0)
    expect(dockBox!.y + dockBox!.height).toBeLessThanOrEqual(845)
    expect(mapBox!.width).toBeLessThanOrEqual(width)
  })
}

test("public Resources searches and clears from its floating dock", async ({ page }) => {
  await mockPublicResourceDirectory(page)
  await page.goto("/resources")
  const search = page.getByRole("searchbox", { name: "Find organizations and resources" })
  await expect(search).toBeVisible()
  await search.fill("food")
  await expect(search).toHaveValue("food")
  await expect(page.locator("[data-public-map-search-results-status]")).toBeVisible()
  await search.press("Escape")
  await expect(search).toHaveValue("")
  await search.press("Escape")
  await expect(page.getByRole("heading", { name: "Find Nearby" })).toBeVisible()
})

test.beforeEach(async ({ page }) => {
  await prepareVisualPage(page)
})
