import { expect, test } from "@playwright/test"

test("Documentation menus stay centered and reachable above the canvas", async ({
  page,
}) => {
  for (const width of [1440, 1024, 768]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto("/documentation?react-grab=0", { waitUntil: "domcontentloaded" })
    await expect(page.locator("[data-build-collect-public-header]")).toBeVisible()
    const header = page.locator("[data-build-collect-public-header]")
    const navigation = header.locator('[data-slot="navigation-menu-list"]')
    const headerBounds = (await header.boundingBox())!
    const navigationBounds = (await navigation.boundingBox())!
    expect(
      Math.abs(
        navigationBounds.x +
          navigationBounds.width / 2 -
          (headerBounds.x + headerBounds.width / 2)
      )
    ).toBeLessThan(1)

    for (const name of ["Collect", "Build"]) {
      const trigger = header.getByRole("button", { name, exact: true })
      const menu = header.locator(
        '[data-slot="navigation-menu-content"][data-state="open"]'
      )
      await expect(async () => {
        await page.mouse.move(0, 0)
        await trigger.hover()
        await expect(menu).toBeVisible({ timeout: 1000 })
      }).toPass({ timeout: 15000 })
      const links = menu.getByRole("link")
      await links.first().hover()
      await expect(menu).toBeVisible()
      for (const link of await links.all()) await link.click({ trial: true })
      const menuBounds = (await menu.boundingBox())!
      expect(
        Math.abs(
          menuBounds.x +
            menuBounds.width / 2 -
            (navigationBounds.x + navigationBounds.width / 2)
        )
      ).toBeLessThan(1)
      await page.keyboard.press("Escape")
      await expect(menu).toBeHidden()
      await trigger.focus()
      await trigger.press("Space")
      await expect(menu).toBeVisible()
      await page.keyboard.press("Escape")
      await expect(menu).toBeHidden()
      await page.mouse.move(20, 400)
    }
  }
  await page.goto("/documentation?react-grab=0", { waitUntil: "domcontentloaded" })
  await expect(page.locator("[data-build-collect-public-header]")).toBeVisible()
  const header = page.locator("[data-build-collect-public-header]")
  await header.getByRole("button", { name: "Collect", exact: true }).focus()
  await page.keyboard.press("Space")
  await expect(
    header.locator('[data-slot="navigation-menu-content"][data-state="open"]')
  ).toBeVisible()
  await page.keyboard.press("ArrowDown")
  const explore = header.getByRole("link", { name: /^Explore resources/ })
  await expect(explore).toBeFocused()
  await explore.press("Enter")
  await expect(page).toHaveURL(/\/$/)
})

test("public Build landing and hover navigation", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/build?react-grab=0")
  await expect(page.locator("[data-build-collect-public-header]")).toBeVisible()

  await expect(
    page.getByRole("heading", {
      name: "Build the organization your community needs.",
    })
  ).toBeVisible()

  const buildMenu = page.getByRole("button", { name: "Build", exact: true })
  await expect(async () => {
    await page.mouse.move(0, 0)
    await buildMenu.hover()
    await expect(page.getByRole("link", { name: /Workspace/ })).toBeVisible({ timeout: 1000 })
  }).toPass({ timeout: 15000 })
  await expect(page.getByRole("link", { name: /Accelerator/ })).toBeVisible()
  await expect(page.getByRole("link", { name: /Pricing/ })).toBeVisible()

  await page.mouse.move(20, 300)
  await expect(buildMenu).toHaveAttribute("data-state", "closed")

  await expect(page).toHaveScreenshot("public-build-landing.png", {
    animations: "disabled",
    caret: "hide",
    maxDiffPixelRatio: 0.02,
    scale: "css",
  })
})

test("public header search submits to the Collect root", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/build?react-grab=0")

  const search = page.getByRole("searchbox", {
    name: "Search organizations and resources",
  })
  await search.fill("food")
  await search.press("Enter")

  await expect(page).toHaveURL(/\?q=food/)
  await expect(
    page.getByRole("searchbox", { name: "Find organizations and resources" })
  ).toHaveValue("food")
})

test("public Build landing stays within a mobile viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/build?react-grab=0")

  await expect(page.getByRole("link", { name: "Collect" })).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Build", exact: true })
  ).toHaveAttribute("aria-current", "page")
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
