import { expect, test } from "@playwright/test"
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const version = { schemaVersion: 1, id: id(80), formId: id(20), revision: 2, title: "Community sign up", description: "",
  definition: { questions: [{ id: id(90), type: "text", label: "Name", required: true }] } }
const response = { id: id(91), versionId: id(80), revision: 1, submittedAt: "2026-11-01T12:00:00Z", updatedAt: "2026-11-01T12:00:00Z",
  answers: [{ questionId: id(90), value: "Joan" }] }

test("direct response view copies its exact locator and clears private content after revocation", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await page.setViewportSize({ width: 320, height: 950 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message))
  let denied = false
  const commands: string[] = []
  await page.route("**/api/public/forms/intake", async (route) => {
    const command = route.request().postDataJSON(); commands.push(command.action)
    if (command.action === "viewer_offer") return route.fulfill({ status: 403, json: { error: "Invitation unavailable.", uncertain: false } })
    expect(command).toEqual({ action: "responses", versionId: id(80) })
    if (denied) return route.fulfill({ status: 403, json: { error: "Access removed.", uncertain: false } })
    return route.fulfill({ json: { value: { version, permissions: { canCorrect: false, canManageAccess: false }, responses: [response], next: null } } })
  })
  await page.goto("/?form-intake&direct-responses")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Community sign up")
  await expect(page.getByText("Joan", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Edit Name" })).toHaveCount(0)
  await expect(page.getByRole("region", { name: "Response access", exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "Copy response link" }).focus()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("status")).toHaveText("Link copied. Existing form access required.")
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`http://127.0.0.1:3187/forms/responses/${id(80)}`)
  denied = true
  await page.getByRole("button", { name: "Refresh", exact: true }).click()
  await expect(page.getByRole("alert")).toHaveText("Access removed.")
  await expect(page.getByText("Joan", { exact: true })).toHaveCount(0)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Form responses")
  await expect(page.getByRole("button", { name: "Copy response link" })).toHaveCount(0)
  expect(commands.every((action) => action === "responses" || action === "viewer_offer")).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
})

test("clipboard denial leaves a selectable link without changing permissions", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", { value: { writeText: async () => { throw new Error("Denied") } } }))
  await page.route("**/api/public/forms/intake", (route) => route.fulfill({ json: { value: {
    version, permissions: { canCorrect: false, canManageAccess: false }, responses: [], next: null,
  } } }))
  await page.goto("/?form-intake&direct-responses")
  await page.getByRole("button", { name: "Copy response link" }).click()
  const link = page.getByRole("textbox", { name: "Copy this response link" })
  await expect(link).toHaveValue(`http://127.0.0.1:3187/forms/responses/${id(80)}`)
  await link.focus()
  expect(await link.evaluate((element: HTMLInputElement) => element.selectionEnd! - element.selectionStart!)).toBe((await link.inputValue()).length)
  await expect(page.getByRole("status")).toHaveText("Select and copy the link. Existing form access required.")
})

test("invited viewer explicitly accepts, retries a lost acknowledgement, then sees read-only responses", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 950 })
  let accepted = false, attempts = 0
  const acceptance: unknown[] = []
  await page.route("**/api/public/forms/intake", async (route) => {
    const command = route.request().postDataJSON()
    if (command.action === "responses") return route.fulfill(accepted ? { json: { value: { version, permissions: { canCorrect: false, canManageAccess: false }, responses: [response], next: null } } }
      : { status: 403, json: { error: "This form is no longer available to you.", uncertain: false } })
    if (command.action === "viewer_offer") return route.fulfill({ json: { value: { invitationId: id(600), versionId: id(80), title: version.title, accepted: false, expiresAt: "2026-12-01T00:00:00Z" } } })
    expect(command.action).toBe("accept_viewer"); acceptance.push(command); accepted = true
    if (++attempts === 1) return route.fulfill({ status: 503, json: { error: "Unable to confirm. Retry the same request.", uncertain: true } })
    return route.fulfill({ json: { value: { invitationId: id(600), versionId: id(80), accepted: true } } })
  })
  await page.goto("/?form-intake&direct-responses")
  await expect(page.getByRole("region", { name: "Response invitation" })).toBeVisible()
  await expect(page.getByText("Joan", { exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "Accept viewing access" }).click()
  await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeDisabled()
  await page.getByRole("button", { name: "Retry acceptance" }).click()
  expect(acceptance[0]).toEqual(acceptance[1])
  await expect(page.getByText("Joan", { exact: true })).toBeVisible()
  await expect(page.getByRole("region", { name: "Response invitation" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Edit Name" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Invited response collaborators" })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test("revoked invitation cannot reveal responses through acceptance", async ({ page }) => {
  await page.route("**/api/public/forms/intake", (route) => {
    const command = route.request().postDataJSON()
    if (command.action === "viewer_offer") return route.fulfill({ json: { value: { invitationId: id(600), versionId: id(80), title: version.title, accepted: false, expiresAt: "2026-12-01T00:00:00Z" } } })
    return route.fulfill({ status: 403, json: { error: "Invitation unavailable.", uncertain: false } })
  })
  await page.goto("/?form-intake&direct-responses")
  await page.getByRole("button", { name: "Accept viewing access" }).click()
  await expect(page.getByRole("region", { name: "Response invitation" })).toHaveCount(0)
  await expect(page.getByText("Joan", { exact: true })).toHaveCount(0)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Form responses")
})

for (const permission of ["view", "correct", "edit", "manage"] as const) test(`primary manager creates and revokes ${permission} invitation with exact retry`, async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 1100 })
  let revision = 1, invitation: { id: string; email: string; accepted: boolean; expiresAt: string; responsePermission: string } | null = null
  const writes: unknown[] = []; let firstInvite = true
  await page.route("**/api/public/forms/intake", async (route) => {
    const command = route.request().postDataJSON()
    if (command.action === "responses") return route.fulfill({ json: { value: { version, permissions: { canCorrect: true, canManageAccess: true }, responses: [], next: null } } })
    if (command.action === "review_access") return route.fulfill({ json: { value: { formId: id(20), revision, canGrantManage: true, reviewers: [] } } })
    if (command.action === "viewer_invitations") return route.fulfill({ json: { value: { formId: id(20), revision, canGrantManage: true, invitations: invitation ? [invitation] : [] } } })
    writes.push(command)
    if (command.action === "invite_viewer") {
      expect(command.responsePermission).toBe(permission)
      invitation = { id: command.operationId, email: command.email, responsePermission: command.responsePermission, accepted: false, expiresAt: "2026-12-01T00:00:00Z" }; revision = 2
      if (firstInvite) { firstInvite = false; return route.fulfill({ status: 503, json: { error: "Unable to confirm. Retry the same request.", uncertain: true } }) }
    } else { expect(command.action).toBe("revoke_viewer"); expect(command.expectedRevision).toBe(2); invitation = null; revision = 3 }
    return route.fulfill({ json: { value: { formId: id(20), invitationId: command.invitationId ?? command.operationId, operationId: command.operationId, revision } } })
  })
  await page.goto("/?form-intake&direct-responses")
  await page.getByRole("button", { name: "Invited response collaborators" }).click()
  await page.getByLabel("Invitee email", { exact: true }).fill("external@example.org")
  if (permission !== "view") {
    await page.getByRole("combobox", { name: "Response access", exact: true }).selectOption({ label: permission === "manage" ? "Manage form access" : permission === "edit" ? "Edit form and responses" : "Correct responses" })
  }
  await page.getByRole("button", { name: "Create response invitation" }).click()
  await expect(page.getByRole("combobox", { name: "Response access", exact: true })).toBeDisabled()
  await expect(page.getByRole("button", { name: "Save access", exact: true })).toBeDisabled()
  await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeDisabled()
  await page.getByRole("button", { name: "Retry invitation change" }).click()
  expect(writes[0]).toEqual(writes[1])
  await expect(page.getByText("Awaiting acceptance", { exact: false })).toBeVisible()
  await page.getByRole("button", { name: "Revoke response invitation for external@example.org" }).click()
  await expect(page.getByText("No invited collaborators.")).toBeVisible()
  expect(writes).toHaveLength(3)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test("refresh retries an invitation lookup after a temporary failure", async ({ page }) => {
  let offers = 0
  await page.route("**/api/public/forms/intake", (route) => {
    const command = route.request().postDataJSON()
    if (command.action === "viewer_offer") {
      if (++offers === 1) return route.fulfill({ status: 503, json: { error: "Temporarily unavailable.", uncertain: false } })
      return route.fulfill({ json: { value: { invitationId: id(600), versionId: id(80), title: version.title, accepted: false, expiresAt: "2026-12-01T00:00:00Z" } } })
    }
    return route.fulfill({ status: 403, json: { error: "This form is no longer available to you.", uncertain: false } })
  })
  await page.goto("/?form-intake&direct-responses")
  await expect.poll(() => offers).toBe(1)
  await page.getByRole("button", { name: "Refresh", exact: true }).click()
  await expect(page.getByRole("button", { name: "Accept viewing access" })).toBeVisible()
  await expect(page.getByText("Joan", { exact: true })).toHaveCount(0)
})


const summary = (n: number, revision: number) => ({ id: id(n), title: "Community sign up", revision, createdAt: "2026-11-01T12:00:00Z" })
test("scoped versions paginate, retry and navigate to an independently loaded response version", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 950 })
  const commands: { action: string; versionId: string; before?: string }[] = []
  let failEarlier = true
  await page.route("**/api/public/forms/intake", (route) => {
    const command = route.request().postDataJSON(); commands.push(command)
    if (command.action === "response_versions") {
      if (command.before && failEarlier) { failEarlier = false; return route.fulfill({ status: 503, json: { error: "Unable to load form versions.", uncertain: false } }) }
      return route.fulfill({ json: { value: command.before ? { versions: [summary(79, 1)], next: null } : { versions: [summary(81, 3), summary(80, 2)], next: id(80) } } })
    }
    expect(command.action).toBe("responses")
    return route.fulfill({ json: { value: { version: { ...version, id: command.versionId, revision: command.versionId === id(79) ? 1 : 2 },
      permissions: { canCorrect: false, canManageAccess: false }, responses: [{ ...response, versionId: command.versionId,
        answers: [{ questionId: id(90), value: command.versionId === id(79) ? "Earlier answer" : "Joan" }] }], next: null } } })
  })
  await page.goto("/?form-intake&direct-responses")
  await expect(page.getByText("Joan", { exact: true })).toBeVisible()
  expect(commands.some((command) => command.action === "response_versions")).toBe(false)
  await page.getByRole("button", { name: "Other versions", exact: true }).click()
  const versions = page.getByRole("region", { name: "Form versions", exact: true })
  await expect(versions.getByRole("link", { name: "Community sign up · Version 3" })).toHaveAttribute("href", `/forms/responses/${id(81)}`)
  await expect(versions.locator('[aria-current="page"]')).toHaveText("Community sign up · Version 2 (current)")
  await versions.getByRole("button", { name: "Earlier versions" }).click()
  await expect(versions.getByRole("alert")).toHaveText("Unable to load versions.")
  await expect(versions.getByRole("link")).toHaveCount(0)
  await versions.getByRole("button", { name: "Retry versions" }).click()
  await expect(versions.getByRole("link", { name: "Community sign up · Version 1" })).toBeVisible()
  await versions.getByRole("button", { name: "Latest versions" }).click()
  await expect(versions.getByRole("link", { name: "Community sign up · Version 3" })).toBeVisible()
  await versions.getByRole("button", { name: "Earlier versions" }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await versions.getByRole("link", { name: "Community sign up · Version 1" }).focus()
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(new RegExp(`/forms/responses/${id(79)}$`))
  await expect(page.getByText("Earlier answer", { exact: true })).toBeVisible()
  await expect(page.getByText("Joan", { exact: true })).toHaveCount(0)
  expect(commands).toContainEqual({ action: "responses", versionId: id(79) })
  expect(commands).toContainEqual({ action: "response_versions", versionId: id(80), before: id(80) })
})

test("version discovery denial immediately clears private answers and titles", async ({ page }) => {
  let denied = false
  await page.route("**/api/public/forms/intake", (route) => {
    const command = route.request().postDataJSON()
    if (command.action === "response_versions") denied = true
    if (denied) return route.fulfill({ status: 403, json: { error: "Access removed.", uncertain: false } })
    return route.fulfill({ json: { value: { version, permissions: { canCorrect: false, canManageAccess: false }, responses: [response], next: null } } })
  })
  await page.goto("/?form-intake&direct-responses")
  await expect(page.getByText("Joan", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Other versions", exact: true }).click()
  await expect(page.getByRole("alert")).toHaveText("Access removed.")
  await expect(page.getByText("Joan", { exact: true })).toHaveCount(0)
  await expect(page.getByRole("region", { name: "Form versions", exact: true })).toHaveCount(0)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Form responses")
})

test("answer edits prevent version navigation until the draft is saved or canceled", async ({ page }) => {
  await page.route("**/api/public/forms/intake", (route) => {
    const command = route.request().postDataJSON()
    if (command.action === "response_versions") return route.fulfill({ json: { value: { versions: [summary(81, 3), summary(80, 2)], next: null } } })
    expect(command.action).toBe("responses")
    return route.fulfill({ json: { value: { version, permissions: { canCorrect: true, canManageAccess: false }, responses: [response], next: null } } })
  })
  await page.goto("/?form-intake&direct-responses")
  await page.getByRole("button", { name: "Other versions", exact: true }).click()
  const versions = page.getByRole("region", { name: "Form versions", exact: true })
  await expect(versions.getByRole("link")).toHaveCount(1)
  await page.getByRole("button", { name: "Edit Name" }).click()
  await page.getByRole("textbox", { name: "Name" }).fill("Joanne")
  await expect(page.getByRole("button", { name: "Other versions", exact: true })).toBeDisabled()
  await expect(versions.getByRole("link")).toHaveCount(0)
  await expect(page.getByRole("textbox", { name: "Name" })).toHaveValue("Joanne")
  await page.getByRole("button", { name: "Cancel", exact: true }).click()
  await expect(versions.getByRole("link")).toHaveCount(1)
  await expect(page.getByRole("button", { name: "Edit Name" })).toHaveText("Joan")
})

test("invited correction access shows its scope then uses existing conflict and retry recovery", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 1100 })
  let accepted = false, revision = 1, value = "Joan", corrections = 0
  const writes: unknown[] = []
  await page.route("**/api/public/forms/intake", async route => {
    const command = route.request().postDataJSON()
    if (command.action === "viewer_offer") return route.fulfill({ json: { value: { invitationId: id(600), versionId: id(80), title: version.title, accepted: false, responsePermission: "correct", expiresAt: "2026-12-01T00:00:00Z" } } })
    if (command.action === "accept_viewer") { accepted = true; return route.fulfill({ json: { value: { invitationId: id(600), versionId: id(80), accepted: true } } }) }
    if (!accepted) return route.fulfill({ status: 403, json: { error: "Access required.", uncertain: false } })
    const row = () => ({ ...response, revision, answers: [{ questionId: id(90), value }] })
    if (command.action === "responses") return route.fulfill({ json: { value: { version, permissions: { canCorrect: true, canManageAccess: false }, responses: [row()], next: null } } })
    if (command.action === "response") return route.fulfill({ json: { value: row() } })
    expect(command.action).toBe("correct"); writes.push(command)
    if (++corrections === 1) {
      revision = 2; value = "Joann"
      return route.fulfill({ status: 409, json: { error: "Response changed. Reload before saving.", uncertain: false } })
    }
    expect(command.expectedRevision).toBe(2)
    if (corrections === 2) { revision = 3; value = command.value; return route.fulfill({ status: 503, json: { error: "Unable to confirm. Retry the same request.", uncertain: true } }) }
    return route.fulfill({ json: { value: row() } })
  })
  await page.goto("/?form-intake&direct-responses")
  await expect(page.getByRole("region", { name: "Response invitation" })).toContainText("view and correct answers")
  await expect(page.getByText("Joan", { exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "Accept correction access" }).focus(); await page.keyboard.press("Enter")
  await expect(page.getByRole("region", { name: "Response access", exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "Edit Name" }).click()
  const input = page.getByRole("textbox", { name: "Name (required)", exact: true })
  await input.fill("Joanne")
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await expect(input).toHaveValue("Joanne")
  await page.getByRole("button", { name: "Reload saved answer" }).click()
  await expect(page.getByText("Saved answer: Joann.", { exact: false })).toBeVisible()
  await expect(input).toHaveValue("Joanne")
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await expect(input).toBeDisabled()
  await expect(page.getByRole("button", { name: "Other versions" })).toBeDisabled()
  await page.getByRole("button", { name: "Retry save" }).click()
  await expect(page.getByRole("button", { name: "Edit Name" })).toHaveText("Joanne")
  expect(writes[1]).toEqual(writes[2])
  await page.reload()
  await expect(page.getByRole("button", { name: "Edit Name" })).toHaveText("Joanne")
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test("revoked correction preserves unsaved text but cannot save or regain access", async ({ page }) => {
  let revoked = false
  await page.route("**/api/public/forms/intake", route => {
    const command = route.request().postDataJSON()
    if (revoked) return route.fulfill({ status: 403, json: { error: "Response access removed.", uncertain: false } })
    expect(command.action).toBe("responses")
    return route.fulfill({ json: { value: { version, permissions: { canCorrect: true, canManageAccess: false }, responses: [response], next: null } } })
  })
  await page.goto("/?form-intake&direct-responses")
  await page.getByRole("button", { name: "Edit Name" }).click()
  const input = page.getByRole("textbox", { name: "Name (required)", exact: true })
  await input.fill("Unsaved correction"); revoked = true
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await expect(page.getByText("Response access removed.", { exact: true })).toBeVisible()
  await expect(input).toHaveValue("Unsaved correction")
  await page.getByRole("button", { name: "Cancel", exact: true }).click()
  await expect(page.getByRole("button", { name: "Edit Name" })).toHaveCount(0)
  await expect(page.getByText("Joan", { exact: true })).toHaveCount(0)
})


test("accessible forms paginate, retry, lock during correction and navigate on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 950 })
  let failed = false
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message))
  await page.route("**/api/public/forms/intake", async (route) => {
    const command = route.request().postDataJSON()
    if (command.action === "response_forms") {
      if (command.after && !failed) { failed = true; return route.fulfill({ status: 503, json: { error: "Unavailable.", uncertain: false } }) }
      return route.fulfill({ json: { value: command.after
        ? { forms: [{ formId: id(21), versionId: id(81), title: "Volunteer interest" }], next: null }
        : { forms: [{ formId: id(20), versionId: id(80), title: version.title }, { formId: id(22), versionId: id(82), title: "Another form" }], next: id(22) } } })
    }
    expect(command.action).toBe("responses")
    const current = command.versionId === id(81) ? { ...version, id: id(81), formId: id(21), title: "Volunteer interest" } : version
    return route.fulfill({ json: { value: { version: current, permissions: { canCorrect: true, canManageAccess: false }, responses: command.versionId === id(81) ? [] : [response], next: null } } })
  })
  await page.goto("/?form-intake&direct-responses")
  await page.getByRole("button", { name: "Your forms", exact: true }).focus(); await page.keyboard.press("Enter")
  const directory = page.getByRole("region", { name: "Accessible forms" })
  await expect(directory.locator('[aria-current="page"]')).toHaveText("Community sign up (current)")
  await expect(directory.getByRole("link", { name: "Another form" })).toHaveAttribute("href", `/forms/responses/${id(82)}`)
  await page.getByRole("button", { name: "Edit Name", exact: true }).click()
  await expect(page.getByRole("button", { name: "Your forms", exact: true })).toBeDisabled()
  await expect(directory.getByRole("link")).toHaveCount(0)
  await expect(directory.getByRole("button", { name: "More forms" })).toBeDisabled()
  await page.getByRole("button", { name: "Cancel", exact: true }).click()
  await directory.getByRole("button", { name: "More forms" }).click()
  await expect(directory.getByRole("alert")).toHaveText("Unable to load forms.")
  await directory.getByRole("button", { name: "Retry forms" }).click()
  await expect(directory.getByRole("link", { name: "Volunteer interest" })).toBeVisible()
  await directory.getByRole("button", { name: "First forms" }).click()
  await expect(directory.locator('[aria-current="page"]')).toBeVisible()
  await directory.getByRole("button", { name: "More forms" }).click()
  await directory.getByRole("link", { name: "Volunteer interest" }).click()
  await expect(page).toHaveURL(new RegExp(`/forms/responses/${id(81)}$`))
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Volunteer interest")
  await page.reload()
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Volunteer interest")
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
})

test("accessible forms refresh after neighbor revocation and clear on anchor denial", async ({ page }) => {
  let neighbor = true, denied = false
  await page.route("**/api/public/forms/intake", (route) => {
    const command = route.request().postDataJSON()
    if (command.action === "response_forms") return route.fulfill(denied
      ? { status: 403, json: { error: "Form access removed.", uncertain: false } }
      : { json: { value: { forms: neighbor ? [{ formId: id(21), versionId: id(81), title: "Private neighbor" }] : [], next: null } } })
    return route.fulfill({ json: { value: { version, permissions: { canCorrect: false, canManageAccess: false }, responses: [response], next: null } } })
  })
  await page.goto("/?form-intake&direct-responses")
  await page.getByRole("button", { name: "Your forms", exact: true }).click()
  await expect(page.getByRole("link", { name: "Private neighbor" })).toBeVisible()
  neighbor = false
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")))
  await expect(page.getByRole("link", { name: "Private neighbor" })).toHaveCount(0)
  await expect(page.getByText("No more accessible forms.")).toBeVisible()
  denied = true
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")))
  await expect(page.getByRole("alert")).toHaveText("Form access removed.")
  await expect(page.getByRole("region", { name: "Accessible forms" })).toHaveCount(0)
  await expect(page.getByText("Joan", { exact: true })).toHaveCount(0)
})
