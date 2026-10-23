import { expect, test, type Page } from "@playwright/test"
import { existsSync } from "node:fs"

async function expectShellScreenshot(page: Page, name: string) {
  await expect(page.locator("[data-shell-ready]")).toHaveAttribute("data-shell-ready", "true")
  const viewport = page.viewportSize()!
  await page.mouse.move(viewport.width - 1, viewport.height - 1)
  await expect.poll(() => page.locator("img").evaluateAll((images) =>
    images.every((image) => {
      if (!(image instanceof HTMLImageElement)) return true
      const bounds = image.getBoundingClientRect()
      const rendered = bounds.width > 0 && bounds.height > 0
      return !rendered || (image.complete && image.naturalWidth > 0)
    })
  )).toBe(true)
  // Preserve a review artifact when the normal gate refuses a missing baseline.
  if (!existsSync(test.info().snapshotPath(name))) {
    await page.screenshot({ path: test.info().outputPath(name), animations: "disabled" })
  }
  await expect.soft(page).toHaveScreenshot(name, { animations: "disabled" })
}

const pageErrors = new WeakMap<Page, string[]>()

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page)).toEqual([])
})

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /hydration|hydrating/i.test(message.text())
    )
      errors.push(message.text())
  })
  await page.route("https://unpkg.com/react-grab@*/**", (route) =>
    route.fulfill({ body: "", contentType: "application/javascript" })
  )
  pageErrors.set(page, errors)
})

const fixture = "/visual-regression/app-shell"

test("mobile shell keeps navigation reachable above the final action", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(fixture)
  const navigation = page.getByRole("navigation", { name: "Main navigation" })
  await expect(navigation).toBeVisible()
  await expect(navigation.getByRole("link", { name: "Find" })).toHaveCount(0)
  expect(
    await navigation.getByRole("link", { name: "Workspace" }).count()
  ).toBe(0)

  const menu = page.getByRole("button", { name: "Menu" })
  const menuSize = await menu.boundingBox()
  expect(menuSize).not.toBeNull()
  expect(menuSize!.width).toBeGreaterThanOrEqual(44)
  expect(menuSize!.height).toBeGreaterThanOrEqual(44)
  await menu.click()
  const sidebar = page.getByRole("dialog", { name: "Sidebar" })
  await expect(sidebar).toBeVisible()
  for (const control of await sidebar.locator("a[href],button").all()) {
    if (!(await control.isVisible())) continue
    const bounds = await control.boundingBox()
    expect(bounds!.width).toBeGreaterThanOrEqual(44)
    expect(bounds!.height).toBeGreaterThanOrEqual(44)
  }
  await expect(sidebar.getByRole("button", { name: /Theme/ })).toBeVisible()
  await sidebar.getByRole("button", { name: "Close menu" }).click()
  await expect(sidebar).toBeHidden()
  await expect(menu).toBeFocused()

  await menu.click()
  // Keep the route mounted to prove link activation closes the sidebar itself.
  const destination = sidebar.getByRole("link", {
    name: "Documentation",
    exact: true,
  })
  await destination.evaluate((element) =>
    element.addEventListener("click", (event) => event.preventDefault(), {
      once: true,
    })
  )
  await destination.press("Enter")
  await expect(sidebar).toBeHidden()
  await expect(menu).toBeFocused()
  await menu.press("Space")
  await expect(sidebar).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(sidebar).toBeHidden()
  await expect(menu).toBeFocused()

  await page.locator("[data-shell-scroll]").evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  const lastAction = await page
    .getByRole("button", { name: "Last workspace action" })
    .boundingBox()
  const dock = await navigation.boundingBox()
  expect(lastAction).not.toBeNull()
  expect(dock).not.toBeNull()
  expect(lastAction!.y + lastAction!.height).toBeLessThanOrEqual(dock!.y)
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  ).toBe(false)
})

test("mobile Details closes with Escape and returns focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto(fixture)
  const details = page.getByRole("button", { name: "Details" })
  await expect(details).toBeVisible()
  await details.click()
  const drawer = page.getByRole("dialog", { name: "Details" })
  await expect(drawer).toBeVisible()
  await expect(
    drawer.getByRole("textbox", { name: "Project name" })
  ).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(drawer).toBeHidden()
  await expect(details).toBeFocused()
  await details.press("Enter")
  await expect(drawer).toBeVisible()
  await drawer.getByRole("button", { name: "Close", exact: true }).click()
  await expect(drawer).toBeHidden()
  await expect(details).toBeFocused()
})

test("component visibility follows the Workspace access input", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${fixture}?scenario=workspace-navigation&rail=none`)
  const navigation = page.getByRole("navigation", { name: "Main navigation" })
  await expect(
    navigation.getByRole("link", { name: "Workspace" })
  ).toHaveAttribute("href", "/workspace")
  await page.goto(`${fixture}?scenario=restricted-navigation&rail=none`)
  await expect(page.locator("[data-mobile-ready]")).toHaveAttribute(
    "data-mobile-ready", "true"
  )
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", {
        name: "Workspace",
      })
  ).toHaveCount(0)
})

test("component visibility honors locked navigation and absent rails", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${fixture}?scenario=locked-navigation&rail=none`)
  await expect(
    page.getByRole("heading", { name: "Navigation visibility fixture" })
  ).toBeVisible()
  await expect(page.locator("[data-mobile-ready]")).toHaveAttribute(
    "data-mobile-ready", "true"
  )
  await expect(
    page.getByRole("navigation", { name: "Main navigation" })
  ).toHaveCount(0)
  await page.goto(`${fixture}?rail=none`)
  await expect(page.locator("[data-mobile-ready]")).toHaveAttribute("data-mobile-ready", "true")
  await expect(
    page.getByRole("navigation", { name: "Main navigation" })
  ).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: "Details", exact: true })
  ).toHaveCount(0)
})

test("full-bleed content clears the dock and desktop keeps its rail", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${fixture}?mode=full-bleed`)
  const navigation = page.getByRole("navigation", { name: "Main navigation" })
  await expect(navigation).toBeVisible()
  await page.locator("[data-shell-content-body] > div").evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  const lastAction = await page
    .getByRole("button", { name: "Last workspace action" })
    .boundingBox()
  const dock = await navigation.boundingBox()
  expect(lastAction).not.toBeNull()
  expect(dock).not.toBeNull()
  expect(lastAction!.y + lastAction!.height).toBeLessThanOrEqual(dock!.y)

  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(navigation).toBeHidden()
  await expect(
    page.getByRole("button", { name: "Toggle sidebar" })
  ).toBeVisible()
  await page.getByRole("button", { name: "Toggle details panel" }).click()
  await expect(page.locator("#app-shell-right-rail")).toHaveAttribute(
    "data-state",
    "open"
  )
})

test("simulated keyboard clearance and reduced motion preserve mobile actions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto(fixture)
  const navigation = page.getByRole("navigation", { name: "Main navigation" })
  await expect(navigation).toBeVisible()
  await page.getByRole("textbox", { name: "Search workspace" }).focus()
  await page.evaluate(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    Object.defineProperty(viewport, "height", {
      configurable: true,
      value: window.innerHeight - 250,
    })
    viewport.dispatchEvent(new Event("resize"))
  })
  await expect(navigation).toBeHidden()
  await page.evaluate(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    Reflect.deleteProperty(viewport, "height")
    viewport.dispatchEvent(new Event("resize"))
  })
  await expect(navigation).toBeVisible()
  expect(await navigation.evaluate((element) =>
    getComputedStyle(element).transitionDuration
  )).toBe("0s")
  expect(
    await navigation
      .locator("span[aria-hidden]")
      .evaluate((element) => getComputedStyle(element).transitionDuration)
  ).toBe("0s")
})

test("scrubbing previews, commits inside, and cancels outside or with Escape", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${fixture}?scenario=member-navigation`)
  const navigation = page.getByRole("navigation", { name: "Main navigation" })
  await expect(navigation).toBeVisible()
  const workspace = navigation.getByRole("link", { name: "Workspace" })
  const details = navigation.getByRole("button", { name: "Details" })
  const drawer = page.getByRole("dialog", { name: "Details" })
  const from = (await workspace.boundingBox())!
  const to = (await details.boundingBox())!
  const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 }
  const end = { x: to.x + to.width / 2, y: to.y + to.height / 2 }
  const begin = async () => {
    await workspace.click({ trial: true })
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(end.x, end.y, { steps: 5 })
    await expect(navigation).toHaveAttribute("data-scrubbing", "true")
    await expect(details).toHaveAttribute("data-highlighted", "true")
    await expect(drawer).toBeHidden()
    await expect(page).toHaveURL((url) => url.pathname === fixture && url.searchParams.get("scenario") === "member-navigation")
  }

  await begin()
  await page.mouse.up()
  await expect(drawer).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(drawer).toBeHidden()

  await begin()
  await page.mouse.move(end.x, from.y - 30)
  await page.mouse.up()
  await expect(drawer).toBeHidden()
  await expect(page).toHaveURL((url) => url.pathname === fixture && url.searchParams.get("scenario") === "member-navigation")

  await begin()
  await page.keyboard.press("Escape")
  await page.mouse.up()
  await expect(navigation).toHaveAttribute("data-scrubbing", "false")
  await expect(drawer).toBeHidden()
  await details.click()
  await expect(drawer).toBeVisible()
})

test("touch pointer cancellation leaves the next action usable", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${fixture}?scenario=member-navigation`)
  await expect(page.locator("[data-shell-ready]")).toHaveAttribute("data-shell-ready", "true")
  const navigation = page.getByRole("navigation", { name: "Main navigation" })
  await expect(navigation).toBeVisible()
  const workspace = navigation.getByRole("link", { name: "Workspace" })
  await workspace.click({ trial: true })
  const from = (await workspace.boundingBox())!
  const details = navigation.getByRole("button", { name: "Details" })
  const to = (await details.boundingBox())!
  const client = await context.newCDPSession(page)
  await navigation.evaluate((element) => {
    const onCapture = (event: Event) => {
      if (event.target !== element) return
      element.removeEventListener("gotpointercapture", onCapture)
      element.setAttribute("data-test-native-pointer-capture", "true")
    }
    element.addEventListener("gotpointercapture", onCapture)
  })
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: from.x + from.width / 2, y: from.y + from.height / 2 }],
  })
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: to.x + to.width / 2, y: to.y + to.height / 2 }],
  })
  // A second move completes the browser's implicit link-to-nav capture transfer.
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: to.x + to.width / 2 - 12, y: to.y + to.height / 2 }],
  })
  await expect(navigation).toHaveAttribute("data-test-native-pointer-capture", "true")
  await expect(navigation).toHaveAttribute("data-scrubbing", "true")
  await client.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] })
  await expect(navigation).toHaveAttribute("data-scrubbing", "false")
  await expect(page.getByRole("dialog", { name: "Details" })).toBeHidden()
  await expect(page).toHaveURL((url) => url.pathname === fixture && url.searchParams.get("scenario") === "member-navigation")
  await details.click()
  await expect(page.getByRole("dialog", { name: "Details" })).toBeVisible()
  await client.detach()
})

test("links preserve ordinary, keyboard, modified and single scrub navigation", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  // Keep destination rendering out of this AppShell interaction test.
  await context.route("**/*", (route) => {
    const request = route.request()
    // Cover Next's RSC fetch as well as the full navigation/new-tab request.
    // HTML makes the client router fall back to the same isolated destination.
    if (new URL(request.url()).pathname === "/workspace")
      return route.fulfill({ contentType: "text/html", body: "<h1>Workspace destination</h1>" })
    return route.continue()
  })
  for (const activation of ["click", "keyboard", "modified", "scrub"] as const) {
    await page.goto(`${fixture}?scenario=member-navigation`)
    const navigation = page.getByRole("navigation", { name: "Main navigation" })
    await expect(navigation).toBeVisible()
    const workspace = navigation.getByRole("link", { name: "Workspace" })
    if (activation === "modified") {
      const popupPromise = context.waitForEvent("page")
      await workspace.click({ modifiers: [process.platform === "darwin" ? "Meta" : "Control"] })
      const popup = await popupPromise
      await expect(popup).toHaveURL(/\/workspace$/)
      await expect(page).toHaveURL((url) => url.pathname === fixture && url.searchParams.get("scenario") === "member-navigation")
      await popup.close()
      continue
    }
    const destinations: string[] = []
    const onNavigation = (frame: import("@playwright/test").Frame) => {
      if (frame === page.mainFrame() && new URL(frame.url()).pathname === "/workspace")
        destinations.push(frame.url())
    }
    page.on("framenavigated", onNavigation)
    if (activation === "click") await workspace.click()
    else if (activation === "keyboard") await workspace.press("Enter")
    else {
      const from = (await navigation.getByRole("button", { name: "Details" }).boundingBox())!
      const to = (await workspace.boundingBox())!
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
      await page.mouse.down()
      await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 5 })
      await expect(navigation).toHaveAttribute("data-scrubbing", "true")
      expect(destinations).toHaveLength(0)
      await page.mouse.up()
    }
    await expect(page).toHaveURL(/\/workspace$/)
    expect(destinations).toHaveLength(1)
    page.off("framenavigated", onNavigation)
  }
})

test("scroll compaction retains labels and actions and expands on upward scroll", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(fixture)
  const navigation = page.getByRole("navigation", { name: "Main navigation" })
  await expect(navigation).toBeVisible()
  const scroll = page.locator("[data-shell-scroll]")
  await scroll.evaluate((element) => { element.scrollTop = 240 })
  await expect(navigation).toHaveAttribute("data-compact", "true")
  for (const name of ["Details"]) {
    await expect(navigation.getByText(name, { exact: true })).toBeVisible()
  }
  for (const control of await navigation.locator("a,button").all()) {
    const bounds = (await control.boundingBox())!
    expect(bounds.width).toBeGreaterThanOrEqual(44)
    expect(bounds.height).toBeGreaterThanOrEqual(44)
  }
  await navigation.getByRole("button", { name: "Details" }).click()
  await expect(page.getByRole("dialog", { name: "Details" })).toBeVisible()
  await page.keyboard.press("Escape")
  await scroll.evaluate((element) => { element.scrollTop = 120 })
  await expect(navigation).toHaveAttribute("data-compact", "false")
})

const visualCases = [
  { width: 320, height: 740, theme: "light" },
  { width: 390, height: 844, theme: "light" },
  { width: 390, height: 844, theme: "dark" },
  { width: 768, height: 1024, theme: "light" },
  { width: 1440, height: 900, theme: "light" },
  { width: 1440, height: 900, theme: "dark" },
] as const

for (const { width, height, theme } of visualCases) {
  test(`baseline ${width} ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.emulateMedia({ colorScheme: theme })
    await page.addInitScript(
      (value) => localStorage.setItem("theme", value),
      theme
    )
    await page.goto(fixture)
    await expect(
      page.getByRole("heading", { name: "Your workspace" })
    ).toBeVisible()
    if (width < 768) {
      await expect(
        page.getByRole("navigation", { name: "Main navigation" })
      ).toBeVisible()
    } else {
      await expect(
        page.getByRole("button", { name: "Toggle sidebar" })
      ).toBeVisible()
    }
    await page.addStyleTag({
      content:
        "nextjs-portal, [data-testid='react-grab-overlay'] { visibility: hidden !important; }",
    })
    await expectShellScreenshot(page, `app-shell-${width}-${theme}.png`)
    if (width === 390) {
      await page.locator("[data-shell-scroll]").evaluate((element) => {
        element.scrollTop = 240
      })
      await expect(page.getByRole("navigation", { name: "Main navigation" }))
        .toHaveAttribute("data-compact", "true")
      await expectShellScreenshot(page, `app-shell-compact-${theme}.png`)
      await page.locator("[data-shell-scroll]").evaluate((element) => {
        element.scrollTop = 0
      })
      await expect(page.getByRole("navigation", { name: "Main navigation" }))
        .toHaveAttribute("data-compact", "false")
      await page.getByRole("button", { name: "Menu", exact: true }).click()
      await expect(page.getByRole("dialog", { name: "Sidebar" })).toBeVisible()
      await expectShellScreenshot(page, `app-shell-sidebar-${theme}.png`)
      await page.getByRole("button", { name: "Close menu" }).click()
      await page.getByRole("button", { name: "Details", exact: true }).click()
      await expect(page.getByRole("dialog", { name: "Details" })).toBeVisible()
      await expectShellScreenshot(page, `app-shell-details-${theme}.png`)
    }
  })
}

for (const step of ["account", "pricing"] as const) {
  test(`onboarding ${step} scrolls the page with the pointer inside the form`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 })
    await page.goto(`${fixture}?scenario=onboarding-${step}&rail=none`)
    await expect(page.locator("[data-shell-ready]")).toHaveAttribute("data-shell-ready", "true")
    const pageScroll = page.locator("[data-shell-scroll]")
    const formScroll = page.locator('[data-onboarding-scroll-region="true"]')
    await expect(formScroll).toBeVisible()
    await expect.poll(() => pageScroll.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeGreaterThan(0)
    await pageScroll.evaluate((element) => { element.scrollTop = 0 })
    const box = await formScroll.boundingBox()
    expect(box).not.toBeNull()
    await page.mouse.move(box!.x + box!.width / 2, Math.min(box!.y + 80, 500))
    await page.mouse.wheel(0, 400)
    await expect.poll(() => pageScroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  })
}
