import { prepareVisualPage } from "./reviewed-platform-screenshot"
import { expect, test } from "@playwright/test"
import { mockPublicResourceDirectory } from "./fixtures/public-resource-directory"

for (const path of ["/home", "/legacy-home", "/home-canvas"]) {
  test(`retired homepage ${path} returns to the current home`, async ({ page }) => {
    await page.goto(path)
    await expect(page).toHaveURL((url) => url.pathname === "/")
    await expect(page.locator("[data-home-canvas-panel]")).toHaveCount(0)
  })
}

test("old login bookmarks preserve confirmation and invitation state", async ({ page }) => {
  const destination = "/join-organization?token=fixture-invite"
  const params = new URLSearchParams({ section: "login", redirect: destination, notice: "email_confirmed_sign_in" })
  await page.goto(`/home-canvas?${params}`)
  await expect(page).toHaveURL((url) => url.pathname === "/login" && url.searchParams.get("redirect") === destination)
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible()
  await expect(page.getByRole("status").filter({ hasText: "Email confirmed. Sign in to continue." })).toBeVisible()
  await expect(page.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", `/forgot-password?redirect=${encodeURIComponent(destination)}`)
  await expect(page.getByRole("link", { name: "Need an account? Sign up" })).toHaveAttribute("href", `/sign-up?redirect=${encodeURIComponent(destination)}`)
})

test("canonical login stays usable after a rejected password attempt on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route("**/auth/v1/token**", (route) => route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "invalid_grant", error_description: "Invalid login credentials" }) }))
  await page.goto("/login?redirect=%2Fworkspace")
  await page.getByLabel("Email", { exact: true }).fill("fixture@example.org")
  await page.getByLabel("Password", { exact: true }).fill("fixture-password")
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await expect(page.getByRole("alert").filter({ hasText: "Invalid login credentials" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled()
  await expect(page).toHaveURL((url) => url.pathname === "/login")
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  for (const control of [page.getByLabel("Email", { exact: true }), page.getByLabel("Password", { exact: true }), page.getByRole("button", { name: "Sign in", exact: true })]) {
    expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  }
})

test("tester login uses canonical sign-in and keeps its return path", async ({ page }) => {
  await page.goto("/tester/login?redirect=%2Fworkspace%2Froadmap")
  await expect(page).toHaveURL((url) => url.pathname === "/login" && url.searchParams.get("redirect") === "/workspace/roadmap")
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible()
  await expect(page.getByText("Tester sign in", { exact: true })).toHaveCount(0)
})

test("Resources sign-in opens canonical login", async ({ page }) => {
  await mockPublicResourceDirectory(page)
  await page.goto("/resources")
  await page.getByRole("button", { name: "Login", exact: true }).click()
  await expect(page).toHaveURL((url) => url.pathname === "/login")
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible()
})

test("old marketplace bookmarks open the current directory", async ({ page }) => {
  await page.goto("/marketplace?q=Canva")
  await expect(page).toHaveURL((url) => url.pathname === "/documentation/marketplace" && url.searchParams.get("q") === "Canva")
  await expect(page.getByRole("heading", { name: /Marketplace/ }).first()).toBeVisible()
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
