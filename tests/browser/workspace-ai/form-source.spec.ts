import { expect, test } from "@playwright/test"
test("source inspector fails closed, enables Edit and preserves unsaved text after revocation", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message))
  let canEdit = false; let unavailable = false
  await page.route("**/api/public/forms/intake", async (route) => {
    const command = route.request().postDataJSON()
    if (command.action === "recoverable_forms") return route.fulfill({ json: { value: { forms: [], next: null } } })
    expect(command.action).toBe("source_access")
    if (unavailable) return route.fulfill({ status: 503, json: { error: "Unavailable", uncertain: false } })
    return route.fulfill({ json: { value: { formId: command.formId, canEdit, canManageAccess: false } } })
  })
  await page.goto("/?form-source")
  const title = page.getByRole("textbox", { name: "Title", exact: true })
  await expect(title).toBeDisabled()
  await expect(page.getByText("Read-only form. Ask its manager for Edit access.")).toBeVisible()
  canEdit = true
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")))
  await expect(title).toBeEnabled()
  await title.fill("My unsaved title")
  canEdit = false
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")))
  await expect(title).toBeDisabled()
  await expect(title).toHaveValue("My unsaved title")
  await expect(page.getByRole("button", { name: "Save changes", exact: true })).toBeDisabled()
  canEdit = true
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")))
  await expect(title).toBeEnabled()
  await page.getByRole("button", { name: "Save changes", exact: true }).click()
  await expect(page.getByText("Changes saved", { exact: true })).toBeVisible()
  unavailable = true
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")))
  await expect(title).toBeDisabled()
  await expect(page.getByText("Unable to verify form access. Your draft is still here.")).toBeVisible()
  await expect(title).toHaveValue("My unsaved title")
  expect(errors).toEqual([])
})


test("unpublished form access preserves the draft and resolves a lost acknowledgement before closing", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message))
  let revision = 1; let granted = false; let first = true; let canManage = true
  let original: unknown
  await page.route("**/api/public/forms/intake", async route => {
    const command = route.request().postDataJSON()
    expect(command.versionId).toBeUndefined()
    expect(command.organizationId).toBe("10000000-0000-4000-8000-000000000001")
    expect(command.formId).toBe("10000000-0000-4000-8000-000000000020")
    if (command.action === "recoverable_forms") return route.fulfill({ json: { value: { forms: [], next: null } } })
    if (command.action === "source_access") return route.fulfill({ json: { value: { formId: command.formId, canEdit: true, canManageAccess: canManage } } })
    if (command.action === "review_access") return route.fulfill({ json: { value: { formId: command.formId, revision, canGrantManage: true,
      reviewers: granted ? [{ id: "10000000-0000-4000-8000-000000000004", email: "person4@example.org", role: "edit" }] : [] } } })
    expect(command.action).toBe("grant_reviewer")
    if (first) {
      first = false; original = command; granted = true; revision = 2
      return route.fulfill({ status: 503, json: { error: "Unable to confirm. Retry the same request.", uncertain: true } })
    }
    expect(command).toEqual(original)
    return route.fulfill({ json: { value: { formId: command.formId, operationId: command.operationId, revision } } })
  })
  await page.goto("/?form-source")
  const title = page.getByRole("textbox", { name: "Title", exact: true })
  await expect(title).toBeEnabled()
  await title.fill("Unpublished draft")
  await page.getByRole("button", { name: "Form access", exact: true }).click()
  await page.getByRole("textbox", { name: "Teammate email" }).fill("person4@example.org")
  await page.getByRole("combobox", { name: "Access", exact: true }).click()
  await page.getByRole("option", { name: "Edit", exact: true }).click()
  await page.getByRole("button", { name: "Save access", exact: true }).click()
  await expect(page.getByRole("button", { name: "Retry access change" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Close inspector" })).toBeDisabled()
  await expect(page.getByRole("button", { name: "Form access", exact: true })).toBeDisabled()
  await expect(page.getByRole("button", { name: "Save changes", exact: true })).toBeDisabled()
  await expect(title).toHaveValue("Unpublished draft")
  await page.getByRole("button", { name: "Retry access change" }).click()
  await expect(page.getByRole("button", { name: "Change access for person4@example.org" })).toBeVisible()
  await expect(page.getByRole("textbox", { name: "Teammate email" })).toBeFocused()
  await expect(page.getByRole("button", { name: "Close inspector" })).toBeEnabled()
  await page.getByRole("button", { name: "Form access", exact: true }).click()
  await expect(title).toHaveValue("Unpublished draft")
  canManage = false
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")))
  await expect(page.getByRole("button", { name: "Form access", exact: true })).toHaveCount(0)
  await expect(title).toBeEnabled()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
})

test("owner recovers an unpublished form with exact retry, confirmation and preserved draft", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message))
  let orphaned = false; let recovered = false; let first = true; let original: unknown
  await page.route("**/api/public/forms/intake", async route => {
    const command = route.request().postDataJSON()
    expect(command.pageId).toBeUndefined()
    expect(command.organizationId).toBe("10000000-0000-4000-8000-000000000001")
    expect(command.formId).toBe("10000000-0000-4000-8000-000000000020")
    if (command.action === "source_access") return route.fulfill({ json: { value: { formId: command.formId, canEdit: !orphaned || recovered, canManageAccess: recovered } } })
    if (command.action === "recoverable_forms") return route.fulfill({ json: { value: { forms: recovered ? [] : [{ id: command.formId, title: "Private draft", revision: 1 }], next: null } } })
    expect(command.action).toBe("recover_form")
    if (first) {
      first = false; original = command; recovered = true
      return route.fulfill({ status: 503, json: { error: "Unable to confirm. Retry the same request.", uncertain: true } })
    }
    expect(command).toEqual(original)
    return route.fulfill({ json: { value: { formId: command.formId, operationId: command.operationId, revision: 2 } } })
  })
  await page.goto("/?form-source")
  const title = page.getByRole("textbox", { name: "Title", exact: true })
  await expect(title).toBeEnabled()
  await title.fill("Preserve my draft")
  orphaned = true
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")))
  await expect(title).toBeDisabled()
  await page.getByRole("button", { name: "Recover Private draft", exact: true }).click()
  await expect(page.getByRole("alertdialog")).toBeVisible()
  await page.getByRole("button", { name: "Cancel", exact: true }).click()
  await expect(page.getByRole("button", { name: "Recover Private draft", exact: true })).toBeFocused()
  await page.getByRole("button", { name: "Recover Private draft", exact: true }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Recover access", exact: true }).click()
  await expect(page.getByRole("button", { name: "Retry recovery", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Close inspector" })).toBeDisabled()
  await expect(page.getByRole("button", { name: "Save changes", exact: true })).toBeDisabled()
  await expect(title).toHaveValue("Preserve my draft")
  await page.getByRole("button", { name: "Retry recovery", exact: true }).click()
  await expect(page.getByText("Form recovered. You now manage it and its responses.")).toBeFocused()
  await expect(title).toBeEnabled()
  await expect(title).toHaveValue("Preserve my draft")
  await expect(page.getByRole("button", { name: "Form access", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Close inspector" })).toBeEnabled()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
})
