import { expect, test } from "@playwright/test"
import type { FormResponse } from "../../../src/features/organization-forms"
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`

test("Other authoring saves/reopens, requires text and removes it when deselected", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message))
  await page.setViewportSize({ width: 320, height: 1000 })
  await page.goto("/?form-controls")
  await page.getByRole("switch", { name: "Allow Other", exact: true }).click()
  await page.getByRole("button", { name: "Save draft", exact: true }).click()
  await page.getByRole("button", { name: "Reopen draft", exact: true }).click()
  await expect(page.getByRole("switch", { name: "Allow Other", exact: true })).toBeChecked()
  await page.getByRole("button", { name: "Preview", exact: true }).click()
  await page.getByRole("radio", { name: "Other", exact: true }).focus()
  await page.keyboard.press("Space")
  await page.getByRole("button", { name: "Check answers" }).click()
  await expect(page.getByRole("radio", { name: "Other", exact: true })).toBeFocused()
  await expect(page.getByText("Describe your other answer.", { exact: true })).toBeVisible()
  await page.getByRole("textbox", { name: "Other answer", exact: true }).fill("East")
  await page.getByLabel(/^Day\s*\(required\)$/).fill("2028-02-29")
  await page.getByLabel(/^Time\s*\(required\)$/).fill("12:30")
  await page.getByRole("button", { name: "Check answers" }).click()
  await expect(page.getByText("Answers look good. Nothing was submitted.")).toBeVisible()
  await page.getByRole("radio", { name: "North", exact: true }).click()
  await expect(page.getByRole("textbox", { name: "Other answer", exact: true })).toHaveCount(0)
  await page.getByRole("radio", { name: "Other", exact: true }).click()
  await expect(page.getByRole("textbox", { name: "Other answer", exact: true })).toHaveValue("")
  await page.getByRole("button", { name: "Edit", exact: true }).click()
  await page.getByRole("combobox", { name: "Question 1 type" }).click()
  await page.getByRole("option", { name: "Multiple choice", exact: true }).click()
  await expect(page.getByRole("switch", { name: "Allow Other", exact: true })).toBeChecked()
  await page.getByRole("button", { name: "Preview", exact: true }).click()
  await page.getByRole("checkbox", { name: "North", exact: true }).click()
  await page.getByRole("checkbox", { name: "Other", exact: true }).click()
  await page.getByRole("textbox", { name: "Other answer", exact: true }).fill("West")
  await page.getByRole("checkbox", { name: "Other", exact: true }).click()
  await expect(page.getByRole("checkbox", { name: "North", exact: true })).toBeChecked()
  await expect(page.getByRole("textbox", { name: "Other answer", exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole("button", { name: "Edit", exact: true }).click()
  await page.getByRole("button", { name: "Toggle editing lock" }).click()
  await expect(page.getByRole("switch", { name: "Allow Other", exact: true })).toBeDisabled()
  expect(errors).toEqual([])
})

test("Other public submission retries exactly and staff corrections survive reload", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message))
  await page.setViewportSize({ width: 320, height: 950 })
  const version = { schemaVersion: 1, id: id(80), formId: id(20), revision: 1, title: "Choices", description: "", definition: { questions: [
    { id: id(90), type: "single_choice", label: "Location", required: true, options: [{ id: "option-1", label: "North" }, { id: "option-2", label: "South" }], allowOther: true },
    { id: id(95), type: "multiple_choice", label: "Activities", required: false, options: [{ id: "option-1", label: "Art" }, { id: "option-2", label: "Music" }], allowOther: true },
  ] } }
  let saved: FormResponse | null = null
  const submissions: unknown[] = []; const now = "2026-11-01T12:00:00Z"
  await page.route("**/api/public/forms/intake", async route => {
    const command = route.request().postDataJSON()
    const answer = (value: unknown) => route.fulfill({ json: { value } })
    if (command.action === "recoverable_forms") return answer({ forms: [], next: null })
    if (command.action === "versions") return answer({ versions: [{ id: id(80), title: "Choices", revision: 1, createdAt: now }], next: null })
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
      expect(command.value).toEqual({ optionIds: ["option-1", "other"], otherText: "Dance" })
      saved = { ...saved!, revision: 2, answers: saved!.answers.map(item => item.questionId === command.questionId ? { ...item, value: command.value } : item) }
      return answer(saved)
    }
    throw new Error(`Unexpected ${command.action}`)
  })
  await page.goto("/?form-intake&other")
  const form = page.getByRole("form", { name: "Submit form" })
  await form.getByRole("radio", { name: "Other", exact: true }).click()
  await form.getByRole("textbox", { name: "Other answer", exact: true }).fill("East")
  await form.getByRole("checkbox", { name: "Art", exact: true }).click()
  await form.getByRole("checkbox", { name: "Other", exact: true }).click()
  await form.getByRole("textbox", { name: "Other answer", exact: true }).nth(1).fill("Painting")
  await form.getByRole("button", { name: "Submit", exact: true }).click()
  await expect(form.getByRole("button", { name: "Retry submission" })).toBeVisible()
  await expect(form.getByRole("textbox", { name: "Other answer", exact: true }).first()).toBeDisabled()
  await form.getByRole("button", { name: "Retry submission" }).click()
  await expect(page.getByText("Response received. Thank you.")).toBeVisible()
  expect(submissions).toHaveLength(2); expect(submissions[0]).toEqual(submissions[1])
  expect(saved!.answers).toEqual([{ questionId: id(90), value: { optionIds: ["other"], otherText: "East" } }, { questionId: id(95), value: { optionIds: ["option-1", "other"], otherText: "Painting" } }])
  const review = page.getByRole("region", { name: "Form responses" })
  await review.getByRole("button", { name: "Refresh", exact: true }).click()
  await expect(review.getByRole("button", { name: "Edit Location", exact: true })).toHaveText("Other: East")
  await review.getByRole("button", { name: "Edit Activities", exact: true }).click()
  await review.getByRole("textbox", { name: "Other answer", exact: true }).fill("Dance")
  await review.getByRole("button", { name: "Save", exact: true }).click()
  await expect(review.getByRole("button", { name: "Edit Activities", exact: true })).toHaveText("Art, Other: Dance")
  await page.reload()
  await expect(review.getByRole("button", { name: "Edit Activities", exact: true })).toHaveText("Art, Other: Dance")
  await expect(review.getByRole("button", { name: "Edit Location", exact: true })).toHaveText("Other: East")
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
})
