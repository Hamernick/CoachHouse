import { expect, test, type Page } from "@playwright/test"
import { loginSupportFixture, seedWorkspaceSupportFixture, switchSupportFixture } from "./fixtures/workspace-support-auth"

let fixture: Awaited<ReturnType<typeof seedWorkspaceSupportFixture>>
test.beforeAll(async () => { fixture = await seedWorkspaceSupportFixture() })
test.afterAll(async () => { await fixture?.cleanup() })

async function openOrigin(page: Page, entry: string, orgId: string) {
  if (entry === "assets") {
    await page.goto(`/organizations/${orgId}`)
    await page.getByRole("tab", { name: "Assets & Files" }).click()
    await page.getByRole("button", { name: "Open file Origin Story", exact: true }).click()
  } else await page.goto(entry === "drawer" ? "/workspace?drawer=roadmap&section=origin-story" : "/workspace/roadmap/origin-story")
  const editor = page.getByLabel("Origin Story", { exact: true })
  await expect(editor).toHaveAttribute("contenteditable", "true")
  return editor
}

for (let actor = 0; actor < 4; actor++) for (let org = 0; org < 2; org++) for (const entry of ["drawer", "page", "assets"]) {
  test(`support ${actor + 1}, ${org ? "paid" : "free"} organization, ${entry}: type/save/reopen`, async ({ page }) => {
    const account = fixture.support[actor]
    const organization = fixture.organizations[org]
    await loginSupportFixture(page, account)
    // Asset dialogs open in the existing admin view, whose project privileges are separate from support mode.
    if (entry !== "assets") await switchSupportFixture(page, organization)
    const editor = await openOrigin(page, entry, organization.id)
    const marker = ` edited-${actor}-${org}-${entry}-${Date.now()}`
    await editor.press("ControlOrMeta+End")
    await editor.pressSequentially(marker)
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible()
    // Verify the real projection and actor audit, not only a success label.
    await expect.poll(async () => {
      const { data } = await fixture.admin.from("organizations").select("profile").eq("user_id", organization.id).single()
      return JSON.stringify(data?.profile)
    }).toContain(marker)
    const { data: versions } = await fixture.admin.from("organization_core_document_versions").select("actor_id,content")
      .eq("org_id", organization.id).eq("section_id", "origin_story").order("created_at", { ascending: false }).limit(1)
    expect(versions?.[0].actor_id).toBe(account.id)
    await page.reload()
    const reopened = await openOrigin(page, entry, organization.id)
    await expect(reopened).toContainText(marker)
  })
}

test("presence outage and a lost commit response preserve editing and saved content", async ({ page }) => {
  await loginSupportFixture(page, fixture.support[0])
  await switchSupportFixture(page, fixture.organizations[0])
  await page.route("**/api/account/*presence", route => route.abort())
  const editor = await openOrigin(page, "drawer", fixture.organizations[0].id)
  await expect(page.getByText("Live cursors unavailable")).toBeVisible()
  await expect(page.getByText("Live support presence is unavailable. Reopen the workspace before editing.")).toHaveCount(0)
  let dropped = false
  await page.route("**/api/account/document-collaboration", async route => {
    const input = route.request().postDataJSON()
    if (!dropped && input.steps?.length) { dropped = true; await route.fetch(); await route.abort() }
    else await route.continue()
  })
  const marker = ` recovered-${Date.now()}`
  await editor.press("ControlOrMeta+End")
  await editor.pressSequentially(marker)
  await expect.poll(() => dropped).toBe(true)
  await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible()
  await page.reload()
  await expect(await openOrigin(page, "drawer", fixture.organizations[0].id)).toContainText(marker)
})

test("two real staff sessions converge and undo preserves the other staff edit", async ({ browser }) => {
  const one = await browser.newContext({ baseURL: test.info().project.use.baseURL })
  const two = await browser.newContext({ baseURL: test.info().project.use.baseURL })
  try {
    const a = await one.newPage(); const b = await two.newPage()
    await loginSupportFixture(a, fixture.support[0]); await loginSupportFixture(b, fixture.support[1])
    await switchSupportFixture(a, fixture.organizations[0]); await switchSupportFixture(b, fixture.organizations[0])
    const first = await openOrigin(a, "drawer", fixture.organizations[0].id)
    const second = await openOrigin(b, "drawer", fixture.organizations[0].id)
    const suffix = Date.now()
    await first.press("ControlOrMeta+End"); await first.pressSequentially(` alpha-${suffix}`)
    await second.press("ControlOrMeta+End"); await second.pressSequentially(` beta-${suffix}`)
    await expect(first).toContainText(`beta-${suffix}`)
    await expect(second).toContainText(`alpha-${suffix}`)
    await first.press("ControlOrMeta+z")
    await expect(first).not.toContainText(`alpha-${suffix}`)
    await expect(first).toContainText(`beta-${suffix}`)
    await expect(second).not.toContainText(`alpha-${suffix}`)
  } finally { await one.close(); await two.close() }
})

test("switching another tab cannot retarget an already open document", async ({ context, page }) => {
  await loginSupportFixture(page, fixture.support[0])
  await switchSupportFixture(page, fixture.organizations[0])
  const editor = await openOrigin(page, "drawer", fixture.organizations[0].id)
  const second = await context.newPage()
  await second.goto("/workspace")
  await switchSupportFixture(second, fixture.organizations[1])
  const marker = ` pinned-${Date.now()}`
  await editor.press("ControlOrMeta+End"); await editor.pressSequentially(marker)
  await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible()
  const { data } = await fixture.admin.from("organizations").select("user_id,profile").in("user_id", fixture.organizations.map(org => org.id))
  expect(JSON.stringify(data?.find(row => row.user_id === fixture.organizations[0].id)?.profile)).toContain(marker)
  expect(JSON.stringify(data?.find(row => row.user_id === fixture.organizations[1].id)?.profile)).not.toContain(marker)
})

test("live revocation locks an unsaved editor without discarding its draft", async ({ page }) => {
  const account = fixture.support[2]
  await loginSupportFixture(page, account)
  await switchSupportFixture(page, fixture.organizations[0])
  const editor = await openOrigin(page, "drawer", fixture.organizations[0].id)
  await page.route("**/api/account/document-collaboration", route => route.abort())
  const marker = ` unsaved-${Date.now()}`
  await editor.press("ControlOrMeta+End"); await editor.pressSequentially(marker)
  try {
    const { error } = await fixture.admin.from("workspace_support_grants").update({ revoked_at: new Date().toISOString() }).eq("user_id", account.id)
    expect(error).toBeNull()
    await page.unroute("**/api/account/document-collaboration")
    await expect(editor).toHaveAttribute("contenteditable", "false")
    await expect(editor).toContainText(marker)
    await expect(page.getByRole("button", { name: "Download my current copy" })).toBeVisible()
  } finally {
    const { error } = await fixture.admin.from("workspace_support_grants").update({ revoked_at: null }).eq("user_id", account.id)
    expect(error).toBeNull()
  }
})

test("ordinary roles and revoked staff retain their document restrictions", async ({ browser }) => {
  for (const [index, organization, editable] of [[6, 1, false], [7, 1, true], [4, 0, false], [8, 0, false]] as const) {
    const context = await browser.newContext({ baseURL: test.info().project.use.baseURL })
    try {
      const page = await context.newPage()
      await loginSupportFixture(page, fixture.accounts[index])
      const response = await page.request.get(`/api/account/document-capabilities?organizationId=${fixture.organizations[organization].id}`)
      const result = await response.json()
      if (index === 8) { expect(response.status()).toBe(403); expect(result).toHaveProperty("error") }
      else { expect(response.status()).toBe(200); expect(result.capabilities.canEdit).toBe(editable) }
    } finally { await context.close() }
  }
})
