import { expect, test, type Page } from "@playwright/test"
const orgId = "99890000-0000-4000-8000-000000000001"
const eventName = "coach-house:workspace-access-changed"
const folder = { id: "99890000-0000-4000-8000-000000000011", name: "Finance" }
const library = {
  organizationId: orgId, canEdit: true, canUpload: true, canReviewAccess: true,
  state: { folders: [folder], placements: [] },
  files: [{ key: "upload:budget", name: "Private budget", source: "upload", url: "" }],
  organizationDocuments: { sections: [], policies: [], uploads: [{ kind: "budget", title: "Private budget", document: null }], drive: [], userId: orgId },
}
const empty = { ...library, files: [], state: { folders: [], placements: [] }, organizationDocuments: null }
const invalidate = (page: Page, organizationId = orgId) => page.evaluate(({ eventName, organizationId }) => {
  window.dispatchEvent(new CustomEvent(eventName, { detail: { orgId: organizationId } }))
}, { eventName, organizationId })
const focus = (page: Page) => page.evaluate(() => window.dispatchEvent(new Event("focus")))
async function finishLateResponse(page: Page, path: string, release: () => void) {
  const received = page.waitForResponse(response => response.url().endsWith(path))
  release()
  await (await received).finished()
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
}
async function open(page: Page) {
  await page.goto("/?folder-library")
  await page.getByRole("button", { name: "Open file Private budget" }).click()
  await expect(page.getByRole("dialog", { name: "Private budget" })).toBeVisible()
}
test("access loss clears the open document and rows, ignoring an older read", async ({ page }) => {
  let mode: "initial" | "delay" | "revoked" = "initial"
  let release!: () => void, waiting = false
  await page.route("**/__fixture/folder-library", async route => {
    const admitted = mode
    if (admitted === "delay") { waiting = true; await new Promise<void>(resolve => { release = resolve }) }
    await route.fulfill({ json: admitted === "revoked" ? empty : library })
  })
  await open(page)
  mode = "delay"
  await focus(page)
  await expect.poll(() => waiting).toBe(true)
  mode = "revoked"
  await invalidate(page)
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.getByText("No unfiled documents or files.")).toBeVisible()
  await finishLateResponse(page, "/__fixture/folder-library", release)
  await expect(page.getByRole("button", { name: "Open file Private budget" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Open folder Finance" })).toHaveCount(0)
})
test("focus revalidation retains an authorized editor, then closes it on denial with retry", async ({ page }) => {
  let denied = false, reads = 0
  await page.route("**/__fixture/folder-library", route => { reads++; return route.fulfill({ json: denied ? { error: "Access unavailable." } : library }) })
  await open(page)
  const before = reads
  await focus(page)
  await expect.poll(() => reads).toBeGreaterThan(before)
  await expect(page.getByRole("dialog", { name: "Private budget" })).toBeVisible()
  denied = true
  await focus(page)
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.getByRole("alert")).toContainText("Access unavailable.")
  denied = false
  await page.getByRole("button", { name: "Retry", exact: true }).click()
  await expect(page.getByRole("button", { name: "Open file Private budget" })).toBeVisible()
})
test("a late failed rename cannot restore revoked rows or its dialog", async ({ page }) => {
  let revoked = false, waiting = false, release!: () => void
  await page.route("**/__fixture/folder-library", route => route.fulfill({ json: revoked ? empty : library }))
  await page.route("**/__fixture/folder-library-mutation", async route => {
    waiting = true
    await new Promise<void>(resolve => { release = resolve })
    await route.fulfill({ json: { error: "Old save failed." } })
  })
  await page.goto("/?folder-library")
  await page.getByRole("button", { name: "Actions for Finance" }).click()
  await page.getByRole("menuitem", { name: "Rename" }).click()
  await page.getByRole("textbox", { name: "Folder name" }).fill("Old private name")
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await expect.poll(() => waiting).toBe(true)
  revoked = true
  await invalidate(page)
  await finishLateResponse(page, "/__fixture/folder-library-mutation", release)
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Open folder Finance" })).toHaveCount(0)
  await expect(page.getByText("Old save failed.")).toHaveCount(0)
})
test("another tab invalidates the open editor without focus; foreign org is ignored", async ({ page, context }) => {
  let revoked = false
  await page.route("**/__fixture/folder-library", route => route.fulfill({ json: revoked ? empty : library }))
  await open(page)
  await invalidate(page, "another-org")
  await expect(page.getByRole("dialog", { name: "Private budget" })).toBeVisible()
  const other = await context.newPage()
  await other.goto("/?folder-access")
  revoked = true
  await other.evaluate(({ eventName, orgId }) => {
    const channel = new BroadcastChannel(eventName)
    channel.postMessage({ version: 1, orgId, source: "fixture-admin" })
    channel.close()
  }, { eventName, orgId })
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Open file Private budget" })).toHaveCount(0)
})

test("an upload admitted before revocation cannot start follow-up folder moves", async ({ page }) => {
  let revoked = false, waiting = false, release!: () => void, moves = 0
  await page.route("**/__fixture/folder-library", route => route.fulfill({ json: revoked ? empty : library }))
  await page.route("**/__fixture/folder-library-mutation", route => { moves++; return route.fulfill({ json: { state: library.state } }) })
  await page.route("**/api/account/project-assets", async route => {
    waiting = true
    await new Promise<void>(resolve => { release = resolve })
    await route.fulfill({ json: { assets: [{ id: "new-file" }] } })
  })
  await page.goto("/?folder-library")
  await page.getByRole("button", { name: "Open folder Finance" }).click()
  await page.getByLabel("Upload files", { exact: true }).setInputFiles({ name: "draft.txt", mimeType: "text/plain", buffer: Buffer.from("local fixture") })
  await expect.poll(() => waiting).toBe(true)
  revoked = true
  await invalidate(page)
  await finishLateResponse(page, "/api/account/project-assets", release)
  await expect(page.getByText("Saving…", { exact: true })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Open folder Finance" })).toHaveCount(0)
  expect(moves).toBe(0)
})

test("an in-flight file URL cannot open after access invalidation", async ({ page, context }) => {
  let revoked = false, waiting = false, release!: () => void
  const linked = { ...library, files: [{ key: "organization:private", name: "Private link", source: "organization", url: "/__fixture/private-file-url" }] }
  await page.route("**/__fixture/folder-library", route => route.fulfill({ json: revoked ? empty : linked }))
  await page.route("**/__fixture/private-file-url", async route => {
    waiting = true
    await new Promise<void>(resolve => { release = resolve })
    await route.fulfill({ json: { url: "/must-not-open" } })
  })
  await page.goto("/?folder-library")
  await page.getByRole("button", { name: "Open file Private link" }).click()
  await expect.poll(() => waiting).toBe(true)
  revoked = true
  await invalidate(page)
  release()
  await expect.poll(() => context.pages().length).toBe(1)
  await expect(page.getByRole("button", { name: "Open file Private link" })).toHaveCount(0)
})

test("access review remains mounted after an uncertain save and returns focus safely", async ({ page }) => {
  let revoked = false
  const access = { name: "Finance", deleted: false, restricted: true, canManage: true, revision: 1,
    members: [{ id: "99890000-0000-4000-8000-000000000002", name: "Alice", owner: false, capability: "view" }] }
  await page.route("**/__fixture/folder-library", route => route.fulfill({ json: revoked ? empty : library }))
  await page.route("**/__fixture/folder-access", route => {
    const writing = Boolean(route.request().postDataJSON().members)
    if (writing) revoked = true
    return route.fulfill({ json: writing ? { error: "Unable to confirm the save.", code: "unavailable" } : { data: access } })
  })
  await page.goto("/?folder-library")
  await page.getByRole("button", { name: "Actions for Finance" }).click()
  await page.getByRole("menuitem", { name: "Access", exact: true }).click()
  await page.getByRole("combobox", { name: "Direct access for Alice" }).selectOption("none")
  await page.getByRole("button", { name: "Save access" }).click()
  await expect(page.getByRole("alert")).toContainText("Unable to confirm the save.")
  await expect(page.getByRole("combobox")).toHaveValue("none")
  await expect(page.getByRole("button", { name: "Open folder Finance" })).toHaveCount(0)
  await page.getByRole("button", { name: "Cancel", exact: true }).click()
  await page.getByRole("button", { name: "Discard changes" }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute("tabindex"))).toBe("-1")
})

test("successful folder deletion reloads authorized files and closes its confirmation", async ({ page }) => {
  let removed = false
  await page.route("**/__fixture/folder-library", route => route.fulfill({ json: removed ? { ...library, state: { folders: [], placements: [] } } : library }))
  await page.route("**/__fixture/folder-library-mutation", route => {
    expect(route.request().postDataJSON().change.type).toBe("remove")
    removed = true
    return route.fulfill({ json: { state: { folders: [], placements: [] } } })
  })
  await page.goto("/?folder-library")
  await page.getByRole("button", { name: "Actions for Finance" }).click()
  await page.getByRole("menuitem", { name: "Delete folder", exact: true }).click()
  await page.getByRole("button", { name: "Delete folder", exact: true }).click()
  await expect(page.getByRole("alertdialog")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Open folder Finance" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Open file Private budget" })).toBeVisible()
})
