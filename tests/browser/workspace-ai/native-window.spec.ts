import { expect, test, type Page, type Route } from "@playwright/test"
const endpoint = "**/fixture/native-window"
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const body = "Private native document"
const view = (route: Route, content = body) => ({ viewerId: id(3), editable: false, shared: { state: "absent" }, snapshot: {
  source: route.request().postDataJSON(), name: "private.md", format: "markdown", content,
  updatedAt: "2026-11-08T00:00:00Z", revision: "r1", collaboration: { state: "unavailable", canCommit: false },
} })
const invalidate = (page: Page, orgId = id(1)) => page.evaluate(orgId => window.dispatchEvent(new CustomEvent("coach-house:workspace-access-changed", { detail: { orgId } })), orgId)
async function ready(page: Page) {
  await page.route(endpoint, route => route.fulfill({ json: view(route) }))
  await page.goto("/native-window.html")
  await expect(page.getByText(body, { exact: true })).toBeVisible()
}
test("focus preserves the real native editor and coalesces repeated reads", async ({ page }) => {
  await ready(page)
  await page.getByText(body, { exact: true }).evaluate(node => node.setAttribute("data-preserved", "yes"))
  const pending: Route[] = []
  await page.route(endpoint, route => { pending.push(route) })
  await page.evaluate(() => { window.dispatchEvent(new Event("focus")); window.dispatchEvent(new Event("focus")) })
  await expect.poll(() => pending.length).toBe(1)
  await expect(page.locator('[data-preserved="yes"]')).toHaveText(body)
  await pending[0].fulfill({ json: view(pending[0], "New canonical text") })
  await expect(page.locator('[data-preserved="yes"]')).toHaveText(body)
  await expect(page.getByText("New canonical text", { exact: true })).toHaveCount(0)
})
test("access invalidation removes content and portal controls before denial; reopen is explicit", async ({ page }) => {
  await ready(page)
  let pending: Route | undefined
  await page.route(endpoint, route => { pending = route })
  await invalidate(page, id(9))
  expect(pending).toBeUndefined()
  await expect(page.getByText(body, { exact: true })).toBeVisible()
  await invalidate(page)
  await expect.poll(() => pending).toBeTruthy()
  await expect(page.getByText(body, { exact: true })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Copy saved file text" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Download original file" })).toHaveCount(0)
  await pending!.fulfill({ status: 403, json: {} })
  await expect(page.getByText("Document unavailable. Close and reopen to check access.")).toBeVisible()
  pending = undefined
  await page.evaluate(() => window.dispatchEvent(new Event("focus")))
  expect(pending).toBeUndefined()
  await page.getByRole("button", { name: "Close document", exact: true }).click()
  await page.getByRole("button", { name: "Open fixture" }).click()
  await expect.poll(() => pending).toBeTruthy()
  await pending!.fulfill({ json: view(pending!, "Fresh authorized read") })
  await expect(page.getByText("Fresh authorized read", { exact: true })).toBeVisible()
})
test("retained hidden windows wait for authorization before revealing content", async ({ page }) => {
  await ready(page)
  let pending: Route | undefined
  await page.route(endpoint, route => { pending = route })
  await page.getByRole("button", { name: "Hide window" }).click()
  await expect(page.getByText(body, { exact: true })).toHaveCount(0)
  await invalidate(page)
  expect(pending).toBeUndefined()
  await page.getByRole("button", { name: "Show window" }).click()
  await expect.poll(() => pending).toBeTruthy()
  await expect(page.getByText(body, { exact: true })).toHaveCount(0)
  await pending!.fulfill({ status: 403, json: {} })
  await expect(page.getByText("Document unavailable. Close and reopen to check access.")).toBeVisible()
})
test("a timed out background read cannot reveal its late response", async ({ page }) => {
  await ready(page)
  await page.clock.install()
  let pending: Route | undefined
  await page.route(endpoint, route => { pending = route })
  await page.evaluate(() => window.dispatchEvent(new Event("focus")))
  await expect.poll(() => pending).toBeTruthy()
  await page.clock.fastForward(15001)
  await expect(page.getByText(body, { exact: true })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Copy saved file text" })).toHaveCount(0)
  await pending!.fulfill({ json: view(pending!) })
  await expect(page.getByText("Document unavailable. Close and reopen to check access.")).toBeVisible()
})
test("superseded checks and source changes cannot revive old native content", async ({ page }) => {
  await ready(page)
  const pending: Route[] = []
  await page.route(endpoint, route => { pending.push(route) })
  await page.evaluate(() => window.dispatchEvent(new Event("focus")))
  await expect.poll(() => pending.length).toBe(1)
  await invalidate(page)
  await expect.poll(() => pending.length).toBe(2)
  await pending[1].fulfill({ status: 403, json: {} })
  await pending[0].fulfill({ json: view(pending[0], "Stale response") })
  await expect(page.getByText("Document unavailable. Close and reopen to check access.")).toBeVisible()
  await page.getByRole("button", { name: "Switch source" }).click()
  await expect.poll(() => pending.length).toBe(3)
  expect(pending[2].request().postDataJSON().fileId).toBe(id(4))
  await pending[2].fulfill({ json: view(pending[2], "Replacement document") })
  await expect(page.getByText("Replacement document", { exact: true })).toBeVisible()
  await expect(page.getByText("Stale response", { exact: true })).toHaveCount(0)
})

test("page lifecycle clears content and a denied reader stays retired after further events", async ({ page }) => {
  await ready(page)
  let pending: Route | undefined
  await page.route(endpoint, route => { pending = route })
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")))
  await expect(page.getByText(body, { exact: true })).toHaveCount(0)
  expect(pending).toBeUndefined()
  await page.evaluate(() => window.dispatchEvent(new Event("pageshow")))
  await expect.poll(() => pending).toBeTruthy()
  await pending!.fulfill({ json: { ...view(pending!), viewerId: id(9) } })
  await expect(page.getByText("Document unavailable. Close and reopen to check access.")).toBeVisible()
  pending = undefined
  await page.evaluate(() => { window.dispatchEvent(new Event("pagehide")); window.dispatchEvent(new Event("pageshow")); window.dispatchEvent(new Event("online")) })
  await expect(page.getByText("Document unavailable. Close and reopen to check access.")).toBeVisible()
  expect(pending).toBeUndefined()
})
