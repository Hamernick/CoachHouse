import { expect, test, type Page, type Route } from "@playwright/test"
const endpoint = "**/fixture/core-access"
const granted = { userId: "00000000-0000-4000-8000-000000000001", organizationId: "00000000-0000-4000-8000-000000000002", canEdit: true }
const invalidate = (page: Page, orgId = granted.organizationId) => page.evaluate(orgId => window.dispatchEvent(new CustomEvent("coach-house:workspace-access-changed", { detail: { orgId } })), orgId)
for (const kind of ["dialog", "roadmap"]) {
  test.describe(kind, () => {
    async function ready(page: Page) {
      await page.route(endpoint, route => route.fulfill({ json: granted }))
      await page.goto(`/core-editor.html${kind === "roadmap" ? "?roadmap" : ""}`)
      await expect(page.locator('[contenteditable="true"]').first()).toContainText("Private core content")
    }
    test("focus preserves editor and typing; invalidation pauses saves and restores the same draft", async ({ page }) => {
      await ready(page)
      await page.clock.install()
      const editor = page.locator('[contenteditable="true"]').first()
      await editor.fill("Unsaved local draft")
      await editor.evaluate(node => node.setAttribute("data-preserved", "yes"))
      let pending: Route | undefined
      await page.route(endpoint, route => { pending = route })
      await page.evaluate(() => window.dispatchEvent(new Event("focus")))
      await expect.poll(() => pending).toBeTruthy()
      await expect(page.locator('[data-preserved="yes"]')).toContainText("Unsaved local draft")
      await pending!.fulfill({ json: granted })
      await expect(page.locator('[data-preserved="yes"]')).toContainText("Unsaved local draft")
      pending = undefined
      let saves = 0
      await page.route("**/__fixture/save", route => { saves++; return route.abort() })
      await invalidate(page)
      await expect(page.locator('[contenteditable="true"]')).toHaveCount(0)
      await expect.poll(() => pending).toBeTruthy()
      await page.clock.fastForward(11000)
      expect(saves).toBe(0)
      await pending!.fulfill({ json: granted })
      await expect(editor).toContainText("Unsaved local draft")
    })
    test("revocation removes content and controls; focus cannot reopen it", async ({ page }) => {
      await ready(page)
      let pending: Route | undefined
      await page.route(endpoint, route => { pending = route })
      await invalidate(page, "other-org")
      expect(pending).toBeUndefined()
      await invalidate(page)
      await expect(page.getByText("Private core content", { exact: true })).toHaveCount(0)
      await expect.poll(() => pending).toBeTruthy()
      await pending!.fulfill({ status: 403, json: {} })
      await expect(page.getByText("Document unavailable. Close and reopen to check access.")).toBeVisible()
      await expect(page.getByRole("button", { name: /Save document|Choose from Google Drive/ })).toHaveCount(0)
      pending = undefined
      await page.evaluate(() => window.dispatchEvent(new Event("focus")))
      expect(pending).toBeUndefined()
      await page.getByRole("button", { name: kind === "dialog" ? "Close document" : "Close editor", exact: true }).click()
      await page.getByRole("button", { name: "Open editor", exact: true }).click()
      await expect.poll(() => pending).toBeTruthy()
      await pending!.fulfill({ json: granted })
      await expect(page.locator('[contenteditable="true"]').first()).toContainText("Private core content")
    })
    test("a superseding check ignores stale grants and malformed results", async ({ page }) => {
      await ready(page)
      const pending: Route[] = []
      await page.route(endpoint, route => { pending.push(route) })
      await page.evaluate(() => { window.dispatchEvent(new Event("focus")); window.dispatchEvent(new Event("focus")) })
      await expect.poll(() => pending.length).toBe(1)
      await invalidate(page)
      await expect.poll(() => pending.length).toBe(2)
      await pending[1].fulfill({ json: { ...granted, canEdit: "true" } })
      await expect(page.getByText("Document unavailable. Close and reopen to check access.")).toBeVisible()
      await pending[0].fulfill({ json: granted })
      await expect(page.locator('[contenteditable="true"]')).toHaveCount(0)
    })
    test("retained hidden windows wait for fresh access before showing their draft", async ({ page }) => {
      await ready(page)
      await page.clock.install()
      await page.locator('[contenteditable="true"]').first().fill("Retained hidden draft")
      let pending: Route | undefined
      await page.route(endpoint, route => { pending = route })
      await page.getByText("Hide window", { exact: true }).evaluate(element => (element as HTMLElement).click())
      await expect(page.locator('[contenteditable="true"]')).toHaveCount(0)
      await invalidate(page)
      expect(pending).toBeUndefined()
      await page.getByText("Show window", { exact: true }).evaluate(element => (element as HTMLElement).click())
      await expect.poll(() => pending).toBeTruthy()
      await expect(page.getByText("Retained hidden draft", { exact: true })).toHaveCount(0)
      await pending!.fulfill({ json: granted })
      await expect(page.locator('[contenteditable="true"]').first()).toContainText("Retained hidden draft")
    })
    test("timeout and late responses cannot revive a retired editor", async ({ page }) => {
      await ready(page)
      await page.clock.install()
      let pending: Route | undefined
      await page.route(endpoint, route => { pending = route })
      await page.evaluate(() => window.dispatchEvent(new Event("focus")))
      await expect.poll(() => pending).toBeTruthy()
      await page.clock.fastForward(15001)
      await expect(page.getByText("Document unavailable. Close and reopen to check access.")).toBeVisible()
      await pending!.fulfill({ json: granted })
      await expect(page.locator('[contenteditable="true"]')).toHaveCount(0)
    })
    test("page return rechecks identity and edit downgrade pauses existing drafts", async ({ page }) => {
      await ready(page)
      let pending: Route | undefined
      await page.route(endpoint, route => { pending = route })
      await page.evaluate(() => window.dispatchEvent(new Event("pagehide")))
      await expect(page.locator('[contenteditable="true"]')).toHaveCount(0)
      expect(pending).toBeUndefined()
      await page.evaluate(() => window.dispatchEvent(new Event("pageshow")))
      await expect.poll(() => pending).toBeTruthy()
      await pending!.fulfill({ json: { ...granted, canEdit: false } })
      await expect(page.getByText("Private core content", { exact: true })).toBeVisible()
      await expect(page.locator('[contenteditable="true"]')).toHaveCount(0)
      pending = undefined
      await page.evaluate(() => window.dispatchEvent(new Event("focus")))
      await expect.poll(() => pending).toBeTruthy()
      await pending!.fulfill({ json: { ...granted, userId: "other-user" } })
      await expect(page.getByText("Document unavailable. Close and reopen to check access.")).toBeVisible()
      await expect(page.getByText("Private core content", { exact: true })).toHaveCount(0)
    })
  })
}
