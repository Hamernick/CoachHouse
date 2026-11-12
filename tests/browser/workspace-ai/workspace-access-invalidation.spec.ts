import { expect, test, type BrowserContext, type Page } from "@playwright/test"

const orgId = "00000000-0000-4000-8000-000000000020"
const eventName = "coach-house:workspace-access-changed"
const memberId = "99500000-0000-4000-8000-000000000002"
const item = { id: "document:mission", revision: "1", title: "Private mission", group: "Documents", available: true }
const access = { name: "Finance", deleted: false, restricted: true, canManage: true, revision: 1,
  members: [{ id: memberId, name: "Alice", owner: false, capability: "view" }] }

async function accessTab(context: BrowserContext, organizationId = orgId, uncertain = false) {
  const tab = await context.newPage()
  await tab.route("**/__fixture/workspace-access", route => {
    const writing = Boolean(route.request().postDataJSON().members)
    return route.fulfill({ json: writing && uncertain ? { error: "Unable to confirm the save.", code: "unavailable" } : { data: access } })
  })
  await tab.goto(`/?workspace-access&orgId=${organizationId}`)
  await tab.getByRole("button", { name: "Access", exact: true }).click()
  await tab.getByRole("combobox", { name: "Access for Alice" }).selectOption("none")
  return tab
}
async function save(tab: Page) {
  // Invoke the real dialog handler without activating the other tab: this proves
  // delivery without relying on focus/visibility to invalidate the picker.
  await tab.getByRole("button", { name: "Save access" }).evaluate((button: HTMLButtonElement) => button.click())
}
async function picker(page: Page) {
  await page.goto("/?planner&context")
  const input = page.getByRole("textbox", { name: "Plan an objective or search Particles" })
  await input.fill("Keep my draft @")
  await expect(page.getByRole("option", { name: "Private mission", exact: true })).toBeVisible()
  return input
}

for (const transport of ["broadcast", "storage"] as const) {
  test(`${transport}: other-tab access save clears an open picker without focus or draft loss`, async ({ page, context }) => {
    if (transport === "storage") await context.addInitScript(() => {
      Object.defineProperty(window, "BroadcastChannel", { value: undefined, configurable: true })
    })
    const admin = await accessTab(context)
    let calls = 0, revoked = false
    await page.route("**/__fixture/composer-context", route => {
      calls++
      return route.fulfill({ json: { items: revoked ? [] : [item], unavailable: [] } })
    })
    const input = await picker(page)
    const before = calls
    revoked = true
    await save(admin)
    await expect(page.getByRole("option", { name: "Private mission", exact: true })).toHaveCount(0)
    await expect.poll(() => calls).toBe(before + 1)
    await expect(input).toHaveText("Keep my draft @")
    await expect.poll(() => admin.evaluate(key => localStorage.getItem(key), eventName)).toBeNull()
    await admin.close()
  })
}

test("an uncertain save in another tab invalidates a closed picker without polling", async ({ page, context }) => {
  const admin = await accessTab(context, orgId, true)
  let calls = 0, revoked = false
  await page.route("**/__fixture/composer-context", route => {
    calls++
    return route.fulfill({ json: { items: revoked ? [] : [item], unavailable: [] } })
  })
  const input = await picker(page)
  await input.press("Escape")
  const before = calls
  revoked = true
  // Acknowledge delivery in the receiving tab before testing the closed cache.
  await page.evaluate(key => {
    const channel = new BroadcastChannel(key)
    channel.onmessage = () => { document.body.dataset.accessDelivered = "yes"; channel.close() }
  }, eventName)
  await save(admin)
  await expect(admin.getByRole("alert")).toContainText("Unable to confirm")
  await expect(page.locator("body")).toHaveAttribute("data-access-delivered", "yes")
  expect(calls).toBe(before)
  await input.fill("Keep my draft @m")
  await expect.poll(() => calls).toBe(before + 1)
  await expect(page.getByRole("option", { name: "Private mission", exact: true })).toHaveCount(0)
})

test("cross-tab messages ignore other organizations and malformed payloads", async ({ page, context }) => {
  const admin = await accessTab(context, "99500000-0000-4000-8000-000000000001")
  let calls = 0
  await page.route("**/__fixture/composer-context", route => {
    calls++
    return route.fulfill({ json: { items: [item], unavailable: [] } })
  })
  await picker(page)
  const before = calls
  await page.evaluate(key => {
    const channel = new BroadcastChannel(key)
    channel.onmessage = event => { if (event.data === "finished") { document.body.dataset.accessDelivered = "yes"; channel.close() } }
  }, eventName)
  await save(admin)
  await expect(admin.getByRole("dialog")).toHaveCount(0)
  await admin.evaluate(({ key, orgId }) => {
    const channel = new BroadcastChannel(key)
    for (const message of [null, { orgId }, { version: 1, orgId, source: 42 }, "finished"]) channel.postMessage(message)
    channel.close()
  }, { key: eventName, orgId })
  await expect(page.locator("body")).toHaveAttribute("data-access-delivered", "yes")
  expect(calls).toBe(before)
  await expect(page.getByRole("option", { name: "Private mission", exact: true })).toBeVisible()
})

test("unavailable cross-tab transports do not break saving or local invalidation", async ({ page, context }) => {
  await context.addInitScript(() => {
    Object.defineProperty(window, "BroadcastChannel", { value: undefined, configurable: true })
    Storage.prototype.setItem = () => { throw new DOMException("Storage unavailable", "SecurityError") }
  })
  const admin = await accessTab(context)
  await admin.evaluate(key => window.addEventListener(key, () => { document.body.dataset.accessDelivered = "yes" }), eventName)
  await save(admin)
  await expect(admin.getByRole("dialog")).toHaveCount(0)
  await expect(admin.locator("body")).toHaveAttribute("data-access-delivered", "yes")
  await expect(admin.getByRole("button", { name: "Access", exact: true })).toBeFocused()
  await admin.close()
  // The standard local invalidation listener also remains usable in this mode.
  let calls = 0
  await page.route("**/__fixture/composer-context", route => {
    return route.fulfill({ json: { items: ++calls === 1 ? [item] : [], unavailable: [] } })
  })
  await picker(page)
  await page.evaluate(({ key, orgId }) => window.dispatchEvent(new CustomEvent(key, { detail: { orgId } })), { key: eventName, orgId })
  await expect(page.getByRole("option", { name: "Private mission", exact: true })).toHaveCount(0)
  expect(calls).toBe(2)
})
