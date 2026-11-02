import { expect, test } from "@playwright/test"
import type { FormResponse } from "../../../src/features/organization-forms"
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`

test("grid authoring preserves axis IDs through save/reopen and type changes, with mobile required-row preview", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message))
  await page.setViewportSize({ width: 320, height: 1000 }); await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/?form-controls")
  await page.getByRole("combobox", { name: "Question 1 type" }).selectOption({ label: "Multiple choice grid" })
  await page.getByRole("textbox", { name: "Row 1", exact: true }).fill("Monday")
  await page.getByRole("textbox", { name: "Row 2", exact: true }).fill("Tuesday")
  await page.getByRole("textbox", { name: "Column 1", exact: true }).fill("Morning")
  await page.getByRole("textbox", { name: "Column 2", exact: true }).fill("Afternoon")
  const initial = JSON.parse(await page.getByLabel("Current definition").textContent() ?? "{}").questions[0]
  await page.getByRole("button", { name: "Add row", exact: true }).click()
  await page.getByRole("textbox", { name: "Row 3", exact: true }).fill("Wednesday")
  await page.getByRole("button", { name: "Remove row 3", exact: true }).click()
  await page.getByRole("button", { name: "Add column", exact: true }).click()
  await page.getByRole("textbox", { name: "Column 3", exact: true }).fill("Evening")
  await page.getByRole("button", { name: "Remove column 3", exact: true }).click()
  await page.getByRole("button", { name: "Save draft", exact: true }).click()
  await page.getByRole("button", { name: "Reopen draft", exact: true }).click()
  expect(JSON.parse(await page.getByLabel("Current definition").textContent() ?? "{}").questions[0]).toEqual(initial)
  await page.getByRole("button", { name: "Preview", exact: true }).click()
  const grid = page.getByRole("group", { name: "Location", exact: true })
  await page.getByRole("button", { name: "Check answers" }).click()
  await expect(grid).toBeFocused(); await expect(grid.getByRole("radiogroup", { name: "Monday", exact: true })).toHaveAttribute("aria-invalid", "true")
  const monday = grid.getByRole("radiogroup", { name: "Monday", exact: true })
  await monday.getByRole("radio", { name: "Morning", exact: true }).focus()
  await page.keyboard.press("Space")
  await expect(monday.getByRole("radio", { name: "Morning", exact: true })).toBeChecked()
  await page.getByRole("button", { name: "Check answers" }).click()
  await expect(page.getByText("Answer Tuesday.", { exact: true })).toBeVisible()
  await grid.getByRole("radiogroup", { name: "Tuesday", exact: true }).getByRole("radio", { name: "Afternoon", exact: true }).click()
  await page.getByLabel(/^Day\s*\(required\)$/).fill("2028-02-29")
  await page.getByLabel(/^Time\s*\(required\)$/).fill("12:30")
  await page.getByRole("button", { name: "Check answers" }).click()
  await expect(page.getByText("Answers look good. Nothing was submitted.")).toBeVisible()
  await grid.getByRole("button", { name: "Clear Monday", exact: true }).click()
  await expect(monday.getByRole("radio", { name: "Morning", exact: true })).not.toBeChecked()
  await page.getByRole("button", { name: "Edit", exact: true }).click()
  await page.getByRole("combobox", { name: "Question 1 type" }).selectOption({ label: "Checkbox grid" })
  await page.getByRole("button", { name: "Save draft", exact: true }).click()
  await page.getByRole("button", { name: "Reopen draft", exact: true }).click()
  expect(JSON.parse(await page.getByLabel("Current definition").textContent() ?? "{}").questions[0]).toEqual({ ...initial, type: "checkbox_grid" })
  await page.getByRole("button", { name: "Preview", exact: true }).click()
  const row = page.getByRole("group", { name: "Monday", exact: true })
  await row.getByRole("checkbox", { name: "Morning", exact: true }).click()
  await row.getByRole("checkbox", { name: "Afternoon", exact: true }).click()
  await expect(row.getByRole("checkbox", { name: "Morning", exact: true })).toBeChecked()
  await expect(row.getByRole("checkbox", { name: "Afternoon", exact: true })).toBeChecked()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole("button", { name: "Edit", exact: true }).click()
  await page.getByRole("button", { name: "Toggle editing lock" }).click()
  await expect(page.getByRole("textbox", { name: "Row 1", exact: true })).toBeDisabled()
  await expect(page.getByRole("button", { name: "Add column", exact: true })).toBeDisabled()
  expect(errors).toEqual([])
})

test("public grids submit stable IDs, retry exactly and retain staff corrections after reload", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message))
  await page.setViewportSize({ width: 320, height: 950 }); await page.emulateMedia({ reducedMotion: "reduce" })
  const version = { schemaVersion: 1, id: id(80), formId: id(20), revision: 1, title: "Availability", description: "", definition: { questions: [
    { id: id(90), type: "multiple_choice_grid", label: "Availability", required: true,
      rows: [{ id: id(100), label: "Monday" }, { id: id(101), label: "Tuesday" }], columns: [{ id: id(110), label: "Morning" }, { id: id(111), label: "Afternoon" }] },
    { id: id(95), type: "checkbox_grid", label: "Activities", required: false,
      rows: [{ id: id(102), label: "Adults" }, { id: id(103), label: "Children" }], columns: [{ id: id(112), label: "Art" }, { id: id(113), label: "Music" }] },
  ] } }
  const now = "2026-11-01T12:00:00Z"
  let saved: FormResponse | null = null
  const submissions: unknown[] = []
  await page.route("**/api/public/forms/intake", async route => {
    const command = route.request().postDataJSON()
    const answer = (value: unknown) => route.fulfill({ json: { value } })
    if (command.action === "recoverable_forms") return answer({ forms: [], next: null })
    if (command.action === "versions") return answer({ versions: [{ id: id(80), title: "Availability", revision: 1, createdAt: now }], next: null })
    if (command.action === "responses") return answer({ version, permissions: { canCorrect: true, canManageAccess: false }, responses: saved ? [saved] : [], next: null })
    if (command.action === "submit") {
      submissions.push(command.submission)
      if (submissions.length === 1) {
        saved = { id: command.submission.id, versionId: id(80), revision: 1, submittedAt: now, updatedAt: now, answers: command.submission.answers }
        return route.abort("failed")
      }
      return answer({ id: saved!.id, versionId: id(80), submittedAt: now })
    }
    if (command.action === "correct") {
      expect(command.expectedRevision).toBe(1)
      expect(command.value).toEqual({ [id(100)]: id(111), [id(101)]: id(111) })
      saved = { ...saved!, revision: 2, answers: saved!.answers.map(item => item.questionId === command.questionId ? { ...item, value: command.value } : item) }
      return answer(saved)
    }
    throw new Error(`Unexpected command ${command.action}`)
  })
  await page.goto("/?form-intake&grids")
  const form = page.getByRole("form", { name: "Submit form" })
  await form.getByRole("radiogroup", { name: "Monday", exact: true }).getByRole("radio", { name: "Morning", exact: true }).click()
  await form.getByRole("radiogroup", { name: "Tuesday", exact: true }).getByRole("radio", { name: "Afternoon", exact: true }).click()
  const adults = form.getByRole("group", { name: "Adults", exact: true })
  await adults.getByRole("checkbox", { name: "Art", exact: true }).click()
  await adults.getByRole("checkbox", { name: "Music", exact: true }).click()
  await form.getByRole("button", { name: "Submit", exact: true }).click()
  await expect(form.getByRole("button", { name: "Retry submission" })).toBeVisible()
  await expect(adults.getByRole("checkbox", { name: "Art", exact: true })).toBeDisabled()
  await form.getByRole("button", { name: "Retry submission" }).click()
  await expect(page.getByText("Response received. Thank you.")).toBeVisible()
  expect(submissions).toHaveLength(2); expect(submissions[0]).toEqual(submissions[1])
  expect(saved!.answers).toEqual([{ questionId: id(90), value: { [id(100)]: id(110), [id(101)]: id(111) } }, { questionId: id(95), value: { [id(102)]: [id(112), id(113)] } }])
  const review = page.getByRole("region", { name: "Form responses" })
  await review.getByRole("button", { name: "Refresh", exact: true }).click()
  await expect(review.getByRole("button", { name: "Edit Activities", exact: true })).toHaveText("Adults: Art, Music\nChildren: No answer")
  await review.getByRole("button", { name: "Edit Availability", exact: true }).click()
  await review.getByRole("radiogroup", { name: "Monday", exact: true }).getByRole("radio", { name: "Afternoon", exact: true }).click()
  await review.getByRole("button", { name: "Save", exact: true }).click()
  await expect(review.getByRole("button", { name: "Edit Availability", exact: true })).toHaveText("Monday: Afternoon\nTuesday: Afternoon")
  await page.reload()
  await expect(review.getByRole("button", { name: "Edit Availability", exact: true })).toHaveText("Monday: Afternoon\nTuesday: Afternoon")
  await expect(review.getByRole("button", { name: "Edit Activities", exact: true })).toHaveText("Adults: Art, Music\nChildren: No answer")
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
})
