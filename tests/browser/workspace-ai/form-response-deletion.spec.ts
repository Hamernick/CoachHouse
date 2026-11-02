import { expect, test } from "@playwright/test"
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const version = { schemaVersion: 1, id: id(80), formId: id(20), revision: 1, title: "Sign up", description: "", definition: { questions: [{ id: id(90), type: "text", label: "Name", required: true }] } }
const now = "2026-11-01T12:00:00Z"
const response = { id: id(91), versionId: id(80), revision: 1, submittedAt: now, updatedAt: now, answers: [{ questionId: id(90), value: "Joan" }] }
test("response deletion confirms intent, retries exactly and removes answers after reload", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 950 }); await page.emulateMedia({ reducedMotion: "reduce" })
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message))
  let deleted = false; let operation: unknown; let attempts = 0
  await page.route("**/api/public/forms/intake", async (route) => {
    const command = route.request().postDataJSON()
    if (command.action === "responses") return route.fulfill({ json: { value: { version, permissions: { canCorrect: true, canManageAccess: false, canDelete: true }, responses: deleted ? [] : [response], next: null } } })
    if (command.action === "delete_response") {
      attempts++
      expect(command.expectedRevision).toBe(1)
      if (attempts === 1) { operation = command; deleted = true; return route.abort("failed") }
      expect(command).toEqual(operation)
      return route.fulfill({ json: { value: { id: response.id, versionId: version.id, operationId: command.operationId, deletedAt: now } } })
    }
    throw new Error(`Unexpected ${command.action}`)
  })
  await page.goto("/?form-intake&direct-responses")
  const review = page.getByRole("region", { name: "Form responses" })
  await review.getByRole("button", { name: "Delete response", exact: true }).click()
  const confirmation = page.getByRole("group", { name: "Delete this response?" })
  await expect(confirmation.getByRole("button", { name: "Cancel" })).toBeFocused()
  expect(attempts).toBe(0)
  await confirmation.getByRole("button", { name: "Cancel" }).click()
  await expect(review.getByRole("button", { name: "Delete response", exact: true })).toBeFocused()
  await review.getByRole("button", { name: "Delete response", exact: true }).click()
  await confirmation.getByRole("button", { name: "Delete permanently" }).click()
  await expect(confirmation.getByRole("button", { name: "Retry deletion" })).toBeVisible()
  await expect(confirmation.getByRole("button", { name: "Cancel" })).toBeDisabled()
  await expect(review.getByRole("button", { name: "Refresh", exact: true })).toBeDisabled()
  await expect(review.getByText("Joan", { exact: true })).toHaveCount(0)
  await confirmation.getByRole("button", { name: "Retry deletion" }).click()
  await expect(review.getByRole("status")).toHaveText("Response deleted.")
  await expect(review.getByRole("button", { name: "Refresh", exact: true })).toBeFocused()
  await page.reload()
  await expect(review.getByText("No responses yet.")).toBeVisible()
  expect(attempts).toBe(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
})

test("deletion conflict requires review and permission loss clears private answers", async ({ page }) => {
  let revision = 1; let canDelete = true; let attempts = 0
  await page.route("**/api/public/forms/intake", async (route) => {
    const command = route.request().postDataJSON()
    if (command.action === "viewer_offer" || (!canDelete && command.action === "responses")) return route.fulfill({ status: 403, json: { error: "Access removed.", uncertain: false } })
    if (command.action === "responses") return route.fulfill({ json: { value: { version, permissions: { canCorrect: true, canManageAccess: false, canDelete }, responses: [{ ...response, revision }], next: null } } })
    if (command.action === "delete_response") {
      attempts++
      if (attempts === 1) { revision = 2; return route.fulfill({ status: 409, json: { error: "This response changed. Reload before saving again.", uncertain: false } }) }
      expect(command.expectedRevision).toBe(2); canDelete = false
      return route.fulfill({ status: 403, json: { error: "Access removed.", uncertain: false } })
    }
    throw new Error(`Unexpected ${command.action}`)
  })
  await page.goto("/?form-intake&direct-responses")
  const review = page.getByRole("region", { name: "Form responses" })
  await review.getByRole("button", { name: "Delete response", exact: true }).click()
  await page.getByRole("button", { name: "Delete permanently" }).click()
  await expect(page.getByRole("button", { name: "Delete permanently" })).toHaveCount(0)
  await page.getByRole("button", { name: "Review latest response" }).click()
  await expect(review.getByRole("button", { name: "Edit Name", exact: true })).toBeVisible()
  await review.getByRole("button", { name: "Delete response", exact: true }).click()
  await page.getByRole("button", { name: "Delete permanently" }).click()
  await expect(review.getByRole("button", { name: "Delete response", exact: true })).toHaveCount(0)
  await expect(review.getByRole("button", { name: "Edit Name", exact: true })).toHaveCount(0)
  await expect(review.getByText("Joan", { exact: true })).toHaveCount(0)
  expect(attempts).toBe(2)
})

test("a lost submission deleted before retry cannot become a fresh submission", async ({ page }) => {
  let attempts = 0; let identity = ""
  await page.route("**/api/public/forms/intake", async (route) => {
    const command = route.request().postDataJSON()
    if (command.action === "recoverable_forms") return route.fulfill({ json: { value: { forms: [], next: null } } })
    if (command.action === "versions") return route.fulfill({ json: { value: { versions: [], next: null } } })
    if (command.action === "submit") {
      attempts++
      if (attempts === 1) { identity = command.submission.id; return route.abort("failed") }
      expect(command.submission.id).toBe(identity)
      return route.fulfill({ status: 410, json: { error: "This submission was deleted. It cannot be submitted again.", uncertain: false } })
    }
    throw new Error(`Unexpected ${command.action}`)
  })
  await page.goto("/?form-intake")
  const form = page.getByRole("form", { name: "Submit form" })
  await form.getByRole("textbox", { name: /Name/ }).fill("Joan")
  await form.getByRole("button", { name: "Submit", exact: true }).click()
  await form.getByRole("button", { name: "Retry submission" }).click()
  await expect(page.getByRole("alert")).toHaveText("This submission was deleted. Contact the organization about your response.")
  await expect(form).toHaveCount(0)
  await expect(page.getByText("Response received. Thank you.")).toHaveCount(0)
  expect(attempts).toBe(2)
})
