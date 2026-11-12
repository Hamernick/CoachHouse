import { expect, test, type Page, type Route } from "@playwright/test"
const orgId = "10000000-0000-4000-8000-000000000001"
const allowed = { allowed: true, viewerId: "10000000-0000-4000-8000-000000000002", role: "staff", canEdit: true }
async function ready(page: Page) {
  await page.route("**/__fixture/canvas-access", route => route.fulfill({ json: allowed }))
  await page.goto("/canvas-access.html")
  await expect(page.getByLabel("Canvas draft")).toBeVisible()
  await page.getByLabel("Canvas draft").fill("Unsaved work")
  await expect(page.getByLabel("Sidebar catalog")).toHaveText("Private finance")
}
async function invalidate(page: Page, scope = orgId) {
  await page.evaluate(orgId => window.dispatchEvent(new CustomEvent("coach-house:workspace-access-changed", { detail: { orgId } })), scope)
}
test("checks before mounting; routine focus keeps the editor and unsaved draft", async ({ page }) => {
  const requests: Route[] = []
  await page.route("**/__fixture/canvas-access", route => { requests.push(route) })
  await page.goto("/canvas-access.html")
  await expect.poll(() => requests.length).toBeGreaterThan(0)
  await expect(page.getByLabel("Canvas draft")).toHaveCount(0)
  for (const route of requests.splice(0)) await route.fulfill({ json: allowed })
  await expect(page.getByLabel("Canvas draft")).toBeVisible()
  await page.getByLabel("Canvas draft").fill("Unsaved work")
  await page.evaluate(() => window.dispatchEvent(new Event("focus")))
  await expect.poll(() => requests.length).toBe(1)
  await expect(page.getByLabel("Canvas draft")).toBeVisible()
  await requests[0].fulfill({ json: allowed })
  await expect(page.getByLabel("Canvas draft")).toHaveValue("Unsaved work")
})
test("preserves open portaled editors and drafts during an authorized background check", async ({ page }) => {
  await ready(page)
  await page.getByRole("button", { name: "Open document", exact: true }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  let check: Route | undefined
  await page.route("**/__fixture/canvas-access", route => { check = route })
  await invalidate(page)
  await expect.poll(() => check?.request().postDataJSON()).toMatchObject({ orgId, canvasId: null, sources: { files: ["10000000-0000-4000-8000-000000000070"] } })
  await expect(page.getByRole("dialog")).toBeVisible()
  await expect(page.getByLabel("Canvas draft")).toHaveValue("Unsaved work")
  await expect(page.locator("html")).toHaveAttribute("data-canvas-active", "true")
  await check!.fulfill({ json: allowed })
  await expect(page.getByRole("dialog")).toBeVisible()
  await expect(page.getByLabel("Document draft")).toHaveValue("Unsaved work")
  await expect(page.locator("html")).toHaveAttribute("data-canvas-active", "true")
})
test("denial unmounts open documents and cannot be undone by a later successful focus check", async ({ page }) => {
  await ready(page)
  await page.getByRole("button", { name: "Open document", exact: true }).click()
  await page.route("**/__fixture/canvas-access", route => route.fulfill({ json: { allowed: false } }))
  await invalidate(page)
  await expect(page.getByRole("button", { name: "Open workspaces" })).toBeFocused()
  await expect(page.getByLabel("Canvas draft")).toHaveCount(0)
  await expect(page.getByLabel("Document draft")).toHaveCount(0)
  await expect(page.getByLabel("Sidebar catalog")).toBeEmpty()
  await expect(page.locator("body")).not.toHaveCSS("pointer-events", "none")
  let requests = 0
  await page.route("**/__fixture/canvas-access", route => { requests++; return route.fulfill({ json: allowed }) })
  await page.evaluate(() => { window.dispatchEvent(new Event("focus")); window.dispatchEvent(new Event("online")) })
  await expect(page.getByRole("button", { name: "Open workspaces" })).toBeVisible()
  expect(requests).toBe(0)
})
test("newer denial wins over an older success; foreign organization hints are ignored", async ({ page }) => {
  await ready(page)
  const checks: Route[] = []
  await page.route("**/__fixture/canvas-access", route => { checks.push(route) })
  await invalidate(page, "10000000-0000-4000-8000-000000000009")
  await expect(page.getByLabel("Canvas draft")).toBeVisible()
  expect(checks).toHaveLength(0)
  await invalidate(page)
  await expect.poll(() => checks.length).toBe(1)
  await invalidate(page)
  await expect.poll(() => checks.length).toBe(2)
  await checks[1].fulfill({ json: { allowed: false } })
  await expect(page.getByRole("button", { name: "Open workspaces" })).toBeVisible()
  await checks[0].fulfill({ json: allowed })
  await expect(page.getByLabel("Canvas draft")).toHaveCount(0)
})
test("hidden pages defer checks; visibility return requires fresh admission", async ({ page }) => {
  await ready(page)
  const checks: Route[] = []
  await page.route("**/__fixture/canvas-access", route => { checks.push(route) })
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" })
    document.dispatchEvent(new Event("visibilitychange"))
  })
  await expect(page.getByLabel("Canvas draft")).toHaveValue("Unsaved work")
  expect(checks).toHaveLength(0)
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" })
    document.dispatchEvent(new Event("visibilitychange"))
  })
  await expect.poll(() => checks.length).toBe(1)
  await checks[0].fulfill({ json: allowed })
  await expect(page.getByLabel("Canvas draft")).toHaveValue("Unsaved work")
})
test("transport failure retires content and a changed scope ignores old requests", async ({ page }) => {
  await ready(page)
  const checks: Route[] = []
  await page.route("**/__fixture/canvas-access", route => { checks.push(route) })
  await page.evaluate(() => window.dispatchEvent(new Event("focus")))
  await expect.poll(() => checks.length).toBe(1)
  await page.getByRole("button", { name: "Switch canvas" }).click()
  await expect.poll(() => checks.some(route => route.request().postDataJSON().canvasId !== null)).toBe(true)
  await checks[0].fulfill({ json: allowed })
  await expect(page.getByLabel("Canvas draft")).toHaveCount(0)
  for (const route of checks.slice(1)) await route.fulfill({ status: 503, body: "unavailable" })
  await expect(page.getByRole("button", { name: "Open workspaces" })).toBeFocused()
})
test("another tab can revoke the surface without focus; an actor or role change also retires it", async ({ page, context }) => {
  await ready(page)
  await page.route("**/__fixture/canvas-access", route => route.fulfill({ json: { ...allowed, role: "member", canEdit: false } }))
  const other = await context.newPage()
  await other.goto("/canvas-access.html")
  await other.evaluate(orgId => {
    const channel = new BroadcastChannel("coach-house:workspace-access-changed")
    channel.postMessage({ version: 1, orgId, source: "other-tab" }); channel.close()
  }, orgId)
  await expect(page.getByRole("button", { name: "Open workspaces" })).toBeVisible()
  await expect(page.getByLabel("Canvas draft")).toHaveCount(0)
})
test("a stalled check retires content; a different signed-in actor cannot inherit the old surface", async ({ page }) => {
  await ready(page)
  await page.clock.install()
  const checks: Route[] = []
  await page.route("**/__fixture/canvas-access", route => { checks.push(route) })
  await invalidate(page)
  await expect.poll(() => checks.length).toBe(1)
  await page.clock.fastForward(15001)
  await expect(page.getByRole("button", { name: "Open workspaces" })).toBeVisible()
  await checks[0].fulfill({ json: allowed })
  await expect(page.getByLabel("Canvas draft")).toHaveCount(0)
  await page.route("**/__fixture/canvas-access", route => route.fulfill({ json: { ...allowed, viewerId: orgId } }))
  await page.reload()
  await expect(page.getByRole("button", { name: "Open workspaces" })).toBeVisible()
  await expect(page.getByLabel("Canvas draft")).toHaveCount(0)
})

test("retains detached sources and revokes open content while workspace admission remains valid", async ({ page }) => {
  await ready(page)
  await page.getByRole("button", { name: "Detach sources" }).click()
  await page.getByRole("button", { name: "Open document", exact: true }).click()
  let checked: { sources?: { files: string[] } } | undefined
  await page.route("**/__fixture/canvas-access", route => {
    checked = route.request().postDataJSON()
    // Same valid canvas/actor; only its previously viewed source was revoked.
    return route.fulfill({ json: checked?.sources?.files.includes("10000000-0000-4000-8000-000000000070") ? { allowed: false } : allowed })
  })
  await invalidate(page)
  await expect(page.getByRole("button", { name: "Open workspaces" })).toBeFocused()
  expect(checked?.sources?.files).toEqual(["10000000-0000-4000-8000-000000000070"])
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.getByLabel("Canvas draft")).toHaveCount(0)
})
test("newly observed sources trigger a check; an older source snapshot cannot revive them", async ({ page }) => {
  await ready(page)
  const checks: Route[] = []
  await page.route("**/__fixture/canvas-access", route => { checks.push(route) })
  await invalidate(page)
  await expect.poll(() => checks.length).toBe(1)
  await page.getByRole("button", { name: "Add source" }).click()
  await expect.poll(() => checks.length).toBe(2)
  expect(checks[1].request().postDataJSON().sources.files).toEqual([
    "10000000-0000-4000-8000-000000000070", "10000000-0000-4000-8000-000000000071",
  ])
  await checks[1].fulfill({ json: { allowed: false } })
  await checks[0].fulfill({ json: allowed })
  await expect(page.getByRole("button", { name: "Open workspaces" })).toBeVisible()
  await expect(page.getByLabel("Canvas draft")).toHaveCount(0)
})
test("source registration does not poll or recheck on text edits and detachment", async ({ page }) => {
  await ready(page)
  let checks = 0
  await page.route("**/__fixture/canvas-access", route => { checks++; return route.fulfill({ json: allowed }) })
  await page.getByLabel("Canvas draft").fill("Keep my draft")
  await page.getByRole("button", { name: "Detach sources" }).click()
  await expect(page.getByLabel("Canvas draft")).toHaveValue("Keep my draft")
  expect(checks).toBe(0)
  await page.getByRole("button", { name: "Add source" }).click()
  await expect.poll(() => checks).toBe(1)
  await expect(page.getByLabel("Canvas draft")).toHaveValue("Keep my draft")
})


test("native library preview binds its canonical file and closes on revocation despite allowed canvas", async ({ page }) => {
  await page.route("**/api/account/organization-document-files?*", route => route.fulfill({ json: { url: "http://127.0.0.1:3187/__fixture/library-image" } }))
  await page.route("**/__fixture/library-image", route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="black"/></svg>' }))
  await ready(page)
  const checks: Route[] = []
  await page.route("**/__fixture/canvas-access", route => { checks.push(route) })
  await page.getByRole("button", { name: "Open library preview" }).click()
  await expect.poll(() => checks.length).toBeGreaterThan(0)
  const requests = checks.splice(0)
  for (const request of requests) {
    expect(request.request().postDataJSON().sources.files).toContain("10000000-0000-4000-8000-000000000072")
    expect(JSON.stringify(request.request().postDataJSON())).not.toMatch(/Library image|previewPath|content/)
    await request.fulfill({ json: allowed })
  }
  await expect(page.getByRole("img", { name: "Library image" })).toBeVisible()
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await page.getByRole("button", { name: "Open library preview" }).click()
  await expect.poll(() => checks.length).toBeGreaterThan(0)
  for (const request of checks.splice(0)) await request.fulfill({ json: { allowed: false } })
  await expect(page.getByRole("button", { name: "Open workspaces" })).toBeFocused()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.getByRole("img", { name: "Library image" })).toHaveCount(0)
})
test("editor source preserves drafts through successful checks and retains canonical ID after closing", async ({ page }) => {
  await ready(page)
  const checks: Route[] = []
  await page.route("**/__fixture/canvas-access", route => { checks.push(route) })
  await page.getByRole("button", { name: "Open core editor" }).click()
  await expect.poll(() => checks.length).toBeGreaterThan(0)
  for (const request of checks.splice(0)) {
    expect(request.request().postDataJSON().sources.documents).toEqual(["core-document-id"])
    await request.fulfill({ json: allowed })
  }
  await page.getByLabel("Core editor draft").fill("Unsaved core body")
  await page.evaluate(() => window.dispatchEvent(new Event("focus")))
  await expect.poll(() => checks.length).toBe(1)
  await checks.shift()!.fulfill({ json: allowed })
  await expect(page.getByLabel("Core editor draft")).toHaveValue("Unsaved core body")
  await page.getByRole("button", { name: "Close core editor" }).click()
  await expect(page.getByLabel("Core editor draft")).toHaveCount(0)
  await invalidate(page)
  await expect.poll(() => checks.length).toBe(1)
  expect(checks[0].request().postDataJSON().sources.documents).toEqual(["core-document-id"])
  await checks.shift()!.fulfill({ json: { allowed: false } })
  await expect(page.getByRole("button", { name: "Open workspaces" })).toBeVisible()
})
