import sharp from "sharp"
import { test, expect } from "@playwright/test"
const shareId = (value: number) => `10000000-0000-4000-8000-${String(value).padStart(12, "0")}`
const state = (page: import("@playwright/test").Page) => page.evaluate(() => JSON.parse(localStorage.getItem("sharing-canvas-fixture")!))
async function action(page: import("@playwright/test").Page, name: string) {
  await page.getByRole("button", { name: "Page actions" }).click()
  await page.getByRole("menuitem", { name, exact: true }).click()
}
for (const main of [false, true]) {
  test(`${main ? "main" : "named"} canvas shares ordered saved content and preserves private edits`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`/?sharing${main ? "&main-canvas" : ""}`)
    const title = page.getByRole("textbox", { name: "Page title" })
    await title.fill("Community plan")
    const prefix = main ? "Main" : "Named"
    await page.getByRole("button", { name: `Reorder ${prefix} second`, exact: true }).press("ArrowUp")
    await page.getByRole("button", { name: "Preview", exact: true }).click()
    await expect(page.getByLabel("Public page preview")).toContainText(`${prefix} second`)
    await page.getByRole("button", { name: "Publish", exact: true }).click()
    await expect(page.getByRole("link", { name: "Open public page" })).toBeVisible()
    let saved = await state(page)
    expect(saved.pages[0].canvasId).toBe(main ? null : shareId(70))
    expect(saved.pages[0].publishedSnapshot.items.map((item: { id: string }) => item.id)).toEqual([shareId(21),shareId(20)])
    expect(saved.calls.every((call: { canvasId: string | null }) => call.canvasId === (main ? null : shareId(70)))).toBe(true)
    await title.fill("Private revised title")
    await action(page, "Save draft")
    await expect(page.getByRole("status")).toContainText("Draft saved.")
    expect((await state(page)).pages[0].publishedSnapshot.title).toBe("Community plan")
    await page.reload()
    await page.getByRole("combobox", { name: "Recent pages" }).click()
    await page.getByRole("option", { name: "Private revised title", exact: true }).click()
    await expect(title).toHaveValue("Private revised title")
    await page.getByRole("button", { name: "Preview", exact: true }).click()
    await page.getByRole("button", { name: "Update", exact: true }).click()
    await expect(page.getByRole("status")).toContainText("Published.")
    saved = await state(page)
    expect(saved.pages[0].publishedSnapshot.title).toBe("Private revised title")
    expect(saved.pages[0].revision).toBe(3)
    await action(page, "Make Private")
    await expect(page.getByRole("link", { name: "Open public page" })).toHaveCount(0)
    expect((await state(page)).pages[0].visibility).toBe("private")
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}
test("named canvas unconfirmed save retries the exact command without a duplicate page", async ({ page }) => {
  await page.goto("/?sharing&lost-save")
  await page.getByRole("textbox", { name: "Page title" }).fill("Recover my page")
  await action(page, "Save draft")
  await expect(page.getByRole("button", { name: "Retry save" })).toBeVisible()
  await page.getByRole("button", { name: "Retry save" }).click()
  await expect(page.getByRole("status")).toContainText("Draft saved.")
  const saved = await state(page)
  const commands = saved.calls.filter((call: { action: string }) => call.action === "commit")
  expect(commands).toHaveLength(2); expect(commands[0]).toEqual(commands[1])
  expect(commands[0].canvasId).toBe(shareId(70))
  expect(saved.pages).toHaveLength(1); expect(saved.pages[0].revision).toBe(1)
})


test("saved-page directory recovers an orphaned publication and retries revocation exactly", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/?sharing")
  await page.getByRole("textbox", { name: "Page title" }).fill("Keep my publication")
  await page.getByRole("button", { name: "Preview", exact: true }).click()
  await page.getByRole("button", { name: "Publish", exact: true }).click()
  await expect(page.getByRole("link", { name: "Open public page" })).toBeVisible()
  const original = (await state(page)).pages[0]
  // The recovery surface has no board/Particle loader. Keep only the saved page.
  await page.goto("/workspace/shared-pages")
  await page.getByRole("link", { name: "Keep my publication Public" }).click()
  await expect(page.getByRole("region", { name: "Manage shared page" }).locator(":scope > h2")).toBeVisible()
  await page.goto(`/workspace/shared-pages?page=${original.id}&lost-save`)
  await page.getByRole("button", { name: "Make private", exact: true }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Make private", exact: true }).click()
  await expect(page.getByRole("button", { name: "Retry request" })).toBeVisible()
  await expect(page.getByRole("button", { name: "All shared pages" })).toBeDisabled()
  await expect(page.getByRole("button", { name: "Reload", exact: true })).toBeDisabled()
  await page.getByRole("button", { name: "Retry request" }).click()
  await expect(page.getByRole("status")).toContainText("now private")
  await page.reload()
  await expect(page.getByText("Private page.", { exact: false })).toBeVisible()
  await expect(page.getByRole("link", { name: "Open public page" })).toHaveCount(0)
  const saved = await state(page)
  expect(saved.pages).toHaveLength(1)
  expect(saved.pages[0]).toMatchObject({ id: original.id, canvasId: original.canvasId, linkId: original.linkId, revision: 2, publishedSnapshot: original.publishedSnapshot })
  const commands = saved.calls.filter((call: { intent?: string }) => call.intent === "make_private")
  expect(commands).toHaveLength(2); expect(commands[0]).toEqual(commands[1])
  const recovery = saved.calls.slice(saved.calls.findIndex((call: { action: string }) => call.action === "directory"))
  expect(recovery.some((call: { action: string }) => call.action === "load" || call.action === "review")).toBe(false)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})


test("public previews hydrate into local event time and retain readable controls at enlarged mobile text", async ({ browser }) => {
  const context = await browser.newContext({ locale: "fr-FR", timezoneId: "America/Chicago", viewport: { width: 320, height: 840 }, reducedMotion: "reduce" })
  const page = await context.newPage()
  const errors: string[] = []
  page.on("pageerror", error => errors.push(error.message))
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()) })
  try {
    await page.goto("http://127.0.0.1:3187/?public-page")
    await expect(page.locator("time").first()).toContainText("15:00")
    await expect(page.locator("time").first()).toContainText("America/Chicago")
    await expect(page.locator("time").first()).toContainText("oct.")
    await expect(page.locator("time").first()).toHaveAttribute("datetime", "2026-10-20T20:00:00Z")
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1)
    await expect(page.getByRole("article", { name: "Community dinner" })).toHaveCount(2)
    expect(await page.evaluate(() => {
      const ids = [...document.querySelectorAll("[id]")].map(element => element.id)
      return ids.length === new Set(ids).size
    })).toBe(true)
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%" })
    await expect(page.getByRole("link", { name: "Open in Google Drive" }).first()).toBeVisible()
    expect(await page.evaluate(() => {
      const link = document.querySelector<HTMLAnchorElement>('a[href^="https://docs.google.com"]')!
      const body = link.closest('[data-workspace-node-part="body"]')!.getBoundingClientRect()
      const bounds = link.getBoundingClientRect()
      return document.documentElement.scrollWidth <= innerWidth && bounds.left >= body.left && bounds.right <= body.right && link.scrollHeight <= link.clientHeight
    })).toBe(true)
    await page.keyboard.press("Tab")
    await expect(page.getByRole("link", { name: "Open in Google Drive" }).first()).toBeFocused()
    expect(errors.filter(message => /hydration|did not match|server rendered|uncaught/i.test(message))).toEqual([])
  } finally { await context.close() }
})


test("reviewed images render at mobile width and fail visibly after their audience is revoked", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 840 })
  const image = await sharp({ create: { width: 600, height: 300, channels: 3, background: "#287265" } }).webp().toBuffer()
  let revoked = false
  const requested: string[] = []
  await page.route(/\/api\/(?:account\/workspace-page-image|public\/workspace-page-assets\/)/, async (route) => {
    requested.push(route.request().url())
    const publicImage = new URL(route.request().url()).searchParams.get("audience") === "public"
    await route.fulfill(revoked && publicImage ? { status: 404, body: "", headers: { "cache-control": "no-store" } }
      : { status: 200, contentType: "image/webp", body: image, headers: { "cache-control": "no-store" } })
  })
  await page.goto("/?public-images")
  for (const name of ["Review", "Public", "Invited"]) {
    const photo = page.getByRole("region", { name, exact: true }).getByRole("img", { name: "Workshop participants" })
    await photo.scrollIntoViewIfNeeded()
    await expect.poll(() => photo.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(600)
    expect(await photo.evaluate(element => element.getBoundingClientRect().right <= innerWidth)).toBe(true)
  }
  expect(requested.some(url => url.includes("/api/account/workspace-page-image"))).toBe(true)
  expect(requested.some(url => url.includes("audience=guest"))).toBe(true)
  revoked = true
  await page.reload()
  const publicRegion = page.getByRole("region", { name: "Public", exact: true })
  await publicRegion.scrollIntoViewIfNeeded()
  await expect(publicRegion.getByRole("status")).toContainText("Image unavailable")
  const guest = page.getByRole("region", { name: "Invited", exact: true }).getByRole("img")
  await guest.scrollIntoViewIfNeeded()
  await expect.poll(() => guest.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(600)
})


test("reviewed primary logos preserve audience access and recover after a newly reviewed logo", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 840 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  const image = await sharp({ create: { width: 100, height: 50, channels: 3, background: "#287265" } }).webp().toBuffer()
  let revoked = false
  const requests: string[] = []
  await page.route(/\/api\/(?:account\/workspace-page-image|public\/workspace-page-assets\/)/, async route => {
    const url = new URL(route.request().url())
    requests.push(url.toString())
    const oldPublicLogo = url.pathname.endsWith(shareId(61)) && url.searchParams.get("audience") === "public"
    await route.fulfill(revoked && oldPublicLogo ? { status: 404, body: "" }
      : { status: 200, contentType: "image/webp", body: image, headers: { "cache-control": "no-store" } })
  })
  await page.goto("/?public-images")
  await page.addStyleTag({ content: "html { font-size: 200% }" })
  for (const name of ["Review", "Public", "Invited"]) {
    const logo = page.getByRole("region", { name, exact: true }).locator("header img")
    await expect.poll(() => logo.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(100)
    expect(await logo.evaluate(element => element.getBoundingClientRect().right <= innerWidth)).toBe(true)
  }
  expect(requests.some(url => url.includes("logo=primary"))).toBe(true)
  await page.screenshot({ path: test.info().outputPath("reviewed-logo-mobile.png"), fullPage: true })
  revoked = true
  await page.reload()
  const publicHeader = page.getByRole("region", { name: "Public", exact: true }).locator("header")
  await expect(publicHeader.locator("img")).toHaveCount(0)
  await expect(publicHeader.locator("span[aria-hidden]")).toHaveText("CO")
  const guestLogo = page.getByRole("region", { name: "Invited", exact: true }).locator("header img")
  await expect.poll(() => guestLogo.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(100)
  await page.keyboard.press("Tab")
  await expect(page.getByRole("button", { name: "Review another logo" })).toBeFocused()
  await page.keyboard.press("Enter")
  await expect.poll(() => publicHeader.locator("img").evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(100)
  await expect(publicHeader.locator("img")).toHaveAttribute("src", new RegExp(shareId(62)))
})

test("reviewed documents remain inert, readable on mobile and recheck access when reopened", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 840 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  const text = '# Guide\n<script>window.injected = true</script>\n![tracker](https://private.invalid/image)\n=IMPORTXML("https://private.invalid")\n日本語 — العربية'
  let revoked = false
  const requests: string[] = []
  await page.route(/\/api\/(?:account\/workspace-page-document|public\/workspace-page-documents\/)/, async route => {
    requests.push(route.request().url())
    const publicRequest = new URL(route.request().url()).searchParams.get("audience") === "public"
    await route.fulfill({ status: revoked && publicRequest ? 404 : 200, contentType: "text/plain; charset=utf-8",
      body: revoked && publicRequest ? "" : text, headers: { "cache-control": "no-store" } })
  })
  await page.goto("/?public-documents")
  expect(requests).toHaveLength(0)
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%" })
  for (const name of ["Review", "Public", "Invited"]) {
    const region = page.getByRole("region", { name, exact: true })
    const read = region.getByRole("button", { name: "Read document" })
    await read.focus(); await page.keyboard.press("Enter")
    await expect(region.getByRole("region", { name: /contents/ })).toHaveText(text)
    expect(await region.locator("pre").evaluate(element => element.scrollWidth <= element.clientWidth && element.getBoundingClientRect().right <= innerWidth)).toBe(true)
    await expect(region.locator("img, iframe, script, a")).toHaveCount(0)
  }
  expect(await page.evaluate(() => "injected" in window)).toBe(false)
  expect(requests.some(url => url.includes("/api/account/workspace-page-document"))).toBe(true)
  expect(requests.some(url => url.includes("audience=guest"))).toBe(true)
  const publicRegion = page.getByRole("region", { name: "Public", exact: true })
  await publicRegion.getByRole("button", { name: "Close document" }).click()
  revoked = true
  await publicRegion.getByRole("button", { name: "Read document" }).click()
  await expect(publicRegion.getByRole("status")).toHaveText("Document unavailable.")
  await expect(publicRegion.locator("pre")).toHaveCount(0)
  revoked = false
  await publicRegion.getByRole("button", { name: "Retry" }).click()
  await expect(publicRegion.getByRole("region", { name: /contents/ })).toHaveText(text)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
