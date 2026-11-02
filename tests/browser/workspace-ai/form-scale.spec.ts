import { expect, test } from "@playwright/test"
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`

test("scale and rating authoring save/reopen and keyboard preview stay usable at 320px", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message))
  await page.setViewportSize({ width: 320, height: 1000 }); await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/?form-controls")
  await page.getByRole("combobox", { name: "Question 1 type" }).selectOption({ label: "Linear scale" })
  await page.getByRole("combobox", { name: "To", exact: true }).selectOption({ label: "10" })
  await page.getByRole("textbox", { name: "Label for 0", exact: true }).fill("Low")
  await page.getByRole("textbox", { name: "Label for 10", exact: true }).fill("High")
  await page.getByRole("button", { name: "Save draft", exact: true }).click()
  await page.getByRole("button", { name: "Reopen draft", exact: true }).click()
  await expect(page.getByRole("combobox", { name: "To", exact: true })).toHaveValue("10")
  await expect(page.getByRole("textbox", { name: "Label for 0", exact: true })).toHaveValue("Low")
  await page.getByRole("button", { name: "Preview", exact: true }).click()
  const group = page.getByRole("radiogroup", { name: "Location", exact: true })
  await page.getByRole("button", { name: "Check answers" }).click()
  await expect.poll(() => group.evaluate(element => element.contains(document.activeElement))).toBe(true)
  await group.getByRole("radio", { name: "0: Low", exact: true }).click()
  await page.getByLabel(/^Day\s*\(required\)$/).fill("2028-02-29")
  await page.getByLabel(/^Time\s*\(required\)$/).fill("12:30")
  await page.getByRole("button", { name: "Check answers" }).click()
  await expect(page.getByText("Answers look good. Nothing was submitted.")).toBeVisible()
  await page.getByRole("button", { name: "Clear selection", exact: true }).click()
  await page.getByRole("button", { name: "Check answers" }).click()
  await expect.poll(() => group.evaluate(element => element.contains(document.activeElement))).toBe(true)
  await expect(group).toHaveAttribute("aria-invalid", "true")
  await page.getByRole("button", { name: "Edit", exact: true }).click()
  await page.getByRole("combobox", { name: "Question 1 type" }).selectOption({ label: "Rating" })
  await expect(page.getByRole("combobox", { name: "Stars", exact: true })).toHaveValue("10")
  await expect(page.getByRole("textbox", { name: "Label for 1", exact: true })).toHaveValue("Low")
  await page.getByRole("button", { name: "Save draft", exact: true }).click()
  await page.getByRole("button", { name: "Reopen draft", exact: true }).click()
  await page.getByRole("button", { name: "Preview", exact: true }).click()
  const first = page.getByRole("radio", { name: "1 of 10 stars: Low", exact: true })
  await first.focus(); await first.press("Space"); await page.keyboard.down("ArrowRight")
  await expect(page.getByRole("radio", { name: "2 of 10 stars", exact: true })).toBeChecked()
  await page.keyboard.up("ArrowRight")
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole("button", { name: "Edit", exact: true }).click()
  await page.getByRole("button", { name: "Toggle editing lock" }).click()
  await expect(page.getByRole("combobox", { name: "Stars", exact: true })).toBeDisabled()
  await expect(page.getByRole("textbox", { name: "Label for 1", exact: true })).toBeDisabled()
  expect(errors).toEqual([])
})

test("public scale/rating submit numeric values, retry exactly and staff corrections persist on reload", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 950 }); await page.emulateMedia({ reducedMotion: "reduce" })
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message))
  const version = { schemaVersion: 1, id: id(80), formId: id(20), revision: 1, title: "Feedback", description: "", definition: { questions: [
    { id: id(90), type: "linear_scale", label: "Confidence", required: true, min: 0, max: 10, lowerLabel: "Low", upperLabel: "High" },
    { id: id(95), type: "rating", label: "Experience", required: false, min: 1, max: 5, lowerLabel: "Poor", upperLabel: "Excellent" },
  ] } }
  const now = "2026-11-01T12:00:00Z"
  let saved: { id: string; versionId: string; revision: number; submittedAt: string; updatedAt: string; answers: { questionId: string; value: number }[] } | null = null
  const submissions: unknown[] = []
  await page.route("**/api/public/forms/intake", async route => {
    const command = route.request().postDataJSON()
    const answer = (value: unknown) => route.fulfill({ json: { value } })
    if (command.action === "recoverable_forms") return answer({ forms: [], next: null })
    if (command.action === "versions") return answer({ versions: [{ id: id(80), title: "Feedback", revision: 1, createdAt: now }], next: null })
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
      expect(command.value).toBe(8)
      saved = { ...saved!, revision: 2, answers: saved!.answers.map(item => item.questionId === command.questionId ? { ...item, value: command.value } : item) }
      return answer(saved)
    }
    throw new Error(`Unexpected command ${command.action}`)
  })
  await page.goto("/?form-intake&scales")
  const form = page.getByRole("form", { name: "Submit form" })
  await form.getByRole("radio", { name: "0: Low", exact: true }).click()
  await form.getByRole("radio", { name: "5 of 5 stars: Excellent", exact: true }).click()
  await form.getByRole("button", { name: "Submit", exact: true }).click()
  await expect(form.getByRole("button", { name: "Retry submission" })).toBeVisible()
  await expect(form.getByRole("radio", { name: "0: Low", exact: true })).toBeDisabled()
  await form.getByRole("button", { name: "Retry submission" }).click()
  await expect(page.getByText("Response received. Thank you.")).toBeVisible()
  expect(submissions).toHaveLength(2); expect(submissions[0]).toEqual(submissions[1])
  expect(saved!.answers).toEqual([{ questionId: id(90), value: 0 }, { questionId: id(95), value: 5 }])
  const review = page.getByRole("region", { name: "Form responses" })
  await review.getByRole("button", { name: "Refresh", exact: true }).click()
  await review.getByRole("button", { name: "Edit Confidence", exact: true }).click()
  await review.getByRole("radio", { name: "8", exact: true }).click()
  await review.getByRole("button", { name: "Save", exact: true }).click()
  await expect(review.getByRole("button", { name: "Edit Confidence", exact: true })).toHaveText("8")
  await page.reload()
  await expect(review.getByRole("button", { name: "Edit Confidence", exact: true })).toHaveText("8")
  await expect(review.getByRole("button", { name: "Edit Experience", exact: true })).toHaveText("5")
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
})
