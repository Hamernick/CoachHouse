import { readFile } from "node:fs/promises"
import { expect, test } from "@playwright/test"
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const version = { schemaVersion: 1, id: id(80), formId: id(20), revision: 1, title: "Sign up", description: "", definition: { questions: [{ id: id(90), type: "text", label: "Name", required: true }] } }
const now = "2026-11-01T12:00:00Z"
const response = { id: id(91), versionId: version.id, revision: 1, submittedAt: now, updatedAt: now, answers: [{ questionId: id(90), value: "Joan" }] }

test("exports the selected page with pending locks, keyboard access and a bounded download", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 950 }); await page.emulateMedia({ reducedMotion: "reduce" })
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message))
  await page.route("**/api/public/forms/intake", route => {
    const command = route.request().postDataJSON()
    if (command.action !== "responses") throw new Error(`Unexpected ${command.action}`)
    return route.fulfill({ json: { value: { version, permissions: { canCorrect: true, canManageAccess: false }, responses: [response], next: command.before ? null : response.id } } })
  })
  let finish: (() => void) | undefined
  await page.route("**/api/forms/responses/export?*", async route => {
    const url = new URL(route.request().url())
    expect(url.searchParams.get("versionId")).toBe(version.id)
    expect(url.searchParams.get("before")).toBe(response.id)
    await new Promise<void>(resolve => { finish = resolve })
    await route.fulfill({ contentType: "text/csv; charset=utf-8", body: '\ufeff"Name"\r\n"Joanne"\r\n' })
  })
  await page.goto("/?form-intake&direct-responses")
  const review = page.getByRole("region", { name: "Form responses" })
  await review.getByRole("button", { name: "Older responses" }).click()
  const button = review.getByRole("button", { name: "Export page (CSV)" })
  await expect(button).toBeEnabled()
  await button.focus(); await page.keyboard.press("Enter")
  await expect(button).toBeDisabled()
  await expect(review.getByRole("button", { name: "Refresh", exact: true })).toBeDisabled()
  await expect(review.getByRole("button", { name: "Edit Name" })).toBeDisabled()
  await expect.poll(() => Boolean(finish)).toBe(true)
  const downloadEvent = page.waitForEvent("download"); finish!()
  const download = await downloadEvent
  expect(download.suggestedFilename()).toBe(`responses-${version.id}-${response.id}.csv`)
  expect(await readFile((await download.path())!, "utf8")).toContain("Joanne")
  await expect(button).toBeEnabled()
  await expect(page.getByRole("status")).toHaveText("Page download started.")
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
})

test("failed export retries on demand; revoked access clears answers and never downloads", async ({ page }) => {
  let revoked = false; let requests = 0; const downloads: string[] = []
  page.on("download", value => downloads.push(value.suggestedFilename()))
  await page.route("**/api/public/forms/intake", route => {
    const command = route.request().postDataJSON()
    if (revoked || command.action === "viewer_offer") return route.fulfill({ status: 403, json: { error: "Response access is no longer available.", uncertain: false } })
    return route.fulfill({ json: { value: { version, permissions: { canCorrect: false, canManageAccess: false }, responses: [response], next: null } } })
  })
  await page.route("**/api/forms/responses/export?*", async route => {
    requests++; if (requests === 2) revoked = true
    await route.fulfill({ status: requests === 1 ? 503 : 403, json: { error: "private server detail" } })
  })
  await page.goto("/?form-intake&direct-responses")
  const button = page.getByRole("button", { name: "Export page (CSV)" })
  await button.click()
  await expect(page.getByRole("alert")).toHaveText("Unable to export this page. Try again.")
  await expect(button).toBeEnabled(); expect(requests).toBe(1)
  await button.click()
  await expect(button).toHaveCount(0)
  await expect(page.getByText("Joan", { exact: true })).toHaveCount(0)
  await expect(page.getByRole("alert")).toHaveText("Response access is no longer available.")
  expect(downloads).toEqual([]); expect(requests).toBe(2)
})
