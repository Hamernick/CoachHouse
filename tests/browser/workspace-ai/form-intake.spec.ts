import { expect, test } from "@playwright/test"
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`
test("native intake preserves an uncertain submission and corrections survive conflict reload", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message))
  await page.setViewportSize({ width: 320, height: 950 }); await page.emulateMedia({ reducedMotion: "reduce" })
  const version = { schemaVersion: 1, id: id(80), formId: id(20), revision: 1, title: "Sign up", description: "", definition: { questions: [{ id: id(90), type: "text", label: "Name", required: true }] } }
  const now = "2026-11-01T12:00:00Z"
  let response: { id: string; versionId: string; revision: number; submittedAt: string; updatedAt: string; answers: { questionId: string; value: string }[] } | null = null
  let originalId = ""; let submissions = 0; let corrections = 0; let deny = false
  await page.route("**/api/public/forms/intake", async (route) => {
    const command = route.request().postDataJSON()
    const answer = (value: unknown) => route.fulfill({ json: { value } })
    if (command.action === "review_access") return answer({ formId: id(20), revision: 1, canGrantManage: true, reviewers: [] })
    if (command.action === "recoverable_forms") return answer({ forms: [], next: null })
    if (command.action === "versions") return answer({ versions: [{ id: id(80), title: "Sign up", revision: 1, createdAt: now }], next: null })
    if (deny) return route.fulfill({ status: 403, json: { error: "Access removed.", uncertain: false } })
    if (command.action === "responses") return answer({ version, permissions: { canCorrect: true, canManageAccess: true }, responses: response ? [response] : [], next: null })
    if (command.action === "submit") {
      submissions++
      if (submissions === 1) {
        originalId = command.submission.id
        response = { id: command.submission.id, versionId: command.submission.versionId, answers: command.submission.answers, revision: 1, submittedAt: now, updatedAt: now }
        return route.abort("failed") // committed; reply lost
      }
      expect(command.submission.id).toBe(originalId)
      return answer({ id: originalId, versionId: id(80), submittedAt: now })
    }
    if (command.action === "response") return answer(response)
    if (command.action === "correct") {
      corrections++
      if (corrections === 1 && response) {
        response = { ...response, revision: 2, answers: [{ questionId: id(90), value: "Joanna" }] }
        return route.fulfill({ status: 409, json: { error: "This response changed. Reload before saving again.", uncertain: false } })
      }
      expect(command.expectedRevision).toBe(2)
      if (response) response = { ...response, revision: 3, answers: [{ questionId: id(90), value: command.value }] }
      return answer(response)
    }
    throw new Error("Unexpected command")
  })
  await page.goto("/?form-intake")
  const form = page.getByRole("form", { name: "Submit form" })
  await form.getByRole("button", { name: "Submit", exact: true }).click()
  const input = form.getByRole("textbox", { name: /Name/ })
  await expect(input).toBeFocused()
  await expect(input).toHaveAttribute("aria-invalid", "true")
  await expect(input.locator("..")).toHaveAttribute("data-invalid", "")
  expect(await input.locator("..").evaluate(element => getComputedStyle(element).boxShadow)).not.toBe("none")
  await input.fill("Joan")
  await input.press("Enter")
  await expect(form.getByRole("button", { name: "Retry submission" })).toBeVisible()
  await expect(input).toHaveValue("Joan"); await expect(input).toBeDisabled()
  await form.getByRole("button", { name: "Retry submission" }).click()
  await expect(page.getByText("Response received. Thank you.")).toBeVisible()
  const review = page.getByRole("region", { name: "Form responses" })
  await review.getByRole("button", { name: "Refresh", exact: true }).click()
  await review.getByRole("button", { name: "Edit Name", exact: true }).click()
  const cell = review.getByRole("textbox", { name: /Name/ })
  await cell.fill("Joanne")
  await review.getByRole("button", { name: "Save", exact: true }).click()
  await expect(cell).toHaveValue("Joanne")
  await review.getByRole("button", { name: "Reload saved answer" }).click()
  await expect(review.getByText(/Saved answer: Joanna/)).toBeVisible()
  await expect(cell).toHaveValue("Joanne")
  await review.getByRole("button", { name: "Save", exact: true }).click()
  await expect(review.getByRole("button", { name: "Edit Name", exact: true })).toHaveText("Joanne")
  deny = true
  await review.getByRole("button", { name: "Refresh", exact: true }).click()
  await expect(review.getByRole("alert")).toHaveText("Access removed.")
  await expect(review.getByRole("button", { name: "Edit Name" })).toHaveCount(0)
  expect(submissions).toBe(2); expect(corrections).toBe(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
})

test("owner recovery confirms access and retries a lost receipt without a second operation", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 950 }); await page.emulateMedia({ reducedMotion: "reduce" })
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message))
  let recovered = false; let attempts = 0; let operation = ""
  await page.route("**/api/public/forms/intake", async (route) => {
    const command = route.request().postDataJSON()
    const answer = (value: unknown) => route.fulfill({ json: { value } })
    if (command.action === "review_access") return answer({ formId: id(20), revision: 1, canGrantManage: true, reviewers: [] })
    if (command.action === "recoverable_forms") return answer({ forms: recovered ? [] : [{ id: id(20), title: "Sign up", revision: 1 }], next: null })
    if (command.action === "versions") return answer({ versions: recovered ? [{ id: id(80), title: "Sign up", revision: 1, createdAt: "2026-11-01T12:00:00Z" }] : [], next: null })
    if (command.action === "recover_form") {
      attempts++
      if (attempts === 1) { recovered = true; operation = command.operationId; return route.abort("failed") }
      expect(command.operationId).toBe(operation)
      expect(command.expectedRevision).toBe(1)
      return answer({ formId: id(20), operationId: operation, revision: 2 })
    }
    if (command.action === "responses") return answer({ version: { schemaVersion: 1, id: id(80), formId: id(20), revision: 1, title: "Sign up", description: "", definition: { questions: [{ id: id(90), type: "text", label: "Name", required: true }] } }, permissions: { canCorrect: true, canManageAccess: true }, responses: [], next: null })
    throw new Error("Unexpected command")
  })
  await page.goto("/?form-intake")
  const recover = page.getByRole("button", { name: "Recover Sign up", exact: true })
  await recover.click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel", exact: true }).click()
  expect(attempts).toBe(0)
  await expect(recover).toBeFocused()
  await recover.press("Enter")
  await page.getByRole("alertdialog").getByRole("button", { name: "Recover access", exact: true }).click()
  await expect(page.getByRole("button", { name: "Retry recovery" })).toBeVisible()
  await expect(recover).toBeDisabled()
  await page.getByRole("button", { name: "Retry recovery" }).click()
  await expect(page.getByRole("status").filter({ hasText: "Form recovered." })).toBeVisible()
  await expect(page.getByRole("region", { name: "Form responses" })).toBeVisible()
  await expect(recover).toHaveCount(0)
  expect(attempts).toBe(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
})

test("manager grants and revokes one form's review access with exact uncertain retry", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 950 })
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message))
  let revision = 1; let granted = false; let operation = ""; let attempts = 0
  await page.route("**/api/public/forms/intake", async (route) => {
    const command = route.request().postDataJSON()
    const answer = (value: unknown) => route.fulfill({ json: { value } })
    if (command.action === "recoverable_forms") return answer({ forms: [], next: null })
    if (command.action === "versions") return answer({ versions: [{ id: id(80), title: "Sign up", revision: 1, createdAt: "2026-11-01T12:00:00Z" }], next: null })
    if (command.action === "responses") return answer({ version: { schemaVersion: 1, id: id(80), formId: id(20), revision: 1, title: "Sign up", description: "", definition: { questions: [{ id: id(90), type: "text", label: "Name", required: true }] } }, permissions: { canCorrect: true, canManageAccess: true }, responses: [], next: null })
    if (command.action === "review_access") return answer({ formId: id(20), revision, canGrantManage: true, reviewers: granted ? [{ id: id(4), email: "person4@example.org", role: "view" }] : [] })
    if (command.action === "grant_reviewer") {
      attempts++
      expect(command.email).toBe("person4@example.org")
      expect(command.expectedRevision).toBe(1)
      if (attempts === 1) { granted = true; revision = 2; operation = command.operationId; return route.abort("failed") }
      expect(command.operationId).toBe(operation)
      return answer({ formId: id(20), revision, operationId: operation })
    }
    if (command.action === "revoke_reviewer") {
      expect(command.memberId).toBe(id(4)); expect(command.expectedRevision).toBe(2)
      granted = false; revision = 3
      return answer({ formId: id(20), revision, operationId: command.operationId })
    }
    throw new Error("Unexpected access command")
  })
  await page.goto("/?form-intake")
  const access = page.getByRole("region", { name: "Response access" })
  const email = access.getByRole("textbox", { name: "Teammate email" })
  await email.fill("person4@example.org"); await email.press("Enter")
  await expect(access.getByRole("button", { name: "Retry access change" })).toBeVisible()
  await expect(email).toBeDisabled()
  await expect(page.getByRole("combobox").first()).toBeDisabled()
  await access.getByRole("button", { name: "Retry access change" }).click()
  await expect(access.getByText("person4@example.org", { exact: false })).toBeVisible()
  await expect(email).toBeFocused()
  await access.getByRole("button", { name: "Remove access for person4@example.org" }).click()
  await expect(access.getByText("No additional collaborators.")).toBeVisible()
  expect(attempts).toBe(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
})

test("reviewers see answers without edit/share controls and revoked reads clear them", async ({ page }) => {
  let revoked = false
  await page.route("**/api/public/forms/intake", async (route) => {
    const command = route.request().postDataJSON()
    const answer = (value: unknown) => route.fulfill({ json: { value } })
    if (command.action === "recoverable_forms") return answer({ forms: [], next: null })
    if (command.action === "versions") return answer({ versions: [{ id: id(80), title: "Sign up", revision: 1, createdAt: "2026-11-01T12:00:00Z" }], next: null })
    if (command.action === "responses") {
      if (revoked) return route.fulfill({ status: 403, json: { error: "Access removed.", uncertain: false } })
      return answer({ version: { schemaVersion: 1, id: id(80), formId: id(20), revision: 1, title: "Sign up", description: "", definition: { questions: [{ id: id(90), type: "text", label: "Name", required: true }] } }, permissions: { canCorrect: false, canManageAccess: false }, responses: [{ id: id(91), versionId: id(80), revision: 1, submittedAt: "2026-11-01T12:00:00Z", updatedAt: "2026-11-01T12:00:00Z", answers: [{ questionId: id(90), value: "Joan" }] }], next: null })
    }
    throw new Error("Reviewer attempted privileged command")
  })
  await page.goto("/?form-intake")
  const review = page.getByRole("region", { name: "Form responses" })
  await expect(review.getByText("Joan", { exact: true })).toBeVisible()
  await expect(review.getByText("Read-only access.", { exact: true })).toBeVisible()
  await expect(review.getByRole("button", { name: "Edit Name" })).toHaveCount(0)
  await expect(page.getByRole("region", { name: "Response access" })).toHaveCount(0)
  revoked = true
  await review.getByRole("button", { name: "Refresh", exact: true }).click()
  await expect(review.getByRole("alert")).toHaveText("Access removed.")
  await expect(review.getByText("Joan", { exact: true })).toHaveCount(0)
})

test("primary manager changes View to Manage, Edit and back through the existing access control", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 950 })
  let role = "view"; let revision = 1
  await page.route("**/api/public/forms/intake", async (route) => {
    const command = route.request().postDataJSON()
    const answer = (value: unknown) => route.fulfill({ json: { value } })
    if (command.action === "recoverable_forms") return answer({ forms: [], next: null })
    if (command.action === "versions") return answer({ versions: [{ id: id(80), title: "Sign up", revision: 1, createdAt: "2026-11-01T12:00:00Z" }], next: null })
    if (command.action === "responses") return answer({ version: { schemaVersion: 1, id: id(80), formId: id(20), revision: 1, title: "Sign up", description: "", definition: { questions: [{ id: id(90), type: "text", label: "Name", required: true }] } }, permissions: { canCorrect: true, canManageAccess: true }, responses: [], next: null })
    if (command.action === "review_access") return answer({ formId: id(20), revision, canGrantManage: true, reviewers: [{ id: id(4), email: "person4@example.org", role }] })
    if (command.action === "grant_reviewer") {
      expect(command.expectedRevision).toBe(revision)
      expect(command.email).toBe("person4@example.org")
      role = command.role; revision++
      return answer({ formId: id(20), revision, operationId: command.operationId })
    }
    throw new Error("Unexpected access command")
  })
  await page.goto("/?form-intake")
  const access = page.getByRole("region", { name: "Response access" })
  for (const next of ["Manage", "Edit", "View"]) {
    await access.getByRole("button", { name: "Change access for person4@example.org" }).click()
    await access.getByRole("combobox", { name: "Access", exact: true }).selectOption({ label: next })
    await access.getByRole("button", { name: "Save access" }).click()
    await expect(access.getByText(`· ${next}`, { exact: true })).toBeVisible()
  }
  expect(revision).toBe(4)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test("form editors correct answers without gaining access management", async ({ page }) => {
  let editable = true; let name = "Joan"; let revision = 1
  const version = { schemaVersion: 1, id: id(80), formId: id(20), revision: 1, title: "Sign up", description: "", definition: { questions: [{ id: id(90), type: "text", label: "Name", required: true }] } }
  const response = () => ({ id: id(91), versionId: id(80), revision, submittedAt: "2026-11-01T12:00:00Z", updatedAt: "2026-11-01T12:00:00Z", answers: [{ questionId: id(90), value: name }] })
  await page.route("**/api/public/forms/intake", async (route) => {
    const command = route.request().postDataJSON()
    const answer = (value: unknown) => route.fulfill({ json: { value } })
    if (command.action === "recoverable_forms") return answer({ forms: [], next: null })
    if (command.action === "versions") return answer({ versions: [{ id: id(80), title: "Sign up", revision: 1, createdAt: "2026-11-01T12:00:00Z" }], next: null })
    if (command.action === "responses") return answer({ version, permissions: { canCorrect: editable, canManageAccess: false }, responses: [response()], next: null })
    if (command.action === "response") return answer(response())
    if (command.action === "correct") { expect(command.expectedRevision).toBe(revision); name = command.value; revision++; return answer(response()) }
    throw new Error("Editor attempted access management")
  })
  await page.goto("/?form-intake")
  const review = page.getByRole("region", { name: "Form responses" })
  await review.getByRole("button", { name: "Edit Name", exact: true }).click()
  await review.getByRole("textbox", { name: /Name/ }).fill("Joanne")
  await review.getByRole("button", { name: "Save", exact: true }).click()
  await expect(review.getByRole("button", { name: "Edit Name" })).toHaveText("Joanne")
  await expect(page.getByRole("region", { name: "Response access" })).toHaveCount(0)
  editable = false
  await review.getByRole("button", { name: "Refresh", exact: true }).click()
  await expect(review.getByText("Read-only access.", { exact: true })).toBeVisible()
  await expect(review.getByRole("button", { name: "Edit Name" })).toHaveCount(0)
  await expect(review.getByText("Joanne", { exact: true })).toBeVisible()
})

test("scoped managers delegate Edit without Manage and lose controls when downgraded", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 950 })
  let manages = true; let granted = false; let revision = 1
  await page.route("**/api/public/forms/intake", async (route) => {
    const command = route.request().postDataJSON()
    const answer = (value: unknown) => route.fulfill({ json: { value } })
    if (command.action === "recoverable_forms") return answer({ forms: [], next: null })
    if (command.action === "versions") return answer({ versions: [{ id: id(80), title: "Sign up", revision: 1, createdAt: "2026-11-01T12:00:00Z" }], next: null })
    if (command.action === "responses") return answer({ version: { schemaVersion: 1, id: id(80), formId: id(20), revision: 1, title: "Sign up", description: "", definition: { questions: [{ id: id(90), type: "text", label: "Name", required: true }] } }, permissions: { canCorrect: true, canManageAccess: manages }, responses: [], next: null })
    if (command.action === "review_access") return answer({ formId: id(20), revision, canGrantManage: false, reviewers: granted ? [{ id: id(3), email: "person3@example.org", role: "edit" }] : [] })
    if (command.action === "grant_reviewer" || command.action === "revoke_reviewer") {
      expect(command.expectedRevision).toBe(revision)
      if (command.action === "grant_reviewer") { expect(command.role).toBe("edit"); expect(command.email).toBe("person3@example.org") }
      granted = command.action === "grant_reviewer"; revision++
      return answer({ formId: id(20), revision, operationId: command.operationId })
    }
    throw new Error("Unexpected delegated command")
  })
  await page.goto("/?form-intake")
  const access = page.getByRole("region", { name: "Response access" })
  await expect(access.getByText(/You can change only access you granted/)).toBeVisible()
  await access.getByRole("textbox", { name: "Teammate email" }).fill("person3@example.org")
  await expect(page.getByRole("option", { name: "Manage", exact: true })).toHaveCount(0)
  await access.getByRole("combobox", { name: "Access", exact: true }).selectOption({ label: "Edit" })
  await access.getByRole("button", { name: "Save access" }).click()
  await expect(access.getByText("· Edit", { exact: true })).toBeVisible()
  await access.getByRole("button", { name: "Remove access for person3@example.org" }).click()
  await expect(access.getByText("No access granted by you.")).toBeVisible()
  expect(revision).toBe(3)
  manages = false
  await page.getByRole("region", { name: "Form responses" }).getByRole("button", { name: "Refresh", exact: true }).click()
  await expect(access).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
