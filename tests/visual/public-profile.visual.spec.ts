import { prepareVisualPage } from "./reviewed-platform-screenshot"
import { expect, test, type Page } from "@playwright/test"

async function hideDevelopmentOverlays(page: Page) {
  await page.addStyleTag({
    content: `
      nextjs-portal,
      [data-testid="react-grab-overlay"] {
        display: none !important;
      }
    `,
  })
}

test("centered public organization profile", async ({ page }) => {
  await page.goto("/visual-regression/public-profile")
  await hideDevelopmentOverlays(page)
  const profile = page.locator("[data-public-profile-page]")
  await expect(profile).toBeVisible()
  await expect(profile.getByRole("heading", { name: "People" })).toBeVisible()
  await expect(
    profile.getByRole("heading", { name: "Activity", exact: true })
  ).toBeVisible()
  await expect(profile.getByRole("link", { name: "Donate" })).toBeVisible()
  await expect(profile.getByRole("link", { name: "Apply" })).toBeVisible()
  await expect(profile).toHaveScreenshot("public-organization-profile.png", {
    animations: "disabled",
    caret: "hide",
    scale: "css",
    maxDiffPixelRatio: 0.02,
  })
})

test("public organization profile reflows on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/visual-regression/public-profile")
  await hideDevelopmentOverlays(page)
  const profile = page.locator("[data-public-profile-page]")
  await expect(profile).toBeVisible()
  await expect(
    profile.evaluate((element) => element.scrollWidth <= element.clientWidth)
  ).resolves.toBe(true)
  await expect(profile).toHaveScreenshot(
    "public-organization-profile-mobile.png",
    {
      animations: "disabled",
      caret: "hide",
      scale: "css",
      // The text-dense mobile capture has stable cross-platform font rasterization
      // variance on Ubuntu while retaining the same measured layout and overflow.
      maxDiffPixelRatio: 0.035,
    }
  )
})

test("centered public person impact profile", async ({ page }) => {
  await page.goto("/visual-regression/public-profile?kind=person")
  await hideDevelopmentOverlays(page)
  const profile = page.locator("[data-public-profile-page]")
  await expect(profile).toBeVisible()
  await expect(
    profile.getByRole("heading", { name: "Organizations" })
  ).toBeVisible()
  await expect(
    profile.getByRole("heading", { name: "Public activity" })
  ).toBeVisible()
  await expect(profile).toHaveScreenshot("public-person-profile.png", {
    animations: "disabled",
    caret: "hide",
    scale: "css",
    maxDiffPixelRatio: 0.02,
  })
})

test("public person impact profile reflows on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/visual-regression/public-profile?kind=person")
  await hideDevelopmentOverlays(page)
  const profile = page.locator("[data-public-profile-page]")
  await expect(profile).toBeVisible()
  await expect(
    profile.evaluate((element) => element.scrollWidth <= element.clientWidth)
  ).resolves.toBe(true)
  await expect(profile).toHaveScreenshot("public-person-profile-mobile.png", {
    animations: "disabled",
    caret: "hide",
    scale: "css",
    maxDiffPixelRatio: 0.02,
  })
})

test.beforeEach(async ({ page }) => {
  await prepareVisualPage(page)
})
