import { createUIMessageStream, createUIMessageStreamResponse } from "ai"
import { scope } from "./fixture-data"
import { expect, test } from "@playwright/test"
import type { ResearchRequest, ResearchResult } from "../../../src/features/workspace-ai/research-types"

for (const protocol of ["json", "stream"] as const) test(`private conversation reloads, refines and adds only the latest plan (${protocol})`, async ({ page }) => {
  let recoveryReads = 0
  let threadReads = 0
  let readGate: Promise<void> | undefined
  const turns: { request: ResearchRequest; result: ResearchResult; rootId: string }[] = []
  await page.route("**/__fixture/conversation", async route => {
    await readGate
    const rootId = route.request().postDataJSON().rootId
    if (rootId) threadReads++
    const selected = rootId ? turns.filter(turn => turn.rootId === rootId) : turns.filter(turn => !turns.some(other => other.request.parentRunId === turn.request.id))
    const entries = selected.map(turn => ({ id: turn.request.id, rootId: turn.rootId,
      turn: turns.filter(other => other.rootId === turn.rootId).indexOf(turn) + 1,
      createdAt: `2026-11-05T12:00:0${turns.indexOf(turn)}Z`, status: "succeeded", title: turn.result.title }))
    await route.fulfill({ json: { entries, ...(rootId ? { turns: selected.map((turn, index) => ({ ...entries[index], prompt: turn.request.prompt,
      title: turn.result.title, summary: turn.result.summary, applied: false, unavailable: false })) } : {}) } })
  })
  await page.route("**/api/workspace-ai/research", async route => {
    const request = route.request().postDataJSON() as ResearchRequest
    const parent = turns.find(turn => turn.request.id === request.parentRunId)
    const result: ResearchResult = { runId: request.id, target: request.target, title: parent ? "Smaller garden pilot" : "Community garden", summary: parent ? "Start with one raised bed." : "Prepare the garden and invite volunteers.",
      questions: [], decisions: [], removeReferences: [], sources: [], items: [
        { key: "first", title: parent ? "Prepare one raised bed" : "Prepare the garden", kind: "note", description: request.prompt, referenceId: null, evidenceIds: [], dependsOn: [] },
      ] }
    turns.push({ request, result, rootId: parent?.rootId ?? request.id })
    await page.evaluate(result => localStorage.setItem(`revision-result:${result.runId}`, JSON.stringify(result)), result)
    const run = { version: 1, resultRevision: 1, applicability: "review_required", id: request.id, credits: 1, status: "succeeded", result }
    expect(route.request().headers()["x-coach-house-chat"]).toBe("1")
    if (protocol === "json") await route.fulfill({ json: { run } })
    else {
      const identity = { version: 1, streamId: crypto.randomUUID(), runId: request.id, requestId: request.id, target: request.target,
        scope: { organizationId: request.target.organizationId, canvasId: null, userId: scope.userId }, emittedAt: new Date().toISOString() }
      const response = createUIMessageStreamResponse({ stream: createUIMessageStream({ execute: ({writer}) => {
        writer.write({ type: "start", messageId: request.id })
        const events = [{ kind: "run.started", payload: {} }, { kind: "phase.changed", payload: { phase: "reading" } },
          { kind: "run.snapshot", payload: { watermark: 3, run } }, { kind: "run.terminal", payload: { status: "succeeded" } }]
        events.forEach((event, index) => writer.write({ type: "data-research", data: { ...identity, sequence: index + 1, ...event }, transient: true }))
        writer.write({ type: "finish" })
      } }) })
      await route.fulfill({ status: 200, headers: Object.fromEntries(response.headers), body: await response.text() })
    }
  })
  await page.route("**/__fixture/revision-read", async route => {
    recoveryReads += 1
    await readGate
    const id = route.request().postDataJSON().id
    return route.fulfill({ json: { run: { version: 1, resultRevision: 1, applicability: "review_required", id, credits: 1, status: "succeeded", result: turns.find(turn => turn.request.id === id)?.result } } })
  })
  await page.goto("/?revisions&new-objective")
  const input = page.getByRole("textbox", { name: "Plan an objective or search Particles" })
  await input.fill("Plan a community garden")
  await input.press("Enter")
  await page.getByRole("button", { name: "Generate plan", exact: true }).click()
  await expect(page.getByRole("button", { name: "Add to board", exact: true })).toBeEnabled()
  await expect(input).toBeEnabled()
  await expect(input).toHaveText("")
  await input.fill("Make it smaller: one raised bed")
  await input.press("Enter")
  await expect.poll(() => turns.length).toBe(2)
  expect(turns[1].request.parentRunId).toBe(turns[0].request.id)
  expect(turns[1].request.prompt).toBe("Make it smaller: one raised bed")
  await expect(page.getByRole("region", { name: "Chat conversation" }).getByText("Smaller garden pilot", { exact: true })).toBeVisible()
  await expect(page.getByRole("combobox", { name: "Choose chat" })).toHaveCount(0)
  await expect(page.getByRole("complementary", { name: "App sidebar" }).getByRole("button", { name: "New chat", exact: true })).toBeVisible()
  expect(recoveryReads).toBe(0)
  await page.reload()
  await expect(page.getByRole("region", { name: "Chat conversation" })).not.toBeVisible()
  await input.hover()
  await page.getByRole("button", { name: "Open", exact: true }).click()
  await expect(page.getByRole("region", { name: "Chat conversation" }).getByText("Smaller garden pilot", { exact: true })).toBeVisible()
  await expect(page.getByRole("list", { name: "Conversation", exact: true }).getByRole("listitem")).toHaveCount(2)
  await expect(page.getByRole("textbox")).toHaveCount(1)
  expect(turns).toHaveLength(2)
  // Returning focus revalidates without clearing bubbles, the preview or draft.
  await input.fill("Keep this draft during revalidation")
  let releaseRead = () => {}
  readGate = new Promise<void>(resolve => { releaseRead = resolve })
  const beforeFocusReads = recoveryReads, beforeFocusThreads = threadReads
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"))
    document.dispatchEvent(new Event("visibilitychange"))
    window.dispatchEvent(new Event("focus"))
  })
  await expect.poll(() => recoveryReads).toBe(beforeFocusReads + 1)
  await expect(page.getByRole("list", { name: "Conversation", exact: true }).getByRole("listitem")).toHaveCount(2)
  await expect(page.getByRole("region", { name: "Chat conversation" }).getByText("Smaller garden pilot", { exact: true })).toBeVisible()
  await expect(input).toHaveText("Keep this draft during revalidation")
  await expect(input).toHaveAttribute("contenteditable", "true")
  await input.fill("Keep typing during revalidation")
  await expect(page.getByRole("button", { name: "Generate plan", exact: true })).toBeDisabled()
  await expect(page.getByRole("button", { name: "Add to board", exact: true })).toBeDisabled()
  releaseRead(); readGate = undefined
  await expect.poll(() => threadReads).toBe(beforeFocusThreads + 1)
  await expect(page.getByRole("button", { name: "Add to board", exact: true })).toBeEnabled()
  await expect(input).toHaveText("Keep typing during revalidation")
  await input.fill("")
  const readsBeforeReopen = threadReads
  await page.evaluate(() => { (window as unknown as { chatFrame: Element | null }).chatFrame = document.querySelector('[data-workspace-chat-session]') })
  await page.getByRole("button", { name: "Minimize chat", exact: true }).click()
  await expect.poll(async () => (await page.locator('[data-workspace-chat-session]').boundingBox())!.height).toBeLessThan(80)
  await page.evaluate(() => {
    const state = window as unknown as { chatHeights: number[] }
    state.chatHeights = []
    const sample = () => {
      state.chatHeights.push(document.querySelector('[data-workspace-chat-session]')!.getBoundingClientRect().height)
      if (state.chatHeights.length < 45) requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
  await page.getByRole("complementary", { name: "App sidebar" }).getByRole("button", { name: "Smaller garden pilot", exact: true }).click()
  await expect(page.getByRole("region", { name: "Chat conversation" })).toBeVisible()
  await expect(page.getByRole("button", { name: "New chat", exact: true })).toBeEnabled()
  expect(threadReads).toBe(readsBeforeReopen + 1)
  await page.waitForFunction(() => (window as unknown as { chatHeights: number[] }).chatHeights.length === 45)
  const heights = await page.evaluate(() => (window as unknown as { chatHeights: number[] }).chatHeights)
  expect(heights.some(height => height > Math.min(...heights) + 5 && height < Math.max(...heights) - 5)).toBe(true)
  expect(await page.evaluate(() => (window as unknown as { chatFrame: Element | null }).chatFrame === document.querySelector('[data-workspace-chat-session]'))).toBe(true)
  await input.fill("Keep this unsent draft")
  const expandedInput = await input.boundingBox()
  await page.getByRole("button", { name: "Minimize chat", exact: true }).click()
  await expect(page.getByRole("region", { name: "Chat conversation" })).not.toBeVisible()
  await expect(input).toHaveText("Keep this unsent draft")
  await input.hover()
  await page.getByRole("button", { name: "Open", exact: true }).click()
  await expect(page.getByRole("region", { name: "Chat conversation" })).toBeVisible()
  await expect(input).toHaveText("Keep this unsent draft")
  await expect.poll(async () => Math.abs((await input.boundingBox())!.y - expandedInput!.y)).toBeLessThan(1)
  await input.fill("")
  expect(turns).toHaveLength(2)
  await expect(page.getByText(/credits charged|Maximum approved|OpenAI ·/)).toHaveCount(0)
  await page.screenshot({path: `.tmp/chat-ui-${protocol}-light.png`})
  if (protocol === "stream") {
    const before = await input.boundingBox()
    await page.locator('[data-slot="message-scroller-viewport"]').evaluate(node => { node.scrollTop = 0 })
    const after = await input.boundingBox()
    expect(after!.y).toBeCloseTo(before!.y, 0)
    await page.evaluate(() => document.documentElement.classList.add("dark"))
    await page.setViewportSize({width:390,height:844})
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({path: ".tmp/chat-ui-mobile-dark.png"})
    await page.setViewportSize({width:1100,height:950})
  }
  await page.getByRole("button", { name: "New chat", exact: true }).click()
  await expect(page.getByRole("button", { name: "Add to board", exact: true })).toHaveCount(0)
  await expect(input).toHaveText("")
  await input.fill("Plan another community project")
  await input.press("Enter")
  await expect.poll(() => turns.length).toBe(3)
  expect(turns[2].request.parentRunId).toBeUndefined()
  await expect(page.getByRole("button", { name: "Add to board", exact: true })).toBeEnabled()
  await page.getByRole("complementary", { name: "App sidebar" }).getByRole("button", { name: "Smaller garden pilot", exact: true }).click()
  await expect(page.getByRole("region", { name: "Chat conversation" }).getByText("Smaller garden pilot", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Add to board", exact: true }).click()
  const state = async () => JSON.parse(await page.getByTestId("revision-state").textContent() ?? "{}")
  await expect.poll(async () => (await state()).particles.length).toBe(2)
  expect((await state()).particles.find((particle: { type: string }) => particle.type === "objective").title).toBe("Smaller garden pilot")
  expect(turns).toHaveLength(3)
})

test("chat sidebar collapses, renames, pins and deletes persisted entries", async ({ page }) => {
  const entries = ["First chat", "Second chat", "Third chat"].map((title, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 201).padStart(12, "0")}`,
    rootId: `00000000-0000-4000-8000-${String(index + 201).padStart(12, "0")}`,
    turn: 1, createdAt: `2026-11-05T12:0${index}:00Z`, status: "failed", title, pinned: false, metadataRevision: 0, deleted: false,
  }))
  let providerCalls = 0
  await page.route("**/api/workspace-ai/research", route => { providerCalls++; return route.abort() })
  await page.route("**/__fixture/conversation", route => {
    const {rootId} = route.request().postDataJSON()
    const current = entries.filter(entry => !entry.deleted && (!rootId || entry.rootId === rootId))
    return route.fulfill({json:{entries:current, ...(rootId ? {turns:current.map(entry => ({...entry,prompt:"Earlier request",summary:null,applied:false,unavailable:false}))} : {})}})
  })
  await page.route("**/__fixture/revision-read", route => route.fulfill({json:{run:{version:1,id:route.request().postDataJSON().id,status:"failed",credits:0,result:null,resultRevision:null,applicability:"unavailable"}}}))
  await page.route("**/__fixture/conversation-update", route => {
    const {change} = route.request().postDataJSON()
    const entry = entries.find(entry => entry.rootId === change.rootId)!
    expect(change.revision).toBe(entry.metadataRevision)
    entry.metadataRevision++
    if (change.action === "rename") entry.title=change.title
    if (change.action === "pin") entry.pinned=change.pinned
    if (change.action === "delete") entry.deleted=true
    return route.fulfill({json:{ok:true}})
  })
  await page.goto("/?revisions&new-objective")
  const sidebar = page.getByRole("complementary", {name:"App sidebar"})
  const recent = sidebar.getByRole("button",{name:"Recents",exact:true})
  const newChat = sidebar.getByRole("button",{name:"New chat",exact:true})
  await expect(newChat).toBeEnabled()
  const a=await recent.boundingBox(),b=await newChat.boundingBox()
  expect(Math.abs(a!.y+a!.height/2-b!.y-b!.height/2)).toBeLessThan(2)
  await page.mouse.move(800,800)
  await expect(recent.locator("svg")).toHaveCSS("opacity","0")
  await recent.hover();await expect(recent.locator("svg")).toHaveCSS("opacity","1")
  await recent.click();await expect(sidebar.getByRole("button",{name:"First chat",exact:true})).not.toBeVisible()
  await recent.click()
  await sidebar.getByRole("button",{name:"First chat",exact:true}).hover()
  await sidebar.getByRole("button",{name:"Options for First chat",exact:true}).click()
  await expect(page.getByRole("menuitem")).toHaveCount(3)
  await page.getByRole("menuitem",{name:"Rename",exact:true}).click()
  const name=sidebar.getByRole("textbox",{name:"Chat name"});await expect(name).toBeFocused()
  await name.fill("Renamed chat");await name.press("Enter")
  await expect(sidebar.getByRole("button",{name:"Renamed chat",exact:true})).toBeEnabled()
  await expect(sidebar.getByRole("button",{name:"Renamed chat",exact:true})).toBeFocused()
  await sidebar.getByRole("button",{name:"Renamed chat",exact:true}).hover()
  await sidebar.getByRole("button",{name:"Pin Renamed chat",exact:true}).click()
  await expect(sidebar.getByRole("button",{name:"Unpin Renamed chat",exact:true})).toBeEnabled()
  await expect(sidebar.locator('[data-sidebar="menu-button"]').first()).toHaveText("Renamed chat")
  await page.reload();await expect(newChat).toBeEnabled()
  await expect(sidebar.locator('[data-sidebar="menu-button"]').first()).toHaveText("Renamed chat")
  await sidebar.getByRole("button",{name:"Renamed chat",exact:true}).click()
  await expect(newChat).toBeEnabled()
  await sidebar.getByRole("button",{name:"Options for Renamed chat",exact:true}).click()
  await page.getByRole("menuitem",{name:"Delete",exact:true}).click()
  await page.getByRole("alertdialog").getByRole("button",{name:"Cancel",exact:true}).click()
  expect(entries[0].deleted).toBe(false)
  await sidebar.getByRole("button",{name:"Renamed chat",exact:true}).hover()
  await sidebar.getByRole("button",{name:"Options for Renamed chat",exact:true}).click()
  await page.getByRole("menuitem",{name:"Delete",exact:true}).click()
  await page.getByRole("alertdialog").getByRole("button",{name:"Delete",exact:true}).click()
  await expect(sidebar.getByRole("button",{name:"Renamed chat",exact:true})).toHaveCount(0)
  await expect(page.getByRole("region",{name:"Chat conversation"})).not.toBeVisible()
  await page.reload();await expect(newChat).toBeEnabled()
  await expect(sidebar.getByRole("button",{name:"Renamed chat",exact:true})).toHaveCount(0)
  expect(providerCalls).toBe(0)
})

test("chat revalidation keeps verified history until a rejected read removes it", async ({ page }) => {
  const id = "00000000-0000-4000-8000-000000000301"
  const entry = { id, rootId: id, turn: 1, createdAt: "2026-11-05T12:00:00Z", status: "failed", title: "Private chat" }
  let denied = false, providerCalls = 0, reads = 0
  let gate: Promise<void> | undefined
  await page.route("**/api/workspace-ai/research", route => { providerCalls++; return route.abort() })
  await page.route("**/__fixture/conversation", async route => {
    reads++
    await gate
    const { rootId } = route.request().postDataJSON()
    return route.fulfill({ json: { entries: [entry], ...(rootId ? { turns: [{ ...entry,
      prompt: denied ? "" : "Private prior request", summary: null, title: null, applied: false, unavailable: denied,
    }] } : {}) } })
  })
  await page.route("**/__fixture/revision-read", route => route.fulfill({ json: { run: {
    version: 1, id, status: "failed", credits: 0, result: null, resultRevision: null, applicability: "unavailable",
  } } }))
  await page.goto("/?revisions&new-objective")
  const input = page.getByRole("textbox", { name: "Plan an objective or search Particles" })
  await expect(page.getByRole("button", { name: "Open", exact: true })).toBeAttached()
  await input.hover()
  await page.getByRole("button", { name: "Open", exact: true }).click()
  const message = page.getByRole("region", { name: "Chat conversation" }).getByText("Private prior request", { exact: true })
  await expect(message).toBeVisible()
  let release = () => {}
  gate = new Promise<void>(resolve => { release = resolve })
  denied = true
  const before = reads
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" })
    document.dispatchEvent(new Event("visibilitychange"))
  })
  await expect(message).toBeVisible()
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" })
    document.dispatchEvent(new Event("visibilitychange"))
    window.dispatchEvent(new Event("focus"))
  })
  await expect.poll(() => reads).toBe(before + 1)
  await expect(message).toBeVisible()
  release(); gate = undefined
  await expect(message).toHaveCount(0)
  expect(reads).toBe(before + 2)
  expect(providerCalls).toBe(0)
})

for (const protocol of ["json", "stream"] as const) test(`reopened chat revises its accepted plan without changing notes or dependencies (${protocol})`, async ({ page }) => {
  const turns: { request: ResearchRequest; result: ResearchResult }[] = []
  const graph = () => page.evaluate(() => JSON.parse(localStorage.getItem("revision-graph") ?? '{"particles":[]}'))
  const saved = async (id: string) => {
    const state = await graph()
    return state.particles.find((p: { type: string; data: { planning?: { proposals: { researchRunId?: string }[] } } }) =>
      p.type === "objective" && p.data.planning?.proposals.some(proposal => proposal.researchRunId === id))
  }
  await page.route("**/__fixture/conversation", async route => {
    const { rootId } = route.request().postDataJSON()
    const selected = rootId ? turns : turns.slice(-1)
    const entries = selected.map(turn => ({ id: turn.request.id, rootId: turns[0].request.id, target: turn.request.target,
      turn: turns.indexOf(turn) + 1, createdAt: `2026-11-05T12:00:0${turns.indexOf(turn)}Z`, status: "succeeded", title: turn.result.title }))
    await route.fulfill({ json: { entries, ...(rootId ? { turns: await Promise.all(selected.map(async (turn, index) => {
      const applied = await saved(turn.request.id)
      return { ...entries[index], prompt: turn.request.prompt, summary: applied ? null : turn.result.summary, title: turn.result.title,
        applied: Boolean(applied), unavailable: false, ...(applied ? { savedPlan: { id: applied.id, title: applied.title, description: null } } : {}) }
    })) } : {}) } })
  })
  await page.route("**/__fixture/conversation-prepare", async route => {
    const parent = turns.find(turn => turn.request.id === route.request().postDataJSON().parentRunId)!
    const objective = await saved(parent.request.id)
    const plan = objective?.data.planning.plans[0]
    await route.fulfill({ json: plan ? { target: { organizationId: scope.organizationId, objectiveId: objective.id, revision: objective.revision, plan: { id: plan.id, revision: plan.revision } } }
      : { error: "Accept the proposed plan on the board before revising it in chat." } })
  })
  await page.route("**/__fixture/revision-read", async route => {
    const id = route.request().postDataJSON().id, turn = turns.find(turn => turn.request.id === id)!
    const applied = await saved(id)
    await route.fulfill({ json: { run: { version: 1, resultRevision: 1, applicability: applied ? "already_applied" : "review_required",
      id, credits: 1, status: "succeeded", result: applied ? null : turn.result, ...(applied ? { appliedObjectiveId: applied.id } : {}) } } })
  })
  await page.route("**/api/workspace-ai/research", async route => {
    const request = route.request().postDataJSON() as ResearchRequest
    const state = await graph(), kept = state.particles.filter((p: {type: string}) => p.type === "activity")
    const result: ResearchResult = { runId: request.id, target: request.target, title: kept.length ? "Revised garden pilot" : "Garden pilot", summary: "Prepare the garden.", questions: [], decisions: [], removeReferences: [],
      sources: kept.map((p: {id: string; title: string; revision: number}) => ({ id: `particle:${p.id}`, title: p.title, href: "/workspace", revision: String(p.revision), checkedAt: new Date().toISOString(), kind: "workspace" })),
      items: kept.length ? [] : ["Welcome volunteers", "Prepare check-in"].map((title, index) => ({ key: `note${index}`, title, kind: kept.length ? "reference" : "note", description: "Keep the work", referenceId: kept.length ? `particle:${kept.find((p: {title: string}) => p.title === title).id}` : null, evidenceIds: [], dependsOn: index ? ["note0"] : [] })) }
    turns.push({ request, result })
    await page.evaluate(result => localStorage.setItem(`revision-result:${result.runId}`, JSON.stringify(result)), result)
    expect(route.request().headers()["x-coach-house-chat"]).toBe("1")
    const run = { version: 1, id: request.id, resultRevision: 1, applicability: "review_required", credits: 1, status: "succeeded", result }
    if (protocol === "json") await route.fulfill({ json: { run } })
    else {
      const response = createUIMessageStreamResponse({ stream: createUIMessageStream({ execute: ({ writer }) => {
        writer.write({ type: "start", messageId: request.id })
        writer.write({ type: "data-research", transient: true, data: {
          version: 1, streamId: crypto.randomUUID(), runId: request.id, requestId: request.id, target: request.target,
          scope: { organizationId: scope.organizationId, canvasId: null, userId: scope.userId }, emittedAt: new Date().toISOString(),
          sequence: 1, kind: "run.snapshot", payload: { watermark: 1, run },
        } })
        writer.write({ type: "finish" })
      } }) })
      await route.fulfill({ status: 200, headers: Object.fromEntries(response.headers), body: await response.text() })
    }
  })
  await page.goto("/?revisions&new-objective")
  const input = page.getByRole("textbox", { name: "Plan an objective or search Particles" })
  await input.fill("Plan a garden"); await input.press("Enter")
  await page.getByRole("button", { name: "Generate plan", exact: true }).click()
  await page.getByRole("button", { name: "Add to board", exact: true }).click()
  await page.getByRole("list", { name: "Objectives list" }).getByRole("button", { name: "Garden pilot Not started", exact: true }).click()
  await page.getByRole("button", { name: "Accept Garden pilot", exact: true }).click()
  const accepted = await graph(), objective = accepted.particles.find((p: {type: string}) => p.type === "objective")
  const originalPlan = objective.data.planning.plans[0]
  const notes = accepted.particles.filter((p: {id: string}) => originalPlan.particleIds.includes(p.id))
  expect(notes.map((p: {title: string}) => p.title).sort()).toEqual(["Prepare check-in", "Welcome volunteers"])
  expect(originalPlan.links).toEqual([{ source: notes.find((p: {title: string}) => p.title === "Welcome volunteers").id,
    target: notes.find((p: {title: string}) => p.title === "Prepare check-in").id }])
  await page.reload()
  await input.hover(); await page.getByRole("button", { name: "Open", exact: true }).click()
  await expect(input).toHaveAttribute("contenteditable", "true")
  await input.fill("Rename this plan Revised garden pilot. Keep the same work."); await input.press("Enter")
  await expect.poll(() => turns.length).toBe(2)
  expect(turns[1].request.parentRunId).toBe(turns[0].request.id)
  expect(turns[1].request.target).toEqual({ organizationId: scope.organizationId, objectiveId: objective.id, revision: objective.revision, plan: { id: originalPlan.id, revision: originalPlan.revision } })
  await expect(page.getByRole("button", { name: "Add proposal", exact: true })).toBeEnabled()
  const preserved = page.waitForResponse(response => response.url().endsWith("/__fixture/research-draft") &&
    response.request().postDataJSON().id === turns[1].request.id && response.request().postDataJSON().input?.attempted === true)
  await page.getByRole("button", { name: "Add proposal", exact: true }).click()
  expect((await (await preserved).json()).checkpoint).toMatchObject({ attempted: true, draft: { title: "Revised garden pilot", items: [] } })
  await page.getByRole("list", { name: "Objectives list" }).getByRole("button", { name: "Garden pilot Not started", exact: true }).click()
  await page.getByRole("button", { name: "Accept Revised garden pilot", exact: true }).click()
  await expect(page.getByRole("button", { name: "Accept Revised garden pilot", exact: true })).toHaveCount(0)
  const revised = await graph(), next = revised.particles.find((p: {id: string}) => p.id === objective.id)
  expect(revised.particles.map((p: {id: string}) => p.id)).toEqual(accepted.particles.map((p: {id: string}) => p.id))
  expect(next.data.planning.plans).toHaveLength(1)
  expect(next.data.planning.plans[0]).toMatchObject({ id: originalPlan.id, title: "Revised garden pilot", particleIds: originalPlan.particleIds, links: originalPlan.links })
  expect(revised.particles.filter((p: {id: string}) => originalPlan.particleIds.includes(p.id))).toEqual(notes)
  await page.reload(); await input.hover(); await page.getByRole("button", { name: "Open", exact: true }).click()
  await expect(input).toHaveAttribute("contenteditable", "true")
  await expect(page.getByRole("list", { name: "Conversation", exact: true }).getByRole("listitem")).toHaveCount(2)
  expect(await graph()).toEqual(revised)
  expect(turns).toHaveLength(2)
})

test("older chat pages preserve scroll and drafts without generating or resetting the chat", async ({ page }) => {
  const rootId = "00000000-0000-4000-8000-000000000501"
  const turns = Array.from({ length: 16 }, (_, index) => ({ id: `00000000-0000-4000-8000-${String(501 + index).padStart(12, "0")}`, rootId,
    turn: index + 1, createdAt: `2026-11-05T12:${String(index).padStart(2, "0")}:00Z`, status: "failed", title: "Long chat",
    prompt: `Earlier request ${index + 1}: preserve the existing work and all its details.`, summary: null, applied: false, unavailable: false }))
  let providerCalls = 0, olderReads = 0, denied = false
  await page.route("**/api/workspace-ai/research", route => { providerCalls++; return route.abort() })
  await page.route("**/__fixture/conversation", async route => {
    const body = route.request().postDataJSON()
    if (!body.rootId) return route.fulfill({ json: { entries: [turns[15]] } })
    if (body.beforeTurn) olderReads++
    const selected = turns.filter(turn => !body.beforeTurn || turn.turn < body.beforeTurn).slice(-12)
    return route.fulfill({ json: { entries: selected, turns: selected.map(turn => denied && turn.turn <= 4 ? { ...turn, unavailable: true, prompt: "" } : turn),
      beforeTurn: selected.length === 12 && selected[0].turn > 1 ? selected[0].turn : null } })
  })
  await page.route("**/__fixture/revision-read", route => route.fulfill({ json: { run: {
    version: 1, id: turns[15].id, status: "failed", credits: 0, result: null, resultRevision: null, applicability: "unavailable",
  } } }))
  await page.goto("/?revisions&new-objective")
  const input = page.getByRole("textbox", { name: "Plan an objective or search Particles" })
  await expect(page.getByRole("button", { name: "Open", exact: true })).toBeAttached()
  await input.hover(); await page.getByRole("button", { name: "Open", exact: true }).click()
  const viewport = page.locator('[data-slot="message-scroller-viewport"]')
  await expect(page.getByRole("list", { name: "Conversation", exact: true }).getByRole("listitem")).toHaveCount(12)
  expect(olderReads).toBe(0)
  await input.fill("Keep this unsent instruction")
  await viewport.hover(); await page.mouse.wheel(0, -5000)
  await expect(page.getByRole("list", { name: "Conversation", exact: true }).getByRole("listitem")).toHaveCount(16)
  expect(olderReads).toBe(1)
  await expect(input).toHaveText("Keep this unsent instruction")
  await expect.poll(() => viewport.evaluate(node => node.scrollTop)).toBeGreaterThan(0)
  await viewport.evaluate(node => { node.scrollTop = 0 })
  await expect(page.getByText(turns[0].prompt, { exact: true })).toBeVisible()
  // A focus refresh reauthorizes older loaded pages too.
  denied = true
  await page.evaluate(() => window.dispatchEvent(new Event("focus")))
  await expect(page.getByText(turns[0].prompt, { exact: true })).toHaveCount(0)
  await expect(page.getByRole("list", { name: "Conversation", exact: true }).getByRole("listitem")).toHaveCount(12)
  await expect(input).toHaveText("Keep this unsent instruction")
  expect(providerCalls).toBe(0)
})

for (const protocol of ["json", "stream"] as const) test(`answers and clarification remain chat messages through reload and a later proposal (${protocol})`, async ({ page }) => {
  const turns: { request: ResearchRequest; result: ResearchResult }[] = []
  let draftReads = 0
  page.on("request", request => { if (request.url().includes("/__fixture/research-draft")) draftReads++ })
  const snapshot = (turn: typeof turns[number]) => ({ version: 1, id: turn.request.id, status: "succeeded", credits: 1, resultRevision: 1,
    applicability: turn.result.responseKind === "proposal" ? "review_required" : "read_only", result: turn.result })
  await page.route("**/__fixture/conversation", async route => {
    const rootId = route.request().postDataJSON().rootId
    const selected = rootId ? turns : turns.slice(-1)
    const entries = selected.map(turn => ({ id: turn.request.id, rootId: turns[0].request.id, turn: turns.indexOf(turn) + 1,
      createdAt: `2026-11-05T12:00:0${turns.indexOf(turn)}Z`, status: "succeeded", title: turn.result.title, responseKind: turn.result.responseKind }))
    await route.fulfill({ json: { entries, ...(rootId ? { turns: selected.map((turn, index) => ({ ...entries[index], prompt: turn.request.prompt, title: turn.result.title, summary: turn.result.summary, applied: false, unavailable: false })) } : {}) } })
  })
  await page.route("**/__fixture/revision-read", async route => {
    const turn = turns.find(turn => turn.request.id === route.request().postDataJSON().id)!
    await route.fulfill({ json: { run: snapshot(turn) } })
  })
  await page.route("**/api/workspace-ai/research", async route => {
    const request = route.request().postDataJSON() as ResearchRequest
    const responseKind = turns.length === 0 ? "answer" : turns.length === 1 ? "clarify" : "proposal"
    const result: ResearchResult = { runId: request.id, target: request.target, responseKind, answerEvidenceIds: [], title: "Volunteer pilot",
      summary: responseKind === "answer" ? "A pilot tests a small version first." : responseKind === "clarify" ? "How many volunteers will attend?" : "Start with five volunteers.",
      questions: [], decisions: [], removeReferences: [], sources: [], items: responseKind === "proposal" ? [{ key: "first", title: "Welcome five volunteers", kind: "note", description: "Check in five volunteers.", referenceId: null, evidenceIds: [], dependsOn: [] }] : [] }
    const turn = { request, result }; turns.push(turn)
    await page.evaluate(result => localStorage.setItem(`revision-result:${result.runId}`, JSON.stringify(result)), result)
    const run = snapshot(turn)
    if (protocol === "json") { await route.fulfill({ json: { run } }); return }
    const identity = { version: 1, streamId: crypto.randomUUID(), runId: request.id, requestId: request.id, target: request.target,
      scope: { organizationId: request.target.organizationId, canvasId: null, userId: scope.userId }, emittedAt: new Date().toISOString() }
    const response = createUIMessageStreamResponse({ stream: createUIMessageStream({ execute: ({ writer }) => {
      writer.write({ type: "start", messageId: request.id })
      const events = [{ kind: "run.started", payload: {} }, { kind: "run.snapshot", payload: { watermark: 2, run } }, { kind: "run.terminal", payload: { status: "succeeded" } }]
      events.forEach((event, index) => writer.write({ type: "data-research", data: { ...identity, sequence: index + 1, ...event }, transient: true }))
      writer.write({ type: "finish" })
    } }) })
    await route.fulfill({ status: 200, headers: Object.fromEntries(response.headers), body: await response.text() })
  })
  await page.goto("/?revisions&new-objective")
  const input = page.getByRole("textbox", { name: "Plan an objective or search Particles" })
  const chat = page.getByRole("region", { name: "Chat conversation" })
  await input.fill("What is a pilot?"); await input.press("Enter")
  await page.getByRole("button", { name: "Generate plan", exact: true }).click()
  await expect(chat.getByText("A pilot tests a small version first.", { exact: true })).toBeVisible()
  await expect(input).toBeEnabled()
  await expect(page.getByRole("button", { name: "Add to board", exact: true })).toHaveCount(0)
  await input.fill("Plan a volunteer pilot"); await input.press("Enter")
  await expect(chat.getByText("How many volunteers will attend?", { exact: true })).toBeVisible()
  expect(turns[1].request.parentRunId).toBe(turns[0].request.id)
  expect(draftReads).toBe(0)
  await page.reload()
  await input.hover(); await page.getByRole("button", { name: "Open", exact: true }).click()
  await expect(chat.getByText("How many volunteers will attend?", { exact: true })).toBeVisible()
  await expect(chat.getByText("A pilot tests a small version first.", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Edit preview", exact: true })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Add to board", exact: true })).toHaveCount(0)
  expect(draftReads).toBe(0)
  await input.fill("Five volunteers"); await input.press("Enter")
  await expect(chat.getByText("Welcome five volunteers", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Add to board", exact: true })).toBeEnabled()
  expect(turns[2].request.parentRunId).toBe(turns[1].request.id)
  expect(turns).toHaveLength(3)
})

test("chat navigation stays enabled during background reads and New chat does not reload the list", async ({ page }) => {
  const id = "00000000-0000-4000-8000-000000000309"
  const entry = { id, rootId: id, turn: 1, createdAt: "2026-11-05T12:00:00Z", status: "failed", title: "Existing chat" }
  let reads = 0, release = () => {}
  let gate: Promise<void> | undefined
  await page.route("**/__fixture/conversation", async route => {
    reads++
    await gate
    const { rootId } = route.request().postDataJSON()
    await route.fulfill({ json: { entries: [entry], ...(rootId ? { turns: [{ ...entry, prompt: "Saved request", summary: null, title: null, applied: false, unavailable: false }] } : {}) } })
  })
  await page.route("**/__fixture/revision-read", route => route.fulfill({ json: { run: { version: 1, id, status: "failed", credits: 0, result: null, resultRevision: null, applicability: "unavailable" } } }))
  await page.goto("/?revisions&new-objective")
  const sidebar = page.getByRole("complementary", { name: "App sidebar" })
  const newChat = sidebar.getByRole("button", { name: "New chat", exact: true })
  const existing = sidebar.getByRole("button", { name: "Existing chat", exact: true })
  await expect(existing).toBeEnabled()
  await expect(newChat).toBeEnabled()
  const initial = reads
  gate = new Promise<void>(resolve => { release = resolve })
  await page.evaluate(() => { window.dispatchEvent(new Event("focus")); document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("focus")) })
  await expect.poll(() => reads).toBe(initial + 1)
  await expect(existing).toBeEnabled()
  await expect(newChat).toBeEnabled()
  await page.evaluate(() => window.dispatchEvent(new Event("focus")))
  // A known list stays available while its current authorization is rechecked.
  await newChat.click()
  expect(reads).toBe(initial + 1)
  await expect(existing).toBeEnabled()
  release(); gate = undefined
  const input = page.getByRole("textbox", { name: "Plan an objective or search Particles" })
  await input.fill("New unsent draft")
  await existing.click()
  await expect(page.getByRole("region", { name: "Chat conversation" }).getByText("Saved request", { exact: true })).toBeVisible()
  await expect(newChat).toBeEnabled()
  const loaded = reads
  await existing.click()
  await expect(newChat).toBeEnabled()
  await expect.poll(() => reads).toBe(loaded + 1)
  await newChat.click()
  await expect(input).toHaveText("")
  expect(reads).toBe(loaded + 1)
})


test("Shift-click selects canvas cards without extending page text selection", async ({ page }) => {
  await page.goto("/?canvas-selection")
  const first = page.locator('.react-flow__node[data-id="alpha"]')
  const second = page.locator('.react-flow__node[data-id="beta"]')
  await first.click()
  await page.getByTestId("outside-text").evaluate(el => {
    const range = document.createRange(); range.setStart(el.firstChild!, 0); range.collapse(true)
    const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range)
  })
  await page.keyboard.down("Shift")
  await second.click()
  await page.keyboard.up("Shift")
  await expect(first).toHaveClass(/selected/)
  await expect(second).toHaveClass(/selected/)
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe("")
  const before = (await second.boundingBox())!
  await second.hover(); await page.mouse.down(); await page.mouse.move(before.x + before.width / 2 + 80, before.y + before.height / 2 + 60, { steps: 5 }); await page.mouse.up()
  await expect.poll(async () => (await second.boundingBox())!.x).toBeGreaterThan(before.x + 20)
  const input = page.getByRole("textbox", { name: "Canvas text field" })
  await input.focus()
  await input.evaluate((el: HTMLInputElement) => el.setSelectionRange(0, 0))
  await input.click({ modifiers: ["Shift"], position: { x: 60, y: 10 } })
  expect(await input.evaluate((el: HTMLInputElement) => el.selectionEnd! - el.selectionStart!)).toBeGreaterThan(0)
})


test("planning columns sit below the input, expand independently and preserve its position", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/?chat-planning")
  const input = page.getByRole("textbox", { name: "Search Particles or enter a command" })
  const planning = page.locator("[data-workspace-chat-planning]")
  await expect(planning).toBeVisible()
  const form = input.locator("xpath=ancestor::form")
  const returnToChat = async () => {
    await page.getByRole("button", {name: "Return to chat", exact: true}).click()
    await expect.poll(async () => {
      const surface = (await page.locator(".workspace-layout-surface").boundingBox())!
      const panel = (await planning.boundingBox())!
      return surface.y + surface.height - panel.y - panel.height
    }).toBeGreaterThan(60)
    await expect.poll(async () => {
      const surface = (await page.locator(".workspace-layout-surface").boundingBox())!
      const panel = (await planning.boundingBox())!
      return surface.y + surface.height - panel.y - panel.height
    }).toBeLessThan(90)
  }
  await page.mouse.move(30, 120)
  await page.mouse.down()
  await page.mouse.move(180, 120, {steps: 8})
  await page.mouse.up()
  await returnToChat()
  const bar = (await form.boundingBox())!, columns = (await planning.boundingBox())!
  expect(bar.y + bar.height).toBeGreaterThan(950 - 180)
  expect(columns.y).toBeGreaterThanOrEqual(bar.y + bar.height)
  expect(columns.x).toBeCloseTo(bar.x, 0); expect(columns.width).toBeCloseTo(bar.width, 0)
  await page.getByRole("button", { name: "Objectives", exact: true }).click()
  await page.getByRole("textbox", { name: "Objective draft" }).fill("Keep objective draft")
  await page.getByRole("button", { name: "Opportunities", exact: true }).click()
  await expect(page.getByRole("button", { name: "Objectives", exact: true })).toHaveAttribute("aria-expanded", "true")
  await expect(page.getByRole("button", { name: "Opportunities", exact: true })).toHaveAttribute("aria-expanded", "true")
  const a = (await page.getByRole("button", { name: "Objectives", exact: true }).boundingBox())!
  const b = (await page.getByRole("button", { name: "Opportunities", exact: true }).boundingBox())!
  expect(a.y).toBeCloseTo(b.y, 0); expect(b.x).toBeGreaterThan(a.x + a.width)
  expect((await form.boundingBox())!.y).toBeCloseTo(bar.y, 0)
  await page.getByRole("button", { name: "Objectives", exact: true }).click()
  await page.getByRole("button", { name: "Objectives", exact: true }).click()
  await expect(page.getByRole("textbox", { name: "Objective draft" })).toHaveValue("Keep objective draft")
  await returnToChat()
  await page.getByRole("button", {name: "Objectives", exact: true}).click()
  await page.getByRole("button", {name: "Opportunities", exact: true}).click()
  await expect.poll(async () => (await planning.boundingBox())!.height).toBeLessThan(60)
  await returnToChat()
  expect((await form.boundingBox())!.y + (await form.boundingBox())!.height).toBeGreaterThan(950 - 180)
  await page.setViewportSize({width:390,height:844})
  await page.reload()
  await expect(planning).toBeVisible()
  await expect.poll(async () => (await planning.boundingBox())!.width).toBeLessThan(390)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const tabs = page.getByRole("tablist", {name: "Planning", exact: true})
  await expect(tabs).toBeVisible()
  await expect(page.getByRole("textbox", {name: "Objective draft"})).toBeVisible()
  await page.getByRole("textbox", {name: "Objective draft"}).fill("Retain mobile draft")
  await page.getByRole("tab", {name: "Opportunities", exact: true}).click()
  await expect(page.getByRole("textbox", {name: "Objective draft"})).not.toBeVisible()
  await expect(page.getByRole("textbox", {name: "Opportunity draft"})).toBeVisible()
  await page.getByRole("tab", {name: "Opportunities", exact: true}).press("ArrowLeft")
  await expect(page.getByRole("tab", {name: "Objectives", exact: true})).toHaveAttribute("aria-selected", "true")
  await expect(page.getByRole("textbox", {name: "Objective draft"})).toHaveValue("Retain mobile draft")

})
