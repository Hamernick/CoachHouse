import { expect, test } from "@playwright/test"

test("public Build landing and hover navigation", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/build?react-grab=0")

  await expect(
    page.getByRole("heading", {
      name: "Workspace for nonprofits.",
    })
  ).toBeVisible()

  const buildMenu = page.getByRole("button", { name: "Build", exact: true })
  await expect(page.getByRole("button", { name: /Toggle theme \(currently/ })).toBeVisible()
  await buildMenu.hover()
  const menu = page.locator('[data-slot="navigation-menu-content"][data-state="open"]')
  await expect(menu.getByRole("link", { name: /Workspace/ })).toBeVisible()
  await expect(menu.getByRole("link", { name: /Accelerator/ })).toBeVisible()
  await expect(menu.getByRole("link", { name: /Pricing/ })).toBeVisible()
  await page.mouse.move(20, 300)
  await expect(buildMenu).toHaveAttribute("data-state", "closed")

  await expect(page).toHaveScreenshot("public-build-landing.png", {
    animations: "disabled",
    caret: "hide",
    maxDiffPixelRatio: 0.02,
    scale: "css",
  })
})

test("public navigation menu layers above Documentation content", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/documentation?react-grab=0")

  const buildMenu = page.getByRole("button", { name: "Build", exact: true })
  await expect(page.getByRole("button", { name: /Toggle theme \(currently/ })).toBeVisible()
  await buildMenu.hover()
  const menuLayer = page.locator(
    '[data-slot="navigation-menu-content"][data-state="open"]'
  )
  await expect(menuLayer.getByRole("link", { name: /Workspace/ })).toBeVisible()

  const menuBox = await menuLayer.boundingBox()
  const frameBox = await page
    .locator("[data-public-find-content-frame]")
    .boundingBox()
  expect(menuBox).not.toBeNull()
  expect(frameBox).not.toBeNull()
  const overlapLeft = Math.max(menuBox!.x, frameBox!.x)
  const overlapRight = Math.min(
    menuBox!.x + menuBox!.width,
    frameBox!.x + frameBox!.width
  )
  const overlapTop = Math.max(menuBox!.y, frameBox!.y)
  const overlapBottom = Math.min(
    menuBox!.y + menuBox!.height,
    frameBox!.y + frameBox!.height
  )
  expect(overlapRight).toBeGreaterThan(overlapLeft)
  expect(overlapBottom).toBeGreaterThan(overlapTop)

  const menuIsTopLayer = await page.evaluate(
    ({ x, y }) => {
      const menu = document.querySelector(
        '[data-slot="navigation-menu-content"][data-state="open"]'
      )
      const hitTarget = document.elementFromPoint(x, y)
      return Boolean(menu && hitTarget && menu.contains(hitTarget))
    },
    {
      x: (overlapLeft + overlapRight) / 2,
      y: (overlapTop + overlapBottom) / 2,
    }
  )
  expect(menuIsTopLayer).toBe(true)
})

test("public navigation menu opens and closes with the keyboard", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/build?react-grab=0")
  const trigger = page
    .locator('[data-slot="navigation-menu-trigger"]')
    .filter({ hasText: "Build" })
  await trigger.focus()
  await page.keyboard.press("Enter")
  await expect(trigger).toHaveAttribute("data-state", "open")
  await expect(
    page.locator(
      '[data-slot="navigation-menu-content"][data-state="open"] a[href="/build#workspace"]'
    )
  ).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(trigger).toHaveAttribute("data-state", "closed")
  await expect(trigger).toBeFocused()
})

for (const route of ["/", "/documentation"] as const) {
  for (const menuName of ["Collect", "Build"] as const) {
    test(`${menuName} menu stays open and navigates from ${route}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto(`${route}?react-grab=0`)
      const trigger = page
        .locator('[data-slot="navigation-menu-trigger"]')
        .filter({ hasText: menuName })
      await expect(page.getByRole("button", { name: /Toggle theme \(currently/ })).toBeVisible()
      await trigger.hover()
      const link = page.locator(
        menuName === "Collect"
          ? 'a[href="/login?redirect=%2Fresources"]'
          : 'a[href="/build#pricing"]'
      )
      await expect(link).toBeVisible()
      await link.hover()
      await expect(trigger).toHaveAttribute("data-state", "open")
      await link.click()
      await expect(page).toHaveURL(
        menuName === "Collect"
          ? /\/login\?redirect=%2Fresources$/
          : /\/build#pricing$/
      )
      if (menuName === "Build") {
        await expect(
          page.getByRole("region", {
            name: "Choose how you build.",
          })
        ).toBeVisible()
      }
    })
  }
}

test("public Build header stays minimal", async ({ page }) => {
  await page.goto("/build?react-grab=0")
  await expect(page.getByRole("heading", { name: "Workspace for nonprofits." })).toBeVisible()
  await expect(page.getByPlaceholder("Start searching")).toHaveCount(0)
  await expect(page.getByRole("link", { name: "See plans", exact: true })).toHaveAttribute("href", "/build#pricing")
})

test("public Build landing stays within a mobile viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/build?react-grab=0")

  await expect(page.getByRole("button", { name: "Collect", exact: true })).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Build", exact: true })
  ).toHaveAttribute("data-active", "true")
  await page.addStyleTag({
    content: "nextjs-portal { visibility: hidden !important; }",
  })
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
    )
  ).toBe(false)

  await expect(page).toHaveScreenshot("public-build-landing-mobile.png", {
    animations: "disabled",
    caret: "hide",
    maxDiffPixelRatio: 0.02,
    scale: "css",
  })
})
