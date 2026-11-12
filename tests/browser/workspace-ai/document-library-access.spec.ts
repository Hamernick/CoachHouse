import { expect, test, type Page, type Route } from "@playwright/test"
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6oX8AAAAASUVORK5CYII=", "base64")
const image = { contentType: "image/png", body: png }
const file = { id: "file-1", name: "Private image", mimeType: "image/png", sizeBytes: 4, deletedAt: null, createdAt: "2026-11-08T00:00:00Z", updatedAt: "2026-11-08T00:00:00Z" }
const native = { hasStorageAccess: true, files: [file], quota: { usedBytes: 4, limitBytes: 1000 } }
const drive = { ok: true, documents: [{ id: file.id, name: file.name, mimeType: file.mimeType, webViewLink: "https://drive.google.com/file/d/selected/view", modifiedAt: file.updatedAt, status: "available" }] }
const invalidate = (page: Page, orgId = "current-org") => page.evaluate(orgId => window.dispatchEvent(new CustomEvent("coach-house:workspace-access-changed", { detail: { orgId } })), orgId)
const focus = (page: Page) => page.evaluate(() => window.dispatchEvent(new Event("focus")))
const visibleImage = (page: Page) => page.getByRole("img", { name: "Private image preview", exact: true })
const notes = { notes: [{ id: "note:module-1", title: "Private note", summary: "Confidential note preview", updatedAt: file.updatedAt, source: { kind: "module_note", moduleId: "module-1" } }] }
const visibleContent = (page: Page, kind: string) => kind === "Notes" ? page.getByText("Private note", { exact: true }) : visibleImage(page)
const listPath = (kind: string) => kind === "Notes" ? "**/api/account/workspace-notes?**" : kind === "Drive" ? "**/api/integrations/google-drive/documents?**" : /\/api\/account\/organization-document-files\?organizationId=/
const payload = (kind: string) => kind === "Notes" ? notes : kind === "Drive" ? drive : native
async function ready(page: Page, kind: string) {
  await page.addInitScript(() => {
    const original = URL.revokeObjectURL
    URL.revokeObjectURL = url => { document.documentElement.setAttribute("data-revoked-url", url); original.call(URL, url) }
  })
  await page.route("**/api/integrations/google-drive/connection?**", route => route.fulfill({ json: { ok: true, connection: { connected: true } } }))
  await page.route("**/api/integrations/google-drive/documents/*/preview?**", route => route.fulfill(image))
  await page.route("**/api/account/organization-document-files?id=**", route => route.fulfill({ json: { url: "/fixture-image" } }))
  await page.route("**/fixture-image", route => route.fulfill(image))
  await page.route(listPath(kind), route => route.fulfill({ json: payload(kind) }))
  await page.goto(`/document-library-access.html?kind=${kind}`)
  await expect(visibleContent(page, kind)).toBeVisible()
  if (kind !== "Notes") await expect.poll(() => visibleContent(page, kind).evaluate(node => (node as HTMLImageElement).naturalWidth)).toBe(1)
}
for (const kind of ["Native", "Drive", "Notes"]) {
  test(`${kind}: focus preserves rows; current denial removes names and thumbnails`, async ({ page }) => {
    await ready(page, kind)
    await page.locator("article").evaluate(node => node.setAttribute("data-preserved", "yes"))
    const pending: Route[] = []
    await page.route(listPath(kind), route => { pending.push(route) })
    await focus(page); await focus(page)
    await expect.poll(() => pending.length).toBe(1)
    const query = new URL(pending[0].request().url()).searchParams
    expect(query.get("organizationId")).toBe("current-org")
    expect(query.get("expectedUserId")).toBe("current-user")
    await expect(page.locator('[data-preserved="yes"]')).toBeVisible()
    await pending[0].fulfill({ json: payload(kind) })
    await expect(page.locator('[data-preserved="yes"]')).toBeVisible()
    await focus(page)
    await expect.poll(() => pending.length).toBe(2)
    await pending[1].fulfill({ status: 403, json: { error: "Denied" } })
    await expect(page.locator("article")).toHaveCount(0)
    await expect(page.getByRole("status")).toContainText("Documents unavailable")
  })
  test(`${kind}: matching invalidation clears immediately and cannot revive an obsolete response`, async ({ page }) => {
    await ready(page, kind)
    const pending: Route[] = []
    await page.route(listPath(kind), route => { pending.push(route) })
    await invalidate(page, "other-org")
    expect(pending).toHaveLength(0)
    await focus(page)
    await expect.poll(() => pending.length).toBe(1)
    await invalidate(page)
    await expect(page.locator("article")).toHaveCount(0)
    await expect.poll(() => pending.length).toBe(2)
    await pending[1].fulfill({ json: kind === "Notes" ? { notes: [] } : kind === "Drive" ? { ok: true, documents: [] } : { ...native, files: [], quota: { ...native.quota, usedBytes: 0 } } })
    await pending[0].fulfill({ json: payload(kind) }).catch(() => {})
    await expect(page.locator("article")).toHaveCount(0)
    await page.getByRole("button", { name: "Retry", exact: true }).click()
    await expect.poll(() => pending.length).toBe(3)
    await pending[2].fulfill({ json: payload(kind) })
    await expect(visibleContent(page, kind)).toBeVisible()
  })
  test(`${kind}: hidden windows clear rows, suspend reads, and recheck on return`, async ({ page }) => {
    await ready(page, kind)
    const pending: Route[] = []
    await page.route(listPath(kind), route => { pending.push(route) })
    const active = (value: boolean) => page.evaluate(value => window.dispatchEvent(new CustomEvent("fixture-window-active", { detail: value })), value)
    await active(false)
    await expect(page.locator("article")).toHaveCount(0)
    await focus(page); await invalidate(page)
    expect(pending).toHaveLength(0)
    await active(true)
    await expect.poll(() => pending.length).toBe(1)
    await expect(page.locator("article")).toHaveCount(0)
    await pending[0].fulfill({ json: payload(kind) })
    await expect(visibleContent(page, kind)).toBeVisible()
    await page.evaluate(() => window.dispatchEvent(new Event("pagehide")))
    await expect(page.locator("article")).toHaveCount(0)
    await page.evaluate(() => window.dispatchEvent(new Event("pageshow")))
    await expect.poll(() => pending.length).toBe(2)
    await pending[1].fulfill({ status: 401, json: {} })
    await expect(page.getByRole("status")).toBeVisible()
  })
  test(`${kind}: malformed data and stalled reads evict content; retry recovers`, async ({ page }) => {
    await ready(page, kind)
    await page.clock.install()
    const pending: Route[] = []
    await page.route(listPath(kind), route => { pending.push(route) })
    await focus(page)
    await expect.poll(() => pending.length).toBe(1)
    await page.clock.fastForward(15001)
    await expect(page.locator("article")).toHaveCount(0)
    await expect(page.getByRole("status")).toBeVisible()
    await pending[0].fulfill({ json: payload(kind) }).catch(() => {})
    await expect(page.locator("article")).toHaveCount(0)
    await page.getByRole("button", { name: "Retry", exact: true }).click()
    await expect.poll(() => pending.length).toBe(2)
    await pending[1].fulfill({ json: { files: [], documents: [] } })
    await expect(page.getByRole("status")).toBeVisible()
    await page.getByRole("button", { name: "Retry", exact: true }).click()
    await expect.poll(() => pending.length).toBe(3)
    await pending[2].fulfill({ json: payload(kind) })
    await expect(visibleContent(page, kind)).toBeVisible()
  })
}
test("Drive thumbnails release authenticated blobs when preview access alone is revoked", async ({ page }) => {
  await ready(page, "Drive")
  const oldUrl = await visibleImage(page).getAttribute("src")
  expect(oldUrl).toMatch(/^blob:/)
  await page.route("**/api/integrations/google-drive/documents/*/preview?**", route => route.fulfill({ status: 403, json: {} }))
  await focus(page)
  await expect(visibleImage(page)).toHaveCount(0)
  await expect(page.locator("article")).toHaveCount(1)
  await expect(page.locator("html")).toHaveAttribute("data-revoked-url", oldUrl!)
})
test("a delayed upload response cannot repopulate a revoked list", async ({ page }) => {
  await ready(page, "Native")
  let upload: Route | undefined
  await page.route(listPath("Native"), route => {
    if (route.request().method() === "POST") upload = route
    else void route.fulfill({ status: 403, json: {} })
  })
  await page.getByRole("button", { name: "Upload", exact: true }).click()
  await expect.poll(() => upload).toBeTruthy()
  await invalidate(page)
  await expect(page.getByRole("status")).toBeVisible()
  await upload!.fulfill({ json: { file: { ...file, id: "file-2", name: "Uploaded image.png" } } })
  await expect(page.getByRole("button", { name: "Upload", exact: true })).toBeDisabled()
  await expect(page.locator("article")).toHaveCount(0)
})

test("Notes: account and organization changes discard old metadata and late responses", async ({ page }) => {
  await ready(page, "Notes")
  const pending: Route[] = []
  await page.route(listPath("Notes"), route => { pending.push(route) })
  await focus(page)
  await expect.poll(() => pending.length).toBe(1)
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("fixture-note-scope", { detail: { organizationId: "next-org", userId: "next-user" } })))
  await expect(page.locator("article")).toHaveCount(0)
  await expect.poll(() => pending.length).toBe(2)
  const query = new URL(pending[1].request().url()).searchParams
  expect(query.get("organizationId")).toBe("next-org")
  expect(query.get("expectedUserId")).toBe("next-user")
  await pending[0].fulfill({ json: notes }).catch(() => {})
  await pending[1].fulfill({ json: { notes: [] } })
  await expect(page.locator("article")).toHaveCount(0)
})
test("Notes: source updates evict the old summary before reloading", async ({ page }) => {
  await ready(page, "Notes")
  const pending: Route[] = []
  await page.route(listPath("Notes"), route => { pending.push(route) })
  await page.evaluate(() => window.dispatchEvent(new Event("coach-house:notes-changed")))
  await expect(page.locator("article")).toHaveCount(0)
  await expect.poll(() => pending.length).toBe(1)
  await pending[0].fulfill({ json: { notes: [{ ...notes.notes[0], summary: "Current preview" }] } })
  await expect(page.getByText("Current preview", { exact: true })).toBeVisible()
  await expect(page.getByText("Confidential note preview", { exact: true })).toHaveCount(0)
})
