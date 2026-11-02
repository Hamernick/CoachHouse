import { expect, test } from "@playwright/test"
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const version = { schemaVersion: 1, id: id(80), formId: id(20), revision: 1, title: "Sign up", description: "", definition: { questions: [{ id: id(90), type: "text", label: "Name", required: true }] } }
for (const internalManage of [false, true]) test(`accepted external manager grants only bounded access with exact retry; organization manager ${internalManage}`, async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 950 }); await page.emulateMedia({ reducedMotion: "reduce" })
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message))
  let accepted = false, attempts = 0, revision = 1, revoked = false
  let child: { id: string; email: string; accepted: boolean; expiresAt: string; responsePermission: string } | null = null
  const writes: unknown[] = []
  await page.route("**/api/public/forms/intake", async (route) => {
    const command = route.request().postDataJSON()
    if (command.action === "responses") return route.fulfill((accepted || internalManage) && !revoked ? { json: { value: { version, permissions: { canCorrect: true, canEditDefinition: true, canManageAccess: internalManage, canManageInvitations: accepted, hasPendingInvitation: !accepted }, responses: [], next: null } } }
      : { status: 403, json: { error: "Form access required.", uncertain: false } })
    if (revoked) return route.fulfill({ status: 403, json: { error: "Form access required.", uncertain: false } })
    if (command.action === "viewer_offer") return route.fulfill({ json: { value: { invitationId: id(800), versionId: id(80), title: version.title, accepted: false, expiresAt: "2026-12-01T00:00:00Z", responsePermission: "manage" } } })
    if (command.action === "accept_viewer") { accepted = true; return route.fulfill({ json: { value: { invitationId: id(800), versionId: id(80), accepted: true } } }) }
    if (command.action === "review_access") return route.fulfill({ json: { value: { formId: id(20), revision, canGrantManage: false, reviewers: [] } } })
    if (command.action === "viewer_invitations") return route.fulfill({ json: { value: { formId: id(20), revision, canGrantManage: false, invitations: child ? [child] : [] } } })
    if (revoked) return route.fulfill({ status: 403, json: { error: "This invitation is unavailable for this account.", uncertain: false } })
    if (command.action === "invite_viewer") {
      expect(command.responsePermission).toBe("edit"); expect(command.expectedRevision).toBe(1); writes.push(command)
      child = { id: command.operationId, email: command.email, accepted: false, responsePermission: "edit", expiresAt: "2026-12-01T00:00:00Z" }; revision = 2
      if (++attempts === 1) return route.fulfill({ status: 503, json: { error: "Unable to confirm. Retry the same request.", uncertain: true } })
    } else { expect(command.action).toBe("revoke_viewer"); child = null; revision = 3 }
    return route.fulfill({ json: { value: { formId: id(20), operationId: command.operationId, invitationId: command.invitationId ?? command.operationId, revision } } })
  })
  await page.goto("/?form-intake&direct-responses")
  await expect(page.getByText(/further Manage delegation/)).toBeVisible()
  await page.getByRole("button", { name: "Accept form management" }).click()
  await expect(page.getByRole("button", { name: "Edit form", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Invited response collaborators" }).focus(); await page.keyboard.press("Enter")
  await expect(page.getByText("You can change only invitations you created. Their access ends when yours ends.")).toBeVisible()
  await page.getByLabel("Invitee email", { exact: true }).fill("collaborator@example.org")
  await page.getByRole("combobox", { name: "Response access", exact: true }).click()
  await expect(page.getByRole("option", { name: "Manage form access" })).toHaveCount(0)
  await page.getByRole("option", { name: "Edit form and responses" }).click()
  await page.getByRole("button", { name: "Create response invitation" }).click()
  await expect(page.getByLabel("Invitee email", { exact: true })).toBeDisabled()
  await expect(page.getByRole("button", { name: "Edit form", exact: true })).toBeDisabled()
  await page.getByRole("button", { name: "Retry invitation change" }).click()
  expect(writes[0]).toEqual(writes[1])
  await expect(page.getByText(/collaborator@example.org/)).toBeVisible()
  await page.getByRole("button", { name: "Revoke response invitation for collaborator@example.org" }).click()
  await expect(page.getByText("No invited collaborators.")).toBeVisible()
  revoked = true
  await page.getByLabel("Invitee email", { exact: true }).fill("another@example.org")
  await page.getByRole("button", { name: "Create response invitation" }).click()
  await expect(page.getByRole("button", { name: "Invited response collaborators" })).toHaveCount(0)
  await expect(page.getByRole("alert")).toHaveText("Form access required.")
  await expect(page.getByRole("button", { name: "Retry invitation change" })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
})
