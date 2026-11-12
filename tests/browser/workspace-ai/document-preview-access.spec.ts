import { expect, test, type Page, type Route } from "@playwright/test"
const drivePath = "**/api/integrations/google-drive/documents/*/preview?**"
const legacyPath = "**/api/account/org-documents?**"
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6oX8AAAAASUVORK5CYII=", "base64")
const image = { contentType: "image/png", body: png }
const invalidate = (page: Page, orgId = "current-org") => page.evaluate(orgId => window.dispatchEvent(new CustomEvent("coach-house:workspace-access-changed", { detail: { orgId } })), orgId)
const visibleImage = (page: Page) => page.getByRole("img", { name: "Private image", exact: true })
async function ready(page: Page, kind = "Drive") {
  await page.addInitScript(() => {
    const original = URL.revokeObjectURL
    URL.revokeObjectURL = url => {
      document.documentElement.setAttribute("data-revoked-url", url)
      original.call(URL, url)
    }
  })
  await page.route(drivePath, route => route.fulfill(image))
  await page.route(legacyPath, route => route.fulfill({ json: { url: "/fixture-image" } }))
  await page.route("**/fixture-image", route => route.fulfill(image))
  await page.goto("/document-preview-access.html")
  await page.getByRole("button", { name: `Open ${kind} preview`, exact: true }).click()
  await expect(visibleImage(page)).toBeVisible()
  await expect.poll(() => visibleImage(page).evaluate(node => (node as HTMLImageElement).naturalWidth)).toBe(1)
}
test("Drive previews use scoped fresh bytes and release revoked images; retry reloads", async ({ page }) => {
  await ready(page)
  const oldUrl = await visibleImage(page).getAttribute("src")
  expect(oldUrl).toMatch(/^blob:/)
  let pending: Route | undefined
  await page.route(drivePath, route => { pending = route })
  await invalidate(page, "other-org")
  expect(pending).toBeUndefined()
  await invalidate(page)
  await expect(visibleImage(page)).toHaveCount(0)
  await expect.poll(() => pending).toBeTruthy()
  expect(new URL(pending!.request().url()).searchParams.get("organizationId")).toBe("current-org")
  await expect(page.locator("html")).toHaveAttribute("data-revoked-url", oldUrl!)
  await pending!.fulfill({ status: 403, json: { code: "forbidden" } })
  await expect(page.getByRole("alert")).toBeVisible()
  await expect(page.getByRole("heading", { name: "Private image" })).toHaveCount(0)
  await expect(page.getByRole("link", { name: "Open original" })).toHaveCount(0)
  pending = undefined
  await page.evaluate(() => window.dispatchEvent(new Event("focus")))
  expect(pending).toBeUndefined()
  await page.getByRole("button", { name: "Retry preview" }).click()
  await expect.poll(() => pending).toBeTruthy()
  await pending!.fulfill(image)
  await expect(visibleImage(page)).toBeVisible()
  expect(await visibleImage(page).getAttribute("src")).not.toBe(oldUrl)
})
test("authorized legacy background checks preserve the preview and revoked reads remove it", async ({ page }) => {
  await ready(page, "legacy")
  await visibleImage(page).evaluate(node => node.setAttribute("data-preserved", "yes"))
  let pending: Route | undefined
  await page.route(legacyPath, route => { pending = route })
  await page.evaluate(() => window.dispatchEvent(new Event("focus")))
  await expect.poll(() => pending).toBeTruthy()
  expect(new URL(pending!.request().url()).searchParams.get("organizationId")).toBe("current-org")
  await expect(page.locator('[data-preserved="yes"]')).toBeVisible()
  await pending!.fulfill({ json: { url: "/fixture-image" } })
  await expect(page.locator('[data-preserved="yes"]')).toBeVisible()
  pending = undefined
  await invalidate(page)
  await expect.poll(() => pending).toBeTruthy()
  await pending!.fulfill({ status: 403, json: { error: "Denied" } })
  await expect(visibleImage(page)).toHaveCount(0)
  await expect(page.getByRole("alert")).toBeVisible()
})
test("closing releases blob URLs and reopening reads again without reviving stale responses", async ({ page }) => {
  await ready(page)
  const oldUrl = await visibleImage(page).getAttribute("src")
  const pending: Route[] = []
  await page.route(drivePath, route => { pending.push(route) })
  await page.evaluate(() => window.dispatchEvent(new Event("focus")))
  await expect.poll(() => pending.length).toBe(1)
  await page.keyboard.press("Escape")
  await expect(page.locator("html")).toHaveAttribute("data-revoked-url", oldUrl!)
  await page.getByRole("button", { name: "Open Drive preview", exact: true }).click()
  await expect.poll(() => pending.length).toBeGreaterThan(1)
  await pending.at(-1)!.fulfill({ status: 403, json: { code: "forbidden" } })
  await pending[0].fulfill(image).catch(() => {})
  await expect(page.getByRole("alert")).toBeVisible()
  await expect(visibleImage(page)).toHaveCount(0)
})
test("a stalled preview check clears old content on timeout", async ({ page }) => {
  await ready(page)
  await page.clock.install()
  let pending: Route | undefined
  await page.route(drivePath, route => { pending = route })
  await page.evaluate(() => window.dispatchEvent(new Event("focus")))
  await expect.poll(() => pending).toBeTruthy()
  await expect(visibleImage(page)).toBeVisible()
  await page.clock.fastForward(15001)
  await expect(page.getByRole("alert")).toBeVisible()
  await expect(visibleImage(page)).toHaveCount(0)
  await pending!.fulfill(image).catch(() => {})
  await expect(visibleImage(page)).toHaveCount(0)
})
test("retained hidden previews release bytes and recheck before showing content", async ({ page }) => {
  await ready(page)
  const oldUrl = await visibleImage(page).getAttribute("src")
  let pending: Route | undefined
  await page.route(drivePath, route => { pending = route })
  const setActive = (active: boolean) => page.evaluate(active => window.dispatchEvent(new CustomEvent("fixture-window-active", { detail: active })), active)
  await setActive(false)
  await expect(visibleImage(page)).toHaveCount(0)
  await expect(page.locator("html")).toHaveAttribute("data-revoked-url", oldUrl!)
  await invalidate(page)
  expect(pending).toBeUndefined()
  await setActive(true)
  await expect.poll(() => pending).toBeTruthy()
  await pending!.fulfill({ contentType: "application/json", json: { error: "Invalid bytes" } })
  await expect(page.getByRole("alert")).toBeVisible()
  await expect(visibleImage(page)).toHaveCount(0)
})
