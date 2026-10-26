import { expect, test } from "@playwright/test"
import { mkdir, readFile } from "node:fs/promises"

const missionText = "We connect young people with local mentors and practical opportunities so they can build a confident, independent future."

test("compact cards use native links and contain no embedded accelerator", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" })
  let initialReads = 0
  page.on("request", request => { if (request.method() === "GET" && request.url().endsWith("/api/companion/sandbox")) initialReads++ })
  await page.goto("/companion")
  await expect(page.getByRole("link", { name: "Open lesson", exact: true })).toBeVisible()
  expect(initialReads).toBe(1)
  await expect(page.getByRole("link", { name: "Open lesson", exact: true })).toHaveAttribute("href", /https:\/\/coachhouse.app\/accelerator\/class\//)
  await expect(page.getByRole("link", { name: "Open workspace", exact: true })).toHaveAttribute("href", "https://coachhouse.app/workspace")
  await expect(page.getByRole("textbox")).toHaveCount(0)
  await expect(page.getByRole("tablist")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Next question", exact: true })).toHaveCount(0)
  await mkdir(".tmp/companion-browser", { recursive: true })
  await page.screenshot({ path: ".tmp/companion-browser/action-card-light.png", fullPage: true })
  await page.emulateMedia({ colorScheme: "dark" })
  await expect(page.locator("html")).toHaveClass(/dark/)
  await page.screenshot({ path: ".tmp/companion-browser/action-card-dark.png", fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: ".tmp/companion-browser/action-card-mobile.png", fullPage: true })
})

test("review card saves exact approved text and fresh read restores it", async ({ page }) => {
  await page.goto("/companion?example=review")
  await expect(page.getByRole("button", { name: "Save change", exact: true })).toBeVisible()
  await page.screenshot({ path: ".tmp/companion-browser/review-card-light.png", fullPage: true })
  const initial = await (await page.request.get("/api/companion/sandbox")).json()
  expect(initial.snapshot.document.content).toBe("")
  await page.getByRole("button", { name: "Save change", exact: true }).focus()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("button", { name: "Save change", exact: true })).toHaveCount(0)
  const saved = await (await page.request.get("/api/companion/sandbox")).json()
  expect(saved.snapshot.document.content).toBe(missionText)
  expect(saved.snapshot.document.revision).toBe(1)
  expect(saved.snapshot.submission.completed).toBe(false)
  await page.reload()
  await expect(page.getByText("No change needed. The sandbox document already matches this proposal.", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Save change", exact: true })).toHaveCount(0)
  await page.goto("/companion")
  await expect(page.getByRole("link", { name: "Open workspace", exact: true })).toBeVisible()
  const resumed = await (await page.request.get("/api/companion/sandbox")).json()
  expect(resumed.snapshot.document.content).toBe(missionText)
  expect(resumed.snapshot.organization.id).toBe(saved.snapshot.organization.id)
})

test("stale review cannot overwrite another editor's saved document", async ({ page }) => {
  await page.goto("/companion?example=review")
  await expect(page.getByRole("button", { name: "Save change", exact: true })).toBeVisible()
  const initial = await (await page.request.get("/api/companion/sandbox")).json()
  const concurrent = await page.request.post("/api/companion/sandbox", {
    headers: { origin: "http://127.0.0.1:3150" }, data: { name: "companion_save_document", arguments: {
      organizationId: initial.snapshot.organization.id, requestId: "concurrent-editor", expectedRevision: 0, content: "Another editor's mission", confirmed: true,
    } },
  })
  expect(concurrent.ok()).toBe(true)
  await page.getByRole("button", { name: "Save change", exact: true }).click()
  await expect(page.getByRole("alert").filter({ hasText: "changed elsewhere" })).toBeVisible()
  const saved = await (await page.request.get("/api/companion/sandbox")).json()
  expect(saved.snapshot.document.content).toBe("Another editor's mission")
  await expect(page.getByText(missionText, { exact: true })).toBeVisible()
})

test("calendar result downloads an actual ICS file", async ({ page }) => {
  await page.goto("/companion")
  await expect(page.getByRole("link", { name: "Open lesson", exact: true })).toBeVisible()
  const initial = await (await page.request.get("/api/companion/sandbox")).json()
  const scheduled = await page.request.post("/api/companion/sandbox", { headers: { origin: "http://127.0.0.1:3150" }, data: {
    name: "companion_schedule_block", arguments: { organizationId: initial.snapshot.organization.id, requestId: "browser-calendar", confirmed: true,
      title: "My next accelerator session", startsAt: "2026-10-27T14:00:00Z", endsAt: "2026-10-27T14:25:00Z", timeZone: "America/New_York" },
  } })
  expect(scheduled.ok()).toBe(true)
  await page.reload()
  const download = page.waitForEvent("download")
  await page.getByRole("link", { name: "Download .ics", exact: true }).click()
  const delivered = await download
  const file = await delivered.path()
  expect(file).not.toBeNull()
  const content = await readFile(file!, "utf8")
  expect(content.match(/BEGIN:VEVENT/g)).toHaveLength(1)
  expect(content).toContain("DTSTART:20261027T140000Z")
  expect(content).toContain("DTEND:20261027T142500Z")
})

test("bundled MCP Apps card renders and approves through a test host bridge", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", error => errors.push(error.message))
  await page.goto("/companion")
  await expect(page.getByRole("link", { name: "Open lesson", exact: true })).toBeVisible()
  const html = await readFile("build/companion-widget/index.html", "utf8")
  await page.evaluate(async (widgetHtml) => {
    const initial = await (await fetch("/api/companion/sandbox")).json()
    const preview = await (await fetch("/api/companion/sandbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      name: "companion_review_document", arguments: { organizationId: initial.snapshot.organization.id, content: "A reviewed mission from the test host." },
    }) })).json()
    await fetch("/api/companion/sandbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      name: "companion_schedule_block", arguments: { organizationId: initial.snapshot.organization.id, requestId: "test-host-export", confirmed: true,
        title: "Next session", startsAt: "2026-10-27T14:00:00Z", endsAt: "2026-10-27T14:25:00Z", timeZone: "UTC" },
    }) })
    document.body.replaceChildren()
    const frame = document.createElement("iframe")
    frame.id = "mcp-widget"
    frame.style.cssText = "width:100%;height:100vh;border:0"
    window.addEventListener("message", async (event) => {
      if (event.source !== frame.contentWindow || event.data?.jsonrpc !== "2.0" || event.data.id === undefined) return
      const { id, method, params } = event.data
      let result: unknown = {}
      if (method === "ui/initialize") result = { protocolVersion: params.protocolVersion, hostInfo: { name: "Companion test host", version: "1.0.0" }, hostCapabilities: { serverTools: {}, downloadFile: {} }, hostContext: { theme: "light", displayMode: "inline" } }
      else if (method === "tools/call") {
        const response = await fetch("/api/companion/sandbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
          name: params.name, arguments: { ...params.arguments, organizationId: params.arguments.organizationId ?? initial.snapshot.organization.id },
        }) })
        const data = await response.json()
        result = response.ok ? { content: [{ type: "text", text: data.message }], structuredContent: { ...data, ...(params.name === "companion_get_session" ? { proposal: preview.proposal } : {}) } } : { isError: true, content: [{ type: "text", text: data.error }] }
      }
      else if (method === "ui/download-file") {
        const proof = document.createElement("pre")
        proof.id = "download-proof"
        proof.hidden = true
        proof.textContent = params.contents[0].resource.text
        document.body.append(proof)
      }
      frame.contentWindow?.postMessage({ jsonrpc: "2.0", id, result }, "*")
    })
    frame.srcdoc = widgetHtml
    document.body.append(frame)
  }, html)
  const frame = page.frameLocator("#mcp-widget")
  await expect(frame.getByRole("button", { name: "Save change", exact: true })).toBeVisible()
  await frame.getByRole("button", { name: "Save change", exact: true }).click()
  await expect(frame.getByRole("button", { name: "Save change", exact: true })).toHaveCount(0)
  const saved = await (await page.request.get("/api/companion/sandbox")).json()
  expect(saved.snapshot.document.content).toBe("A reviewed mission from the test host.")
  await frame.getByRole("button", { name: "Download .ics", exact: true }).click()
  await expect(page.locator("#download-proof")).toContainText("DTSTART:20261027T140000Z")
  await expect(frame.getByRole("status")).toContainText("Download requested")
  expect(errors).toEqual([])
  await page.screenshot({ path: ".tmp/companion-browser/mcp-apps-card-test-host.png", fullPage: true })
})

test("connected card uses the host-selected organization, exact approval and separate readback", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", error => errors.push(error.message))
  await page.goto("/companion")
  await expect(page.getByRole("link", { name: "Open lesson", exact: true })).toBeVisible()
  const html = (await readFile("build/companion-widget/index.html", "utf8")).replace("<head>", '<head><meta name="coach-house-companion-mode" content="connected">')
  await page.evaluate(async widgetHtml => {
    const initial = await (await fetch("/api/companion/sandbox")).json()
    const snapshot = {
      ...initial.snapshot, mode: "connected",
      lesson: { ...initial.snapshot.lesson, href: "https://staging.coachhouse.example/class/foundations/module/1", body: "Published lesson fixture", videoUrl: null, resources: [], completionMode: "all_answered", fields: initial.snapshot.lesson.fields.map((field: Record<string, unknown>) => ({ ...field, type: "long_text" })) },
      draft: { ...initial.snapshot.draft, visibility: "personal" },
      document: { ...initial.snapshot.document, id: "mission", revision: "a".repeat(64), visibility: "organization", href: "https://staging.coachhouse.example/workspace/roadmap/mission-vision-values" },
      coachingHref: "https://staging.coachhouse.example/coaching",
    }
    const proposal = { organizationId: snapshot.organization.id, lessonId: snapshot.lesson.id, documentId: "mission", expectedRevision: snapshot.document.revision, content: "Exact reviewed connected fixture.", visibility: "organization" }
    const calls: Array<{ name: string; arguments: Record<string, unknown> }> = []
    document.body.replaceChildren()
    const proof = document.createElement("pre")
    proof.id = "connected-proof"
    proof.hidden = true
    proof.textContent = JSON.stringify(calls)
    document.body.append(proof)
    const frame = document.createElement("iframe")
    frame.id = "connected-widget"
    frame.style.cssText = "width:100%;height:100vh;border:0"
    window.addEventListener("message", event => {
      if (event.source !== frame.contentWindow || event.data?.jsonrpc !== "2.0") return
      const { id, method, params } = event.data
      if (method === "ui/notifications/initialized") {
        frame.contentWindow?.postMessage({ jsonrpc: "2.0", method: "ui/notifications/tool-result", params: { content: [{ type: "text", text: "Connected test-host fixture" }], structuredContent: { snapshot, proposal, message: "Review fixture" } } }, "*")
        return
      }
      if (id === undefined) return
      let result: unknown = {}
      if (method === "ui/initialize") result = { protocolVersion: params.protocolVersion, hostInfo: { name: "Connected test host", version: "1" }, hostCapabilities: { serverTools: {} }, hostContext: { theme: "light", displayMode: "inline" } }
      else if (method === "tools/call") {
        calls.push(params)
        if (params.name === "companion_save_document") snapshot.document = { ...snapshot.document, content: params.arguments.content, revision: "b".repeat(64) }
        result = { content: [{ type: "text", text: "Connected fixture result" }], structuredContent: { snapshot: structuredClone(snapshot), message: "Verified connected fixture" } }
        proof.textContent = JSON.stringify(calls)
      }
      frame.contentWindow?.postMessage({ jsonrpc: "2.0", id, result }, "*")
    })
    frame.srcdoc = widgetHtml
    document.body.append(frame)
  }, html)
  const frame = page.frameLocator("#connected-widget")
  await expect(frame.getByRole("button", { name: "Save change", exact: true })).toBeVisible()
  await expect(frame.getByRole("link", { name: "Book coaching", exact: true })).toHaveAttribute("href", "https://staging.coachhouse.example/coaching")
  await expect(page.locator("#connected-proof")).toHaveText("[]")
  await frame.getByRole("button", { name: "Save change", exact: true }).click()
  await expect(frame.getByRole("button", { name: "Save change", exact: true })).toHaveCount(0)
  const calls = JSON.parse(await page.locator("#connected-proof").textContent() ?? "[]")
  expect(calls.map((call: { name: string }) => call.name)).toEqual(["companion_save_document", "companion_get_session"])
  expect(calls[0].arguments).toMatchObject({ documentId: "mission", expectedRevision: "a".repeat(64), content: "Exact reviewed connected fixture.", confirmed: true })
  expect(calls[0].arguments.lessonId).toBeTruthy()
  expect(calls[0].arguments.requestId).toBeTruthy()
  expect(calls[0].arguments).not.toHaveProperty("visibility")
  expect(errors).toEqual([])
  await page.screenshot({ path: ".tmp/companion-browser/connected-card-test-host.png", fullPage: true })
})
