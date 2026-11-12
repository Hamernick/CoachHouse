import { expect, test, type Page, type Route } from "@playwright/test"

const items = [
  { id: "person:alice", revision: "1", title: "Alice", group: "People", available: true },
  { id: "document:mission", revision: "1", title: "Private mission", group: "Documents", available: true },
  { id: "particle:old", revision: "1", title: "Old private plan", group: "Plans", available: true },
]
const orgId = "00000000-0000-4000-8000-000000000020"
const ref = (item: typeof items[number]) => ({ id: item.id, revision: item.revision })
const input = (page: Page) => page.getByRole("textbox", { name: "Plan an objective or search Particles" })
async function setup(page: Page) {
  await page.route("**/__fixture/composer-context", route => route.fulfill({ json: { items, unavailable: [] } }))
  await page.goto("/?planner&context")
  await input(page).fill("Draft ")
}
async function add(page: Page, title: string) {
  await page.getByRole("button", { name: "Add files and more", exact: true }).click()
  await page.getByRole("option", { name: title, exact: true }).click()
  await input(page).press("End")
}
async function invalidate(page: Page, organizationId = orgId) {
  await page.evaluate(orgId => window.dispatchEvent(new CustomEvent("coach-house:workspace-access-changed", { detail: { orgId } })), organizationId)
}
async function paint(page: Page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}

test("checks exact references, hides pending labels, preserves prose and authorized mentions, and sends the scrubbed prompt", async ({ page }) => {
  await setup(page)
  await add(page, "Alice"); await add(page, "Private mission")
  await input(page).pressSequentially("with our team")
  await input(page).press("Enter")
  const generate = page.getByRole("button", { name: "Generate plan", exact: true })
  await expect(generate).toBeEnabled()
  let check: Route | undefined
  await page.route("**/__fixture/composer-context-check", route => { check = route })
  await invalidate(page)
  await expect.poll(() => check?.request().postDataJSON().references).toEqual(items.slice(0, 2).map(ref))
  await expect(input(page)).not.toContainText("Alice")
  await expect(input(page)).not.toContainText("Private mission")
  await expect(generate).toBeDisabled()
  await input(page).press("ControlOrMeta+a")
  const copied = await input(page).evaluate(element => {
    const clipboardData = new DataTransfer()
    element.dispatchEvent(new ClipboardEvent("copy", { bubbles: true, cancelable: true, clipboardData }))
    return { text: clipboardData.getData("text/plain"), html: clipboardData.getData("text/html") }
  })
  expect(copied.text).toContain("with our team")
  expect(copied.text).not.toContain("Private mission")
  expect(copied.html).not.toContain("Private mission")
  expect(copied.html).not.toContain("Alice")
  await check!.fulfill({ json: [ref(items[0])] })
  await expect(input(page)).toContainText("Alice")
  await expect(input(page)).not.toContainText("Private mission")
  await expect(input(page)).toContainText("Draft")
  await expect(input(page)).toContainText("with our team")
  let sent: { context: unknown; prompt: string } | undefined
  await page.route("**/api/workspace-ai/research", route => {
    sent = route.request().postDataJSON()
    return route.fulfill({ json: { error: "Fixture stopped before provider", reserved: false } })
  })
  await generate.click()
  await expect.poll(() => sent?.context).toEqual([ref(items[0])])
  expect(sent?.prompt).not.toContain("Mission")
  expect(sent?.prompt).not.toContain("Private mission")
  expect(sent?.prompt).toContain("@{Alice}")
  expect(sent?.prompt).toContain("with our team")
})

test("Undo and Redo cannot resurrect revoked or previously removed mentions, while prose history still works", async ({ page }) => {
  await setup(page)
  await add(page, "Old private plan")
  await input(page).getByRole("button", { name: "Remove Old private plan from context" }).click()
  await add(page, "Private mission")
  await page.route("**/__fixture/composer-context-check", route => route.fulfill({ json: [] }))
  await invalidate(page)
  await expect(input(page).getByRole("button")).toHaveCount(0)
  await input(page).press("End"); await input(page).pressSequentially("fresh prose")
  for (let i = 0; i < 8; i++) {
    await input(page).press("ControlOrMeta+z")
    await expect(input(page)).not.toContainText("private")
    await expect(input(page).locator("[data-composer-mention]")).toHaveCount(0)
  }
  for (let i = 0; i < 8; i++) {
    await input(page).press("ControlOrMeta+Shift+z")
    await expect(input(page)).not.toContainText("private")
  }
  await expect(input(page)).toContainText("fresh prose")
  await expect(input(page)).not.toContainText("@{")
})

test("a late successful check cannot restore a reference denied by a newer notification", async ({ page }) => {
  await setup(page); await add(page, "Private mission")
  let first: Route | undefined, count = 0
  await page.route("**/__fixture/composer-context-check", route => {
    count++
    if (count === 1) { first = route; return }
    return route.fulfill({ json: [] })
  })
  await invalidate(page)
  await expect.poll(() => Boolean(first)).toBe(true)
  await invalidate(page)
  await expect.poll(() => count).toBe(2)
  await expect(input(page).locator(".node-mention")).toHaveCount(0)
  const response = page.waitForResponse("**/__fixture/composer-context-check")
  await first!.fulfill({ json: [ref(items[1])] }); await response; await paint(page)
  await expect(input(page)).toHaveText("Draft")
  await input(page).press("ControlOrMeta+z")
  await expect(input(page)).not.toContainText("Private mission")
})

test("focus checks preserve allowed context; read failures fail closed without losing the draft", async ({ page }) => {
  await setup(page); await add(page, "Alice")
  let calls = 0
  await page.route("**/__fixture/composer-context-check", route => {
    calls++
    return calls === 1 ? route.fulfill({ json: [ref(items[0])] }) : route.fulfill({ status: 503, json: {} })
  })
  await page.evaluate(() => window.dispatchEvent(new Event("focus")))
  await expect.poll(() => calls).toBe(1)
  await expect(input(page).getByRole("button", { name: "Remove Alice from context" })).toBeVisible()
  await page.evaluate(() => window.dispatchEvent(new Event("online")))
  await expect(input(page).locator(".node-mention")).toHaveCount(0)
  await expect(input(page)).toHaveText("Draft")
  await input(page).pressSequentially("still editable")
  await expect(input(page)).toContainText("still editable")
})

test("other-tab revocation scrubs selected context without focus, ignoring foreign organizations", async ({ page, context }) => {
  await setup(page); await add(page, "Private mission")
  let calls = 0
  await page.route("**/__fixture/composer-context-check", route => { calls++; return route.fulfill({ json: [] }) })
  const other = await context.newPage()
  await other.goto("/")
  const send = (organizationId: string) => other.evaluate(orgId => {
    const channel = new BroadcastChannel("coach-house:workspace-access-changed")
    channel.postMessage({ version: 1, orgId, source: crypto.randomUUID() }); channel.close()
  }, organizationId)
  await send("99500000-0000-4000-8000-000000000001"); await paint(page)
  expect(calls).toBe(0)
  await send(orgId)
  await expect(input(page).locator(".node-mention")).toHaveCount(0)
  await expect(input(page)).toHaveText("Draft")
  expect(calls).toBe(1)
})

test("access changes cancel a prepared follow-up instead of replaying its stale captured prompt", async ({ page }) => {
  let runs = 0
  await page.route("**/api/workspace-ai/research", route => {
    runs++
    const request = route.request().postDataJSON()
    return route.fulfill({ json: { run: { version: 1, resultRevision: 1, applicability: "review_required", id: request.id,
      credits: 1, status: "succeeded", result: { runId: request.id, target: request.target, title: "Garden plan", summary: "Prepare the garden.",
        questions: [], decisions: [], removeReferences: [], sources: [], items: [
          { key: "first", title: "Prepare garden", kind: "note", description: "Garden work", referenceId: null, evidenceIds: [], dependsOn: [] },
        ] } } } })
  })
  await setup(page)
  await input(page).fill("Plan a garden"); await input(page).press("Enter")
  await page.getByRole("button", { name: "Generate plan", exact: true }).click()
  await expect(input(page)).toHaveText("")
  await input(page).fill("Revise with "); await add(page, "Private mission")
  let prepared: Route | undefined
  await page.route("**/__fixture/conversation-prepare", route => { prepared = route })
  await input(page).press("Enter")
  await expect.poll(() => Boolean(prepared)).toBe(true)
  await page.route("**/__fixture/composer-context-check", route => route.fulfill({ json: [] }))
  await invalidate(page)
  await expect(input(page).locator(".node-mention")).toHaveCount(0)
  const response = page.waitForResponse("**/__fixture/conversation-prepare")
  await prepared!.fulfill({ json: { target: prepared!.request().postDataJSON().target } }); await response
  await expect(input(page)).toBeEnabled(); await paint(page)
  await expect(input(page)).toHaveText("Revise with")
  expect(runs).toBe(1)
})

test("hidden context stays concealed until a visible check; typing during the check survives", async ({ page }) => {
  await setup(page); await add(page, "Private mission")
  let check: Route | undefined, calls = 0
  await page.route("**/__fixture/composer-context-check", route => { calls++; check = route })
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" })
    document.dispatchEvent(new Event("visibilitychange"))
  })
  await expect(input(page)).not.toContainText("Private mission")
  expect(calls).toBe(0)
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" })
    document.dispatchEvent(new Event("visibilitychange"))
  })
  await expect.poll(() => calls).toBe(1)
  await input(page).press("End"); await input(page).pressSequentially("keep this text")
  await check!.fulfill({ json: [] })
  await expect(input(page)).toHaveText("Draft keep this text")
})
