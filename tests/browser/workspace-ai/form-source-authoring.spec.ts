import { expect, test } from "@playwright/test"
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const definition = { questions: [{ id: id(90), type: "text", label: "Name", required: true }] }
const version = { schemaVersion: 1, id: id(80), formId: id(20), revision: 1, title: "Published form", description: "", definition }
const source = { formId: id(20), revision: "a".repeat(64), title: "Saved draft", description: "", definition }

test("external editor accepts scope, edits a mobile form, retries exactly and reloads the saved draft", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 950 }); await page.emulateMedia({ reducedMotion: "reduce" })
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message))
  let accepted = false, attempts = 0; let saved = source
  const writes: unknown[] = []
  await page.route("**/api/public/forms/intake", async (route) => {
    const command = route.request().postDataJSON()
    if (command.action === "responses") return route.fulfill(accepted ? { json: { value: { version, permissions: { canCorrect: true, canEditDefinition: true, canManageAccess: false }, responses: [], next: null } } }
      : { status: 403, json: { error: "Form access required.", uncertain: false } })
    if (command.action === "viewer_offer") return route.fulfill({ json: { value: { invitationId: id(700), versionId: id(80), title: version.title, accepted: false, expiresAt: "2026-12-01T00:00:00Z", responsePermission: "edit" } } })
    if (command.action === "accept_viewer") { accepted = true; return route.fulfill({ json: { value: { invitationId: id(700), versionId: id(80), accepted: true } } }) }
    if (command.action === "read_form_source") return route.fulfill({ json: { value: saved } })
    expect(command.action).toBe("save_form_source"); writes.push(command)
    saved = { ...source, ...command.content, revision: "b".repeat(64) }
    if (++attempts === 1) return route.fulfill({ status: 503, json: { error: "Unable to confirm. Retry the same request.", uncertain: true } })
    return route.fulfill({ json: { value: { formId: id(20), operationId: command.operationId, revision: saved.revision } } })
  })
  await page.goto("/?form-intake&direct-responses")
  await expect(page.getByText(/Saving changes the draft/)).toBeVisible()
  await page.getByRole("button", { name: "Accept form editing" }).click()
  await page.getByRole("button", { name: "Edit form", exact: true }).focus(); await page.keyboard.press("Enter")
  await expect(page.getByRole("heading", { name: "Edit form" })).toBeFocused()
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("New draft title")
  await page.getByRole("textbox", { name: "Question 1 label" }).fill("Full name")
  await page.getByRole("button", { name: "Duplicate question 1", exact: true }).click()
  await page.getByRole("textbox", { name: "Question 2 label" }).fill("Contact name")
  await page.getByRole("button", { name: "Reorder question 2: Contact name", exact: true }).focus()
  await page.keyboard.press("Space"); await page.keyboard.press("ArrowUp"); await page.keyboard.press("Space")
  await expect(page.getByRole("button", { name: "Reorder question 1: Contact name", exact: true })).toBeFocused()
  await page.getByRole("button", { name: "Save form" }).click()
  await expect(page.getByRole("button", { name: "Duplicate question 1", exact: true })).toBeDisabled()
  await expect(page.getByRole("button", { name: "Reorder question 1: Contact name", exact: true })).toBeDisabled()
  await expect(page.getByRole("textbox", { name: "Title", exact: true })).toBeDisabled()
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeDisabled()
  await page.getByRole("button", { name: "Retry save" }).click()
  expect(writes[0]).toEqual(writes[1])
  await expect(page.getByRole("status")).toHaveText("Form saved. Published versions are unchanged.")
  await page.getByRole("button", { name: "Done", exact: true }).click()
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Published form")
  await expect(page.getByRole("button", { name: "Edit form", exact: true })).toBeFocused()
  await page.reload(); await page.getByRole("button", { name: "Edit form", exact: true }).click()
  await expect(page.getByRole("textbox", { name: "Title", exact: true })).toHaveValue("New draft title")
  await expect(page.getByRole("textbox", { name: "Question 1 label" })).toHaveValue("Contact name")
  expect(saved.definition.questions.map(question => question.label)).toEqual(["Contact name", "Full name"])
  expect(saved.definition.questions[1].id).toBe(id(90))
  expect(saved.definition.questions[0].id).not.toBe(id(90))
  expect(version.definition.questions).toEqual(definition.questions)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
})

test("conflicts require saved-form review; revocation preserves drafts and blocks saving", async ({ page }) => {
  let revision = source.revision, denied = false
  const writes: { expectedRevision: string; content: { title: string } }[] = []
  await page.route("**/api/public/forms/intake", async (route) => {
    const command = route.request().postDataJSON()
    if (command.action === "responses") return route.fulfill({ json: { value: { version, permissions: { canCorrect: true, canEditDefinition: true, canManageAccess: false }, responses: [], next: null } } })
    if (denied) return route.fulfill({ status: 403, json: { error: "Form editing is unavailable. Your draft is preserved.", uncertain: false } })
    if (command.action === "read_form_source") return route.fulfill({ json: { value: { ...source, title: revision === source.revision ? source.title : "Someone else's edit", revision } } })
    expect(command.action).toBe("save_form_source"); writes.push(command); revision = "b".repeat(64)
    return route.fulfill({ status: 409, json: { error: "This form changed. Review the saved form before saving.", uncertain: false } })
  })
  await page.goto("/?form-intake&direct-responses")
  await page.getByRole("button", { name: "Edit form", exact: true }).click()
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("My draft")
  await page.getByRole("button", { name: "Save form" }).click()
  await expect(page.getByRole("button", { name: "Save form" })).toBeDisabled()
  await page.getByRole("button", { name: "Review saved form" }).click()
  await expect(page.getByRole("heading", { name: "Saved: Someone else's edit" })).toBeVisible()
  await expect(page.getByRole("textbox", { name: "Title", exact: true })).toHaveValue("My draft")
  await page.getByRole("button", { name: "Keep my draft" }).click()
  await page.getByRole("button", { name: "Save form" }).click()
  expect(writes[1].expectedRevision).toBe(revision); expect(writes[1].content.title).toBe("My draft")
  denied = true
  await page.getByRole("button", { name: "Review saved form" }).click()
  await expect(page.getByRole("alert")).toHaveText("Form editing is unavailable. Your draft is preserved.")
  await expect(page.getByRole("textbox", { name: "Title", exact: true })).toHaveValue("My draft")
  await expect(page.getByRole("button", { name: "Save form" })).toBeDisabled()
  denied = false
  await page.getByRole("button", { name: "Review saved form" }).click()
  await page.getByRole("button", { name: "Use saved form" }).click()
  await expect(page.getByRole("textbox", { name: "Title", exact: true })).toHaveValue("Someone else's edit")
  await page.getByRole("button", { name: "Cancel", exact: true }).click()
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
})
