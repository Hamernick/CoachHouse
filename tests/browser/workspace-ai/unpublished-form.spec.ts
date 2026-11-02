import { expect, test } from "@playwright/test"
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const target = { organizationId: id(1), formId: id(20) }
const definition = { questions: [{ id: id(90), type: "text", label: "Name", required: true }] }

test("unpublished invite accepts, edits canonically, retries exactly, reloads and loses discovery on revocation", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 950 })
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message))
  let accepted = false, revoked = false, attempts = 0
  let source = { formId: id(20), revision: "a".repeat(64), title: "Unpublished intake", description: "", definition }
  const writes: unknown[] = []
  await page.route("**/api/public/forms/intake", async route => {
    const command = route.request().postDataJSON()
    expect(command).toMatchObject(target); expect(command).not.toHaveProperty("versionId")
    if (command.action === "viewer_offer") return route.fulfill(revoked ? { status: 403, json: { error: "Unavailable." } } : { json: { value: { ...target, invitationId: id(700), title: source.title, accepted, expiresAt: "2026-12-01T00:00:00Z", responsePermission: "edit" } } })
    if (command.action === "accept_viewer") { accepted = true; return route.fulfill({ json: { value: { ...target, invitationId: id(700), accepted: true } } }) }
    if (!accepted || revoked) return route.fulfill({ status: 403, json: { error: "Form editing is unavailable. Your draft is preserved.", uncertain: false } })
    if (command.action === "form_source_entry") return route.fulfill({ json: { value: { formId: id(20), title: source.title, canManageInvitations: false } } })
    if (command.action === "form_source_directory") return route.fulfill({ json: { value: { forms: [{ formId: id(20), title: source.title }, { formId: id(21), title: "Another permitted draft" }], next: null } } })
    if (command.action === "read_form_source") return route.fulfill({ json: { value: source } })
    expect(command.action).toBe("save_form_source"); writes.push(command)
    source = { ...source, ...command.content, revision: "b".repeat(64) }
    if (++attempts === 1) return route.fulfill({ status: 503, json: { error: "Unable to confirm. Retry the same request.", uncertain: true } })
    return route.fulfill({ json: { value: { formId: id(20), operationId: command.operationId, revision: source.revision } } })
  })
  await page.goto("/?unpublished-form")
  await page.getByRole("button", { name: "Accept form editing" }).focus(); await page.keyboard.press("Enter")
  await expect(page.getByRole("link", { name: "Another permitted draft" })).toHaveAttribute("href", `/forms/edit/${id(1)}/${id(21)}`)
  await expect(page.getByRole("button", { name: "Invited form collaborators" })).toHaveCount(0)
  await page.getByRole("button", { name: "Edit form", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Edit form" })).toBeFocused()
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Edited draft")
  await page.getByRole("textbox", { name: "Question 1 label" }).fill("Full name")
  await page.getByRole("button", { name: "Save form", exact: true }).click()
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeDisabled()
  await expect(page.getByRole("navigation", { name: "Forms you can edit" })).toHaveCount(0)
  await page.getByRole("button", { name: "Retry save" }).click()
  expect(writes[0]).toEqual(writes[1])
  await page.getByRole("button", { name: "Done", exact: true }).click()
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Edited draft")
  await page.reload(); await page.getByRole("button", { name: "Edit form", exact: true }).click()
  await expect(page.getByRole("textbox", { name: "Question 1 label" })).toHaveValue("Full name")
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Preserved after revoke")
  revoked = true
  await page.getByRole("button", { name: "Save form", exact: true }).click()
  await expect(page.getByRole("textbox", { name: "Title", exact: true })).toHaveValue("Preserved after revoke")
  await expect(page.getByRole("button", { name: "Save form", exact: true })).toBeDisabled()
  await page.getByRole("button", { name: "Cancel", exact: true }).click()
  await expect(page.getByRole("link", { name: "Another permitted draft" })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
})

test("unpublished manager invites Edit, preserves uncertain request, copies draft link and pages discovery", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 950 })
  let revision = 1, attempts = 0
  const writes: unknown[] = []
  await page.route("**/api/public/forms/intake", async route => {
    const command = route.request().postDataJSON()
    expect(command).toMatchObject(target); expect(command).not.toHaveProperty("versionId")
    if (command.action === "form_source_entry") return route.fulfill({ json: { value: { formId: id(20), title: "Draft", canManageInvitations: true } } })
    if (command.action === "form_source_directory") return route.fulfill({ json: { value: { forms: [{ formId: command.after ? id(21) : id(20), title: command.after ? "Next permitted form" : "Draft" }], next: command.after ? null : id(20) } } })
    if (command.action === "viewer_offer") return route.fulfill({ status: 403, json: { error: "Unavailable." } })
    if (command.action === "viewer_invitations") return route.fulfill({ json: { value: { formId: id(20), revision, canGrantManage: false, invitations: [] } } })
    expect(command.action).toBe("invite_viewer"); expect(command.responsePermission).toBe("edit"); writes.push(command)
    revision = 2
    if (++attempts === 1) return route.fulfill({ status: 503, json: { error: "Unable to confirm. Retry the same request.", uncertain: true } })
    return route.fulfill({ json: { value: { formId: id(20), operationId: command.operationId, invitationId: command.operationId, revision } } })
  })
  await page.goto("/?unpublished-form")
  await page.getByRole("button", { name: "Invited form collaborators" }).click()
  await expect(page.getByRole("option", { name: "View responses", exact: true })).toHaveCount(0)
  await expect(page.getByRole("option", { name: "Manage form access", exact: true })).toHaveCount(0)
  await page.getByRole("textbox", { name: "Invitee email" }).fill("collaborator@example.org")
  await page.getByRole("button", { name: "Create form invitation" }).click()
  await expect(page.getByRole("button", { name: "Edit form", exact: true })).toBeDisabled()
  await expect(page.getByRole("button", { name: "More forms" })).toBeDisabled()
  await page.getByRole("button", { name: "Retry invitation change" }).click()
  expect(writes[0]).toEqual(writes[1])
  await expect(page.getByText("Invitation saved. Copy and share the form link.")).toBeVisible()
  await page.evaluate(() => { Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("Clipboard blocked") } } }) })
  await page.getByRole("button", { name: "Copy form link", exact: true }).click()
  await expect(page.getByRole("textbox", { name: "Copy this form link" })).toHaveValue(new RegExp(`/forms/edit/${id(1)}/${id(20)}$`))
  await page.getByRole("button", { name: "More forms" }).click()
  await expect(page.getByRole("link", { name: "Next permitted form" })).toBeVisible()
  await page.getByRole("button", { name: "First forms" }).click()
  await expect(page.getByRole("link", { name: "Draft", exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test("primary draft manager creates an external invitation from the existing workspace Form access", async ({ page }) => {
  let revision = 1
  const writes: unknown[] = []
  await page.route("**/api/public/forms/intake", async route => {
    const command = route.request().postDataJSON()
    expect(command).toMatchObject(target); expect(command).not.toHaveProperty("versionId")
    if (command.action === "recoverable_forms") return route.fulfill({ json: { value: { forms: [], next: null } } })
    if (command.action === "source_access") return route.fulfill({ json: { value: { formId: id(20), canEdit: true, canManageAccess: true } } })
    if (command.action === "review_access") return route.fulfill({ json: { value: { formId: id(20), revision, canGrantManage: true, reviewers: [] } } })
    if (command.action === "viewer_invitations") return route.fulfill({ json: { value: { formId: id(20), revision, canGrantManage: true, invitations: [] } } })
    expect(command.action).toBe("invite_viewer"); expect(command.responsePermission).toBe("manage"); writes.push(command)
    return route.fulfill({ json: { value: { formId: id(20), operationId: command.operationId, invitationId: command.operationId, revision: ++revision } } })
  })
  await page.goto("/?form-source")
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Unsaved local draft")
  await page.getByRole("button", { name: "Form access", exact: true }).click()
  await page.getByRole("button", { name: "Invited form collaborators" }).click()
  await page.getByRole("textbox", { name: "Invitee email" }).fill("manager@example.org")
  await page.getByRole("combobox", { name: "Form access", exact: true }).selectOption("manage")
  await page.getByRole("button", { name: "Create form invitation" }).click()
  await expect(page.getByText("Invitation saved. Copy and share the form link.")).toBeVisible()
  await expect(page.getByRole("button", { name: "Copy form link", exact: true })).toBeVisible()
  await expect(page.getByRole("textbox", { name: "Title", exact: true })).toHaveValue("Unsaved local draft")
  expect(writes).toHaveLength(1)
})
