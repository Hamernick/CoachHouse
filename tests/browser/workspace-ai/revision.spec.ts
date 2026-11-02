import { expect, test, type Page } from "@playwright/test"
import { researchRecovery } from "../../../src/features/workspace-ai/lib/research-recovery"
import type { ResearchRequest, ResearchResult } from "../../../src/features/workspace-ai/research-types"
import type { ParticleGraph } from "../../../src/features/workspace-particles/types"
import { researchProgressSchema, researchProgressWire } from "../../../src/features/workspace-ai/lib/research-progress"
import { scope } from "./fixture-data"

const kept = "00000000-0000-4000-8000-000000000104", removed = "00000000-0000-4000-8000-000000000105"
const first = "00000000-0000-4000-8000-000000000102", second = "00000000-0000-4000-8000-000000000103"
function response(request: ResearchRequest, removalOnly = false): ResearchResult {
  return {runId:request.id,target:request.target,title:"Workshop preparation revised",summary:"Fixture research: replace the old flyer while preserving completed venue work.",questions:[],decisions:[],removeReferences:[`particle:${removed}`],
    items:removalOnly?[]:[{key:"venue",title:"Venue confirmed",kind:"reference",description:"",referenceId:`particle:${kept}`,evidenceIds:[],dependsOn:[]},{key:"invitation",title:"Prepare invitations",kind:"note",description:"Use the approved venue details.",referenceId:null,evidenceIds:[],dependsOn:["venue"]}],
    sources:[{id:`particle:${kept}`,title:"Venue confirmed",href:"/workspace",revision:"0",checkedAt:"2026-10-24T12:00:00.000Z",kind:"workspace"},{id:`particle:${removed}`,title:"Old flyer",href:"/workspace",revision:"0",checkedAt:"2026-10-24T12:00:00.000Z",kind:"workspace"}]}
}
async function setup(page: Page, removalOnly = false, sources?: ResearchResult["sources"], unfulfilled?: string[]) {
  const runs = new Map<string, ResearchResult>()
  await page.route("**/api/workspace-ai/research",async route=>{
    const request=route.request().postDataJSON() as ResearchRequest
    const result=response(request,removalOnly);runs.set(request.id,result)
    if (sources) result.sources = sources
    if (unfulfilled) result.unfulfilled = unfulfilled
    await page.evaluate(({id,result})=>localStorage.setItem(`revision-result:${id}`,JSON.stringify(result)),{id:request.id,result})
    await route.fulfill({json:{run:{version:1,resultRevision:1,applicability:"review_required",id:result.runId,credits:null,status:"succeeded",result}}})
  })
  await page.route("**/__fixture/revision-read",async route=>{
    const {id}=route.request().postDataJSON()
    await route.fulfill({json:{run:{version:1,resultRevision:1,applicability:"review_required",id,credits:null,status:"succeeded",result:runs.get(id)}}})
  })
  await page.route("**/__fixture/revision-history",async route=>{
    const {target}=route.request().postDataJSON()
    await route.fulfill({json:{runs:[...runs.values()].filter(run=>run.target.organizationId===target.organizationId && run.target.objectiveId===target.objectiveId && run.target.plan?.id===target.plan?.id)
      .map(run=>({id:run.runId,status:"succeeded",created_at:"2026-10-30T10:00:00Z"}))}})
  })
  await page.goto("/?revisions")
  await expect(page.getByText("Fictional revision fixture.",{exact:false})).toBeVisible()
  return runs
}
async function openResearch(page:Page,title="Workshop preparation") {
  await page.getByRole("button",{name:`Options for ${title}`,exact:true}).click()
  await page.getByRole("menuitem",{name:"Revise with AI",exact:true}).click()
  await expect(page.getByRole("form",{name:"Revise plan with AI"})).toBeVisible()
}
async function generate(page:Page) {
  await page.getByRole("textbox",{name:"Research request"}).fill("Replace the old flyer and keep completed work.")
  await page.getByRole("button",{name:"Research",exact:true}).click()
  await expect(page.getByRole("button",{name:"Add proposal",exact:true})).toBeEnabled()
}
const graph = async(page:Page):Promise<ParticleGraph>=>JSON.parse(await page.getByTestId("revision-state").textContent()??"{}")
const planning = (state:ParticleGraph)=>state.particles.find(particle=>particle.type==="objective")!.data as {planning:{plans:{id:string;particleIds:string[];title:string}[];proposals:{status:string}[]}}

test("private draft autosave coalesces unfinished edits and restores without application", async ({ page }) => {
  const runs = await setup(page); await openResearch(page); await generate(page)
  const before = await graph(page), writes: unknown[] = []
  page.on("request", request => {
    if (request.url().endsWith("/__fixture/research-draft") && request.postDataJSON().input) writes.push(request.postDataJSON().input)
  })
  await page.clock.install()
  await page.getByRole("button", { name: "Edit preview", exact: true }).click()
  const title = page.getByRole("textbox", { name: "Plan title", exact: true })
  await title.fill("First private edit")
  await page.clock.runFor(1000)
  await title.fill(" ")
  await page.clock.runFor(1000)
  expect(writes).toHaveLength(0)
  await page.clock.runFor(500)
  await expect(page.getByText("Private draft saved. Not added to the plan.", { exact: true })).toBeVisible()
  expect(writes).toHaveLength(1)
  await page.clock.runFor(10000)
  expect(writes).toHaveLength(1)
  expect(await graph(page)).toEqual(before)
  expect(await page.evaluate(() => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]))).not.toContain("First private edit")
  await page.reload(); await openResearch(page)
  await expect(title).toHaveValue(" ")
  await expect(page.getByRole("button", { name: "Add proposal", exact: true })).toBeDisabled()
  expect(writes).toHaveLength(1); expect(runs.size).toBe(1)
})

test("private draft autosave keeps typing responsive and serializes newer edits", async ({ page }) => {
  await setup(page); await openResearch(page); await generate(page)
  const before = await graph(page)
  const writes: { revision: number; draft: { title: string } }[] = []
  let release: () => void = () => undefined
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route("**/__fixture/research-draft", async route => {
    const { input } = route.request().postDataJSON()
    if (!input) { await route.continue(); return }
    writes.push(input)
    if (writes.length === 1) await gate
    await route.continue()
  })
  await page.clock.install()
  await page.getByRole("button", { name: "Edit preview", exact: true }).click()
  const title = page.getByRole("textbox", { name: "Plan title", exact: true })
  await title.fill("First checkpoint")
  await page.clock.runFor(1500)
  await expect(page.getByText("Saving private draft…", { exact: true })).toBeVisible()
  await expect(title).toBeEnabled()
  await title.fill("Newer typing while saving")
  await page.clock.runFor(10000)
  expect(writes).toHaveLength(1)
  release()
  await expect(page.getByText("Saving private draft…", { exact: true })).toHaveCount(0)
  await expect(title).toHaveValue("Newer typing while saving")
  await expect(page.getByText("Private draft saved. Not added to the plan.", { exact: true })).toHaveCount(0)
  await page.clock.runFor(1500)
  await expect(page.getByText("Private draft saved. Not added to the plan.", { exact: true })).toBeVisible()
  expect(writes.map(write => [write.revision, write.draft.title])).toEqual([[0, "First checkpoint"], [1, "Newer typing while saving"]])
  expect(await graph(page)).toEqual(before)
})

for (const failure of ["uncertain", "conflict"] as const) {
  test(`private draft autosave ${failure} pauses without a retry loop`, async ({ page }) => {
    await setup(page); await openResearch(page); await generate(page)
    const before = await graph(page), writes: unknown[] = []
    await page.route("**/__fixture/research-draft", async route => {
      const { input } = route.request().postDataJSON()
      if (!input) { await route.continue(); return }
      writes.push(input)
      if (failure === "conflict") { await route.fulfill({ json: { error: "Draft changed elsewhere. Reopen research before saving.", conflict: true } }); return }
      if (writes.length === 1) { await route.fetch(); await route.abort(); return }
      await route.continue()
    })
    await page.clock.install()
    await page.getByRole("button", { name: "Edit preview", exact: true }).click()
    const title = page.getByRole("textbox", { name: "Plan title", exact: true })
    await title.fill("Retain this private edit")
    await page.clock.runFor(1500)
    await expect(page.getByRole("alert")).toContainText(failure === "conflict" ? "Draft changed elsewhere" : "Draft save unconfirmed")
    await page.clock.runFor(30000)
    expect(writes).toHaveLength(1)
    await expect(title).toHaveValue("Retain this private edit")
    await expect(title).toBeDisabled()
    expect(await graph(page)).toEqual(before)
    if (failure === "uncertain") {
      await page.getByRole("button", { name: "Retry draft", exact: true }).click()
      await expect(page.getByText("Private draft saved. Not added to the plan.", { exact: true })).toBeVisible()
      expect(writes).toHaveLength(2); expect(writes[1]).toEqual(writes[0])
    }
  })
}

test("private draft autosave pauses for discard confirmation and cancels on scope departure", async ({ page }) => {
  await setup(page); await openResearch(page); await generate(page)
  let writes = 0
  page.on("request", request => { if (request.url().endsWith("/__fixture/research-draft") && request.postDataJSON().input) writes++ })
  await page.clock.install()
  await page.getByRole("button", { name: "Edit preview", exact: true }).click()
  await page.getByRole("textbox", { name: "Plan title", exact: true }).fill("Do not save after departure")
  await page.getByRole("button", { name: "Close", exact: true }).click()
  await page.clock.runFor(10000)
  expect(writes).toBe(0)
  await page.getByRole("button", { name: "Keep editing", exact: true }).click()
  await page.clock.runFor(500)
  await openResearch(page, "Marketing")
  await page.clock.runFor(10000)
  expect(writes).toBe(0)
  await expect(page.getByText("Revise Marketing", { exact: true })).toBeVisible()
})

async function navigationLink(page: Page) {
  await page.evaluate(() => {
    const anchor = document.createElement("a")
    anchor.href = "/?revisions&destination"; anchor.textContent = "Leave fixture"
    document.querySelector("main")!.prepend(anchor)
  })
  return page.getByRole("link", { name: "Leave fixture", exact: true })
}

test("preview navigation keeps edits on cancel and recovers the saved run after confirmed departure", async ({ page }) => {
  const runs = await setup(page); await openResearch(page); await generate(page)
  const before = await graph(page)
  await page.getByRole("button", { name: "Edit preview", exact: true }).click()
  await page.getByRole("textbox", { name: "Plan title", exact: true }).fill("Keep this private draft")
  const link = await navigationLink(page)
  await link.focus(); await page.keyboard.press("Enter")
  const confirmation = page.getByRole("group", { name: "Unsaved preview edits" })
  await expect(confirmation).toBeVisible()
  await expect(page).toHaveURL(/\?revisions$/)
  await expect(page.getByRole("button", { name: "Keep editing", exact: true })).toBeFocused()
  await page.getByRole("button", { name: "Keep editing", exact: true }).click()
  await expect(link).toBeFocused()
  await expect(page.getByRole("textbox", { name: "Plan title", exact: true })).toHaveValue("Keep this private draft")
  expect(await graph(page)).toEqual(before)
  const dialogs: string[] = []
  page.on("dialog", async dialog => { dialogs.push(dialog.type()); await dialog.dismiss() })
  await link.click()
  await page.getByRole("button", { name: "Discard edits", exact: true }).click()
  await expect(page).toHaveURL(/\?revisions&destination$/)
  expect(dialogs).toEqual([])
  await openResearch(page)
  await expect(page.getByText("Workshop preparation revised", { exact: true })).toBeVisible()
  expect(await graph(page)).toEqual(before); expect(runs.size).toBe(1)
  expect(await page.evaluate(() => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]))).not.toContain("Keep this private draft")
})

test("unchanged previews navigate without a discard prompt", async ({ page }) => {
  await setup(page); await openResearch(page); await generate(page)
  await page.getByRole("button", { name: "Edit preview", exact: true }).click()
  const link = await navigationLink(page)
  await link.click()
  await expect(page).toHaveURL(/\?revisions&destination$/)
  await expect(page.getByRole("group", { name: "Unsaved preview edits" })).toHaveCount(0)
})

test("preview navigation leaves new tabs, downloads, fragments and modified clicks alone", async ({ page }) => {
  await setup(page); await openResearch(page); await generate(page)
  await page.getByRole("button", { name: "Edit preview", exact: true }).click()
  await page.getByRole("textbox", { name: "Plan title", exact: true }).fill("Keep editing here")
  await navigationLink(page)
  // Capture whether the production guard prevented the event before this fixture
  // listener suppresses native navigation/downloads. No real external requests.
  const prevented = await page.evaluate(() => {
    const anchor = document.querySelector<HTMLAnchorElement>("a[href='/?revisions&destination']")!
    const results: boolean[] = []
    anchor.addEventListener("click", event => { results.push(event.defaultPrevented); event.preventDefault() })
    const click = (options: MouseEventInit = {}) => anchor.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ...options }))
    for (const modifier of ["ctrlKey", "metaKey", "shiftKey", "altKey"]) click({ [modifier]: true })
    click({ button: 1 })
    anchor.target = "_blank"; click(); anchor.removeAttribute("target")
    anchor.download = "report"; click(); anchor.removeAttribute("download")
    anchor.href = "#details"; click()
    anchor.href = "mailto:example@example.org"; click()
    anchor.href = "tel:123"; click()
    return results
  })
  expect(prevented).toEqual(Array(10).fill(false))
  await expect(page.getByRole("group", { name: "Unsaved preview edits" })).toHaveCount(0)
  await expect(page.getByRole("textbox", { name: "Plan title", exact: true })).toHaveValue("Keep editing here")
  expect(await page.evaluate(() => {
    const event = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(event); return event.defaultPrevented
  })).toBe(true)
})

type StreamWindow = Window & { researchStreamRequest?: ResearchRequest; researchStarts: number; researchDisconnects: number; pushResearchFrame: (text:string)=>void; finishResearchStream:()=>void }
async function setupProgress(page:Page) {
  await page.addInitScript(()=>{
    const browser=window as unknown as StreamWindow,original=window.fetch.bind(window)
    browser.researchStarts=0;browser.researchDisconnects=0
    window.fetch=async(input,init)=>{
      if(String(input)!=="/api/workspace-ai/research")return original(input,init)
      browser.researchStarts++
      browser.researchStreamRequest=JSON.parse(String(init?.body))
      return new Response(new ReadableStream({start(controller){
        browser.pushResearchFrame=text=>controller.enqueue(new TextEncoder().encode(text))
        browser.finishResearchStream=()=>controller.close()
      },cancel(){browser.researchDisconnects++}}),{headers:{"Content-Type":"text/event-stream"}})
    }
  })
  await setup(page);await openResearch(page)
  await page.getByRole("textbox",{name:"Research request"}).fill("Revise this plan")
  await page.getByRole("button",{name:"Research",exact:true}).click()
  await page.waitForFunction(()=>Boolean((window as unknown as StreamWindow).researchStreamRequest))
  const request=await page.evaluate(()=>(window as unknown as StreamWindow).researchStreamRequest!)
  const result=response(request)
  await page.evaluate(value=>localStorage.setItem(`revision-result:${value.runId}`,JSON.stringify(value)),result)
  let reads=0
  await page.route("**/__fixture/revision-read",async route=>{reads++;await route.fulfill({json:{run:{version:1,resultRevision:1,applicability:"review_required",id:result.runId,credits:null,status:"succeeded",result}}})})
  const send=async(sequence:number,kind="phase.changed",payload:Record<string,unknown>={phase:"reading"},streamId="00000000-0000-4000-8000-000000000800")=>{
    const event=researchProgressSchema.parse({version:1,streamId,runId:request.id,requestId:request.id,
      scope:{...scope,canvasId:null},target:request.target,sequence,emittedAt:new Date().toISOString(),kind,payload,
      ...(["preview.updated","preview.item","preview.cleared"].includes(kind)?{resultRevision:0}:kind==="result.ready"?{resultRevision:1,payload:{...payload,applicability:"review_required"}}:{})})
    await page.evaluate(text=>(window as unknown as StreamWindow).pushResearchFrame(text),`data: ${JSON.stringify(researchProgressWire(event))}\n\n`)
  }
  return {send,result,reads:()=>reads}
}

for (const status of ["succeeded", "running", "denied"] as const) {
  test(`stalled preview clears before one saved read resolves as ${status}`, async ({ page }) => {
    await page.clock.install()
    const stream = await setupProgress(page), before = await graph(page)
    let release!: () => void, reads = 0
    const gate = new Promise<void>(resolve => { release = resolve })
    await page.route("**/__fixture/revision-read", async route => {
      reads++; await gate
      await route.fulfill({ json: status === "denied" ? { error: "Sources changed", failure: { code: "sources_changed" } } : {
        run: { version: 1, id: stream.result.runId, credits: 0, status,
          result: status === "succeeded" ? stream.result : null,
          resultRevision: status === "succeeded" ? 1 : null,
          applicability: status === "succeeded" ? "review_required" : "unavailable" },
      } })
    })
    await stream.send(1, "run.started", {})
    await stream.send(2, "preview.updated", { result: stream.result })
    await expect(page.getByRole("region", { name: "Unsaved plan preview" })).toBeVisible()
    await page.clock.runFor(30_001)
    await expect(page.getByRole("region", { name: "Unsaved plan preview" })).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Add proposal", exact: true })).toHaveCount(0)
    await expect.poll(() => reads).toBe(1)
    release()
    if (status === "succeeded") await expect(page.getByRole("button", { name: "Edit preview", exact: true })).toBeEnabled()
    else if (status === "denied") await expect(page.getByRole("alert")).toBeVisible()
    else await expect(page.getByText("Research is still running or recovering. Check status shortly.", { exact: true })).toBeVisible()
    await page.clock.runFor(60_000)
    expect(reads).toBe(1)
    expect(await page.evaluate(() => {
      const browser = window as unknown as StreamWindow
      return { starts: browser.researchStarts, disconnects: browser.researchDisconnects }
    })).toEqual({ starts: 1, disconnects: 1 })
    expect(await graph(page)).toEqual(before)
  })
}

test("producer restart discards the old preview and recovers without another generation", async ({ page }) => {
  const stream = await setupProgress(page), before = await graph(page)
  await stream.send(1, "run.started", {})
  await stream.send(2, "preview.updated", { result: stream.result })
  await expect(page.getByRole("region", { name: "Unsaved plan preview" })).toBeVisible()
  await stream.send(1, "run.started", {}, "00000000-0000-4000-8000-000000000801")
  await expect(page.getByRole("region", { name: "Unsaved plan preview" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Edit preview", exact: true })).toBeEnabled()
  expect(stream.reads()).toBe(1)
  expect(await page.evaluate(() => (window as unknown as StreamWindow).researchStarts)).toBe(1)
  expect(await graph(page)).toEqual(before)
})

for (const status of ["succeeded", "running", "denied"] as const) {
  test(`reconnecting an active stream restores ${status} state once without generation`, async ({ page }) => {
    const stream = await setupProgress(page), before = await graph(page)
    let reads = 0, release: () => void = () => undefined
    const gate = new Promise<void>(resolve => { release = resolve })
    await page.route("**/__fixture/revision-read", async route => {
      reads++; await gate
      await route.fulfill({ json: status === "denied" ? { failure: { code: "sources_changed" }, error: "Denied" } : { run: {
        version: 1, id: stream.result.runId, credits: null, status,
        result: status === "succeeded" ? stream.result : null,
        resultRevision: status === "succeeded" ? 1 : null,
        applicability: status === "succeeded" ? "review_required" : "unavailable",
      } } })
    })
    await stream.send(1, "run.started", {})
    await stream.send(2, "preview.item", { item: { key: "early", kind: "note", title: "Unconfirmed work", description: "" } })
    await expect(page.getByRole("list", { name: "Incoming plan items" })).toBeVisible()
    await page.evaluate(() => {
      window.dispatchEvent(new Event("online"))
      window.dispatchEvent(new Event("focus"))
      document.dispatchEvent(new Event("visibilitychange"))
    })
    await expect.poll(() => reads).toBe(1)
    await expect(page.getByRole("list", { name: "Incoming plan items" })).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Add proposal", exact: true })).toHaveCount(0)
    release()
    if (status === "succeeded") await expect(page.getByRole("button", { name: "Edit preview", exact: true })).toBeEnabled()
    else if (status === "denied") await expect(page.getByRole("alert")).toHaveText(researchRecovery.sources_changed.message)
    else await expect(page.getByRole("button", { name: "Check status", exact: true })).toBeEnabled()
    expect(await page.evaluate(() => {
      const browser = window as unknown as StreamWindow
      return { starts: browser.researchStarts, disconnects: browser.researchDisconnects }
    })).toEqual({ starts: 1, disconnects: 1 })
    expect(reads).toBe(1); expect(await graph(page)).toEqual(before)
  })
}

test("returning to a visible tab recovers the active run without merging its old stream", async ({ page }) => {
  const stream = await setupProgress(page), before = await graph(page)
  await stream.send(1, "run.started", {})
  await stream.send(2, "preview.updated", { result: stream.result })
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" })
    document.dispatchEvent(new Event("visibilitychange"))
  })
  await expect(page.getByRole("region", { name: "Unsaved plan preview" })).toHaveCount(0)
  expect(stream.reads()).toBe(0)
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" })
    document.dispatchEvent(new Event("visibilitychange"))
  })
  await expect(page.getByRole("button", { name: "Edit preview", exact: true })).toBeEnabled()
  expect(stream.reads()).toBe(1)
  expect(await page.evaluate(() => (window as unknown as StreamWindow).researchStarts)).toBe(1)
  expect(await graph(page)).toEqual(before)
})

test("reconnect supersedes a pending JSON response and preserves recovered edits", async ({ page }) => {
  const runs = await setup(page), before = await graph(page)
  let release: () => void = () => undefined, submissions = 0
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route("**/api/workspace-ai/research", async route => {
    submissions++
    const request = route.request().postDataJSON() as ResearchRequest
    const result = response(request); runs.set(request.id, result)
    await gate
    await route.fulfill({ json: { run: { version: 1, resultRevision: 1, applicability: "review_required", id: request.id, credits: 0, status: "succeeded", result } } })
  })
  await openResearch(page)
  await page.getByRole("textbox", { name: "Research request" }).fill("Revise this plan")
  await page.getByRole("button", { name: "Research", exact: true }).click()
  await expect.poll(() => runs.size).toBe(1)
  await page.evaluate(() => window.dispatchEvent(new Event("online")))
  await page.getByRole("button", { name: "Edit preview", exact: true }).click()
  await page.getByRole("textbox", { name: "Item 1 title", exact: true }).fill("Recovered private edit")
  release()
  await expect(page.getByRole("textbox", { name: "Item 1 title", exact: true })).toHaveValue("Recovered private edit")
  await expect(page.getByRole("button", { name: "Save draft", exact: true })).toBeEnabled()
  expect(submissions).toBe(1); expect(await graph(page)).toEqual(before)
})

test("terminal saved snapshot opens an editable proposal without another read or automatic application",async({page})=>{
  const stream=await setupProgress(page),before=await graph(page)
  await stream.send(1,"run.started",{})
  await stream.send(2,"run.snapshot",{watermark:2,run:{version:1,resultRevision:1,applicability:"review_required",id:stream.result.runId,credits:0,status:"succeeded",result:stream.result}})
  await expect(page.getByRole("button",{name:"Add proposal",exact:true})).toHaveCount(0)
  await stream.send(3,"run.terminal",{status:"succeeded"})
  await page.evaluate(()=>(window as unknown as StreamWindow).finishResearchStream())
  await expect(page.getByRole("button",{name:"Edit preview",exact:true})).toBeEnabled()
  expect(stream.reads()).toBe(0);expect(await graph(page)).toEqual(before)
  await page.getByRole("button",{name:"Edit preview",exact:true}).click()
  await page.getByRole("textbox",{name:"Plan title",exact:true}).fill("Edited saved snapshot")
  await page.getByRole("button",{name:"Add proposal",exact:true}).click()
  await page.reload()
  await expect(page.getByRole("button",{name:"Accept Edited saved snapshot",exact:true})).toBeEnabled()
})

test("wrong snapshot watermark falls back to one authorized read",async({page})=>{
  const stream=await setupProgress(page),before=await graph(page)
  await stream.send(1,"run.started",{})
  await stream.send(2,"run.snapshot",{watermark:1,run:{version:1,resultRevision:1,applicability:"review_required",id:stream.result.runId,credits:0,status:"succeeded",result:{...stream.result,title:"Untrusted stream title"}}})
  await expect(page.getByRole("button",{name:"Add proposal",exact:true})).toBeEnabled()
  await expect(page.getByText("Untrusted stream title",{exact:true})).toHaveCount(0)
  expect(stream.reads()).toBe(1);expect(await graph(page)).toEqual(before)
})

test("validated streamed preview stays unsaved and read-only until authorized readback",async({page})=>{
  const stream=await setupProgress(page),before=await graph(page)
  await stream.send(1,"run.started",{})
  await stream.send(2,"preview.updated",{result:stream.result})
  const preview=page.getByRole("region",{name:"Unsaved plan preview"})
  await expect(preview.getByText("Prepare invitations",{exact:true})).toBeVisible()
  await expect(preview.getByText("Unsaved preview. Waiting for confirmation.",{exact:true})).toBeVisible()
  await expect(page.getByRole("button",{name:"Edit preview",exact:true})).toHaveCount(0)
  await expect(page.getByRole("button",{name:"Add proposal",exact:true})).toHaveCount(0)
  expect(stream.reads()).toBe(0);expect(await graph(page)).toEqual(before)
  await stream.send(3,"result.ready",{resultId:stream.result.runId})
  await expect(page.getByRole("button",{name:"Add proposal",exact:true})).toHaveCount(0)
  await page.evaluate(()=>(window as unknown as StreamWindow).finishResearchStream())
  await expect(preview).toHaveCount(0)
  await expect(page.getByRole("button",{name:"Edit preview",exact:true})).toBeEnabled()
  expect(stream.reads()).toBe(1);expect(await graph(page)).toEqual(before)
  await page.getByRole("button",{name:"Add proposal",exact:true}).click()
  await page.reload()
  await expect(page.getByRole("button",{name:"Accept Workshop preparation revised",exact:true})).toBeEnabled()
})

test("interrupted preview is withheld when saved readback loses source access",async({page})=>{
  const stream=await setupProgress(page),before=await graph(page)
  await page.route("**/__fixture/revision-read",route=>route.fulfill({json:{error:"Sources changed",failure:{code:"sources_changed"}}}))
  await stream.send(1,"run.started",{})
  await stream.send(2,"preview.updated",{result:stream.result})
  await expect(page.getByRole("region",{name:"Unsaved plan preview"})).toBeVisible()
  await page.evaluate(()=>(window as unknown as StreamWindow).finishResearchStream())
  await expect(page.getByRole("region",{name:"Unsaved plan preview"})).toHaveCount(0)
  await expect(page.getByRole("button",{name:"Add proposal",exact:true})).toHaveCount(0)
  await expect(page.getByRole("alert")).toBeVisible()
  expect(await graph(page)).toEqual(before)
})

test("focus recheck clears a transient preview without saving or regenerating",async({page})=>{
  const stream=await setupProgress(page),before=await graph(page)
  await stream.send(1,"run.started",{})
  await stream.send(2,"preview.updated",{result:stream.result})
  await expect(page.getByRole("region",{name:"Unsaved plan preview"})).toBeVisible()
  await page.evaluate(()=>window.dispatchEvent(new Event("focus")))
  await expect(page.getByRole("region",{name:"Unsaved plan preview"})).toHaveCount(0)
  expect(stream.reads()).toBe(0);expect(await graph(page)).toEqual(before)
  await page.evaluate(()=>(window as unknown as StreamWindow).finishResearchStream())
  await expect(page.getByRole("button",{name:"Add proposal",exact:true})).toBeEnabled()
})

test("fixture streamed phases show progress; only saved readback reveals the unapplied proposal",async({page})=>{
  const stream=await setupProgress(page),before=await graph(page)
  await stream.send(1,"run.started",{})
  await stream.send(2)
  await expect(page.getByRole("status").filter({hasText:"Reading workspace sources…"})).toBeVisible()
  await expect(page.getByRole("button",{name:"Add proposal",exact:true})).toHaveCount(0)
  expect(await graph(page)).toEqual(before);expect(stream.reads()).toBe(0)
  await stream.send(3,"phase.changed",{phase:"repairing"})
  await expect(page.getByRole("status").filter({hasText:"Refining the plan…"})).toBeVisible()
  await expect(page.getByRole("button",{name:"Add proposal",exact:true})).toHaveCount(0)
  expect(await graph(page)).toEqual(before);expect(stream.reads()).toBe(0)
  await stream.send(4,"run.terminal",{status:"succeeded"})
  await page.evaluate(()=>(window as unknown as StreamWindow).finishResearchStream())
  await expect(page.getByRole("button",{name:"Add proposal",exact:true})).toBeEnabled()
  expect(stream.reads()).toBe(1);expect(await graph(page)).toEqual(before)
  await page.getByRole("button",{name:"Add proposal",exact:true}).click()
  await page.reload()
  await expect(page.getByRole("button",{name:"Accept Workshop preparation revised",exact:true})).toBeEnabled()
  expect(planning(await graph(page)).planning.plans[0].particleIds).toContain(removed)
})

test("fixture sequence gaps recover once without applying or regenerating",async({page})=>{
  const stream=await setupProgress(page),before=await graph(page)
  await stream.send(1,"run.started",{})
  await stream.send(3)
  await expect(page.getByRole("button",{name:"Add proposal",exact:true})).toBeEnabled()
  expect(stream.reads()).toBe(1);expect(await graph(page)).toEqual(before)
  await expect(page.getByText("Reading workspace sources…",{exact:true})).toHaveCount(0)
})

test("fixture source coverage stays explicit, keyboard accessible and bounded on mobile",async({page})=>{
  const recorded = "2026-10-24T12:00:00.000Z"
  const cases = [
    {title:"Record fields",coverage:"complete",scope:"record",readAt:recorded,label:"Available scope read",detail:"Shared record fields only; not the entire underlying record."},
    {title:"Document body",coverage:"complete",scope:"document_body",readAt:recorded,label:"Available scope read",detail:"Document body only; not headers, footers or embedded content."},
    {title:"Search excerpt",coverage:"excerpt",scope:"record",readAt:null,label:"Partial text",detail:"Only a search excerpt was provided; no detailed read was recorded."},
    {title:"Truncated read",coverage:"excerpt",scope:"text",readAt:recorded,label:"Partial text",detail:"Only part of the available text was read."},
    {title:"Plan details",coverage:"metadata_only",scope:"selected_plan",readAt:null,label:"Details only",detail:"Only source details were available. Content was not read."},
    {title:"Unreadable file",coverage:"unavailable",scope:"text",readAt:recorded,label:"Content unavailable",detail:"Content could not be read. No content-based claim is supported by this source."},
  ] as const
  const sources:ResearchResult["sources"] = cases.map((entry,index)=>({
    id:`document:fixture-${index}`,title:entry.title,href:"/workspace",revision:"0",checkedAt:recorded,kind:"workspace",
    evidence:{version:1,coverage:entry.coverage,scope:entry.scope,readAt:entry.readAt,checkedAt:recorded,characters:entry.coverage==="metadata_only"||entry.coverage==="unavailable"?0:120},
  }))
  sources.push({id:"web:historical",title:"Historical source with a very long title that should remain readable when expanded",href:"https://example.org/reference",revision:null,checkedAt:recorded,kind:"web"})
  await page.setViewportSize({width:390,height:844})
  await setup(page,false,sources);await openResearch(page);await generate(page)
  const list=page.getByRole("list",{name:"Research sources"})
  for (const entry of cases) {
    const trigger=list.getByRole("button",{name:`Source details: ${entry.title}`,exact:true})
    await expect(trigger).toContainText(entry.label)
    await trigger.focus();await page.keyboard.press("Enter")
    const details=page.getByRole("dialog",{name:`Source details: ${entry.title}`,exact:true})
    await expect(details).toContainText(entry.detail)
    await expect(details.locator("time")).toHaveAttribute("datetime",recorded)
    await expect(details.getByRole("link",{name:"Open source",exact:true})).toHaveAttribute("href","/workspace")
    const bounds=await details.boundingBox()
    expect(bounds).not.toBeNull();expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(390)
    await page.keyboard.press("Escape");await expect(details).toHaveCount(0);await expect(trigger).toBeFocused()
  }
  const unknown=list.getByRole("button",{name:`Source details: ${sources.at(-1)!.title}`,exact:true})
  await expect(unknown).toContainText("Coverage unknown")
  const bounds=await unknown.boundingBox()
  expect(bounds).not.toBeNull();expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(390)
  await unknown.click()
  const details=page.getByRole("dialog")
  await expect(details).toContainText("This result has no saved read coverage.")
  await expect(details.locator("time")).toHaveCount(0)
  await expect(details.getByRole("link",{name:"Open source in a new tab"})).toHaveAttribute("target","_blank")
  await page.keyboard.press("Escape")
  await page.getByRole("button",{name:"Close",exact:true}).click();await openResearch(page)
  await expect(list.getByRole("button",{name:"Source details: Document body",exact:true})).toContainText("Available scope read")
  await expect(unknown).toContainText("Coverage unknown")
})

test("fixture research without citations does not imply source verification",async({page})=>{
  await setup(page,false,[]);await openResearch(page);await generate(page)
  await expect(page.getByText("No sources cited.",{exact:true})).toBeVisible()
  await expect(page.getByRole("list",{name:"Research sources"})).toHaveCount(0)
  await expect(page.getByRole("button",{name:"Add proposal",exact:true})).toBeEnabled()
})

test("fixture revision keeps accepted work until owner accepts; reload preserves it",async({page})=>{
  const runs=await setup(page)
  await openResearch(page)
  await expect(page.getByText("Uses workspace sources. Web search is unavailable.")).toBeVisible()
  await expect(page.getByText("Up to 10 credits for workspace research.")).toBeVisible()
  await generate(page)
  expect([...runs.values()][0].target.plan).toEqual({id:first,revision:0})
  await expect(page.getByRole("list",{name:"Research membership removals"})).toContainText("Old flyer")
  await page.getByRole("button",{name:"Add proposal",exact:true}).click()
  await expect(page.getByRole("button",{name:"Accept Workshop preparation revised",exact:true})).toBeEnabled()
  const proposed=await graph(page)
  expect(planning(proposed).planning.plans[0].particleIds).toContain(removed)
  expect(proposed.particles.find(particle=>particle.id===kept)?.status).toBe("done")
  await expect(page.getByRole("list",{name:"Proposed relationship changes"})).toContainText("Venue confirmed → Prepare invitations")
  await page.reload()
  await page.getByRole("button",{name:"Accept Workshop preparation revised",exact:true}).click()
  await expect(page.getByRole("button",{name:"Accept Workshop preparation revised",exact:true})).toHaveCount(0)
  await page.reload()
  const accepted=await graph(page)
  expect(planning(accepted).planning.plans[0].id).toBe(first)
  expect(planning(accepted).planning.plans[0].particleIds).not.toContain(removed)
  expect(planning(accepted).planning.plans[1].id).toBe(second)
  expect(accepted.particles.find(particle=>particle.id===removed)?.title).toBe("Old flyer")
  expect(accepted.particles.find(particle=>particle.id===kept)?.description).toBe("Approved venue details must survive revision.")
})

test("fixture removal-only revision can be proposed and rejected without changing accepted membership",async({page})=>{
  await setup(page,true);await openResearch(page);await generate(page)
  await page.getByRole("button",{name:"Add proposal",exact:true}).click()
  await page.getByRole("button",{name:"Reject Workshop preparation revised",exact:true}).click()
  await expect(page.getByRole("button",{name:"Reject Workshop preparation revised",exact:true})).toHaveCount(0)
  await page.reload()
  const state=await graph(page)
  expect(planning(state).planning.plans[0].particleIds).toEqual([kept,removed])
  expect(planning(state).planning.proposals[0].status).toBe("rejected")
})

test("fixture plan recovery stays isolated and owner review rejects stale proposals",async({page})=>{
  await setup(page);await openResearch(page);await generate(page)
  await page.getByRole("button",{name:"Close",exact:true}).click()
  await openResearch(page,"Marketing")
  await expect(page.getByRole("button",{name:"Check status",exact:true})).toHaveCount(0)
  await expect(page.getByRole("list",{name:"Proposed plan items"})).toHaveCount(0)
  await page.getByRole("button",{name:"Close",exact:true}).click()
  await openResearch(page)
  await page.getByRole("button",{name:"Add proposal",exact:true}).click()
  await page.getByRole("button",{name:"Advance fixture plan revision",exact:true}).click()
  await expect(page.getByRole("button",{name:"Accept Workshop preparation revised",exact:true})).toBeDisabled()
  await page.getByRole("button",{name:"Reject Workshop preparation revised",exact:true}).click()
  await expect(page.getByRole("button",{name:"Reject Workshop preparation revised",exact:true})).toHaveCount(0)
})

test("fixture delayed research cannot leak into another selected plan",async({page})=>{
  await setup(page)
  let release:()=>void=()=>undefined
  const gate=new Promise<void>(resolve=>{release=resolve})
  let started:()=>void=()=>undefined
  const requestStarted=new Promise<void>(resolve=>{started=resolve})
  await page.route("**/api/workspace-ai/research",async route=>{started();await gate;await route.fulfill({json:{run:{version:1,resultRevision:1,applicability:"review_required",id:route.request().postDataJSON().id,credits:null,status:"succeeded",result:response(route.request().postDataJSON())}}})})
  await openResearch(page)
  await page.getByRole("textbox",{name:"Research request"}).fill("Revise the preparation plan")
  await page.getByRole("button",{name:"Research",exact:true}).click();await requestStarted
  await page.getByRole("button",{name:"Close",exact:true}).click();await openResearch(page,"Marketing")
  release()
  await expect(page.getByRole("form",{name:"Revise plan with AI"})).toContainText("Revise Marketing")
  await expect(page.getByRole("button",{name:"Add proposal",exact:true})).toHaveCount(0)
  await expect(page.getByRole("textbox",{name:"Research request"})).toBeEnabled()
})

test("fixture member can propose but cannot accept a revision",async({page})=>{
  await setup(page);await page.getByRole("button",{name:"Use member role",exact:true}).click()
  await openResearch(page);await generate(page)
  await page.getByRole("button",{name:"Add proposal",exact:true}).click()
  await expect(page.getByText("Workshop preparation revised",{exact:false}).first()).toBeVisible()
  await expect(page.getByRole("button",{name:"Accept Workshop preparation revised",exact:true})).toHaveCount(0)
  expect(planning(await graph(page)).planning.plans[0].particleIds).toContain(removed)
})

test("fixture stale recovered research is hidden and cannot be proposed",async({page})=>{
  await setup(page);await openResearch(page);await generate(page)
  await page.getByRole("button",{name:"Close",exact:true}).click()
  await page.getByRole("button",{name:"Advance fixture plan revision",exact:true}).click()
  await page.reload();await openResearch(page)
  await expect(page.getByRole("list",{name:"Research membership removals"})).toHaveCount(0)
  await expect(page.getByRole("button",{name:"Add proposal",exact:true})).toBeDisabled()
  await expect(page.getByText("This plan or objective changed.",{exact:false})).toBeVisible()
  await page.getByRole("button",{name:"Discard",exact:true}).click()
  await expect(page.getByRole("textbox",{name:"Research request"})).toBeEnabled()
})

test("fixture visible research rechecks once on return and hides revoked content",async({page})=>{
  await setup(page);await openResearch(page);await generate(page)
  let release:()=>void=()=>undefined
  const gate=new Promise<void>(resolve=>{release=resolve})
  let reads=0
  await page.route("**/__fixture/revision-read",async route=>{
    reads++;await gate
    await route.fulfill({json:{error:researchRecovery.sources_changed.message,failure:{code:"sources_changed"}}})
  })
  await page.evaluate(()=>{
    window.dispatchEvent(new Event("focus"))
    window.dispatchEvent(new Event("online"))
    document.dispatchEvent(new Event("visibilitychange"))
  })
  await expect(page.getByText("Checking research sources…")).toBeVisible()
  await expect(page.getByRole("list",{name:"Proposed plan items"})).toHaveCount(0)
  await expect(page.getByRole("button",{name:"Add proposal",exact:true})).toHaveCount(0)
  await expect(page.getByRole("button",{name:"Check status",exact:true})).toBeDisabled()
  release()
  await expect(page.getByRole("alert")).toContainText("A research source changed")
  expect(reads).toBe(1)
  await expect(page.getByRole("button",{name:"Check status",exact:true})).toHaveCount(0)
  await expect(page.getByRole("button",{name:"Stop",exact:true})).toHaveCount(0)
  await expect(page.getByText("Research ready. Review the proposed changes.")).toHaveCount(0)
  await page.getByRole("button",{name:"Discard",exact:true}).click()
  await expect(page.getByRole("textbox",{name:"Research request"})).toBeEnabled()
})

test("fixture reconnect verification failure hides research and manual retry restores it",async({page})=>{
  await setup(page);await openResearch(page);await generate(page)
  await page.route("**/__fixture/revision-read",route=>route.abort(),{times:1})
  await page.evaluate(()=>window.dispatchEvent(new Event("online")))
  await expect(page.getByRole("alert")).toContainText("Could not verify research sources")
  await expect(page.getByRole("list",{name:"Proposed plan items"})).toHaveCount(0)
  await expect(page.getByRole("button",{name:"Add proposal",exact:true})).toHaveCount(0)
  await page.getByRole("button",{name:"Check status",exact:true}).click()
  await expect(page.getByRole("list",{name:"Proposed plan items"})).toContainText("Prepare invitations")
  await expect(page.getByRole("button",{name:"Add proposal",exact:true})).toBeEnabled()
  await expect(page.getByRole("alert")).toHaveCount(0)
})

test("fixture current plan changes hide an already open research review",async({page})=>{
  await setup(page);await openResearch(page);await generate(page)
  await page.getByRole("button",{name:"Advance fixture plan revision",exact:true}).click()
  await expect(page.getByText("This plan or objective changed.",{exact:false})).toBeVisible()
  await expect(page.getByRole("list",{name:"Proposed plan items"})).toHaveCount(0)
  await expect(page.getByRole("button",{name:"Add proposal",exact:true})).toBeDisabled()
  await expect(page.getByText("Research ready. Review the proposed changes.")).toHaveCount(0)
})

test("fixture late recovery cannot replace a newer run on the same plan",async({page})=>{
  const runs=await setup(page);await openResearch(page);await generate(page)
  const firstRun=[...runs.keys()][0]
  await page.getByRole("button",{name:"Close",exact:true}).click()
  let release:()=>void=()=>undefined
  const gate=new Promise<void>(resolve=>{release=resolve})
  let started:()=>void=()=>undefined
  const requestStarted=new Promise<void>(resolve=>{started=resolve})
  await page.route("**/__fixture/revision-read",async route=>{started();await gate;await route.fulfill({json:{run:{version:1,resultRevision:1,applicability:"review_required",id:firstRun,credits:null,status:"succeeded",result:runs.get(firstRun)}}})})
  await openResearch(page);await requestStarted
  await page.getByRole("button",{name:"Discard",exact:true}).click();await generate(page)
  const secondRun=[...runs.keys()][1]
  const received=page.waitForResponse("**/__fixture/revision-read")
  release();await (await received).finished()
  await page.getByRole("button",{name:"Add proposal",exact:true}).click()
  await expect(page.getByRole("button",{name:"Accept Workshop preparation revised",exact:true})).toBeEnabled()
  const state=await graph(page)
  const objective=state.particles.find(particle=>particle.type==="objective")
  expect(objective?.type==="objective"&&objective.data.planning?.proposals[0].researchRunId).toBe(secondRun)
})


test("fixture typed verification retry preserves the run and never generates again",async({page})=>{
  const runs=await setup(page);await openResearch(page);await generate(page)
  const initial=[...runs.keys()]
  await page.route("**/__fixture/revision-read",route=>route.fulfill({json:{error:"Untrusted detail must not render",failure:{code:"verification_unavailable"}}}),{times:1})
  await page.evaluate(()=>window.dispatchEvent(new Event("online")))
  await expect(page.getByRole("alert")).toHaveText(researchRecovery.verification_unavailable.message)
  await expect(page.getByRole("list",{name:"Proposed plan items"})).toHaveCount(0)
  await expect(page.getByRole("button",{name:"Research",exact:true})).toHaveCount(0)
  await page.getByRole("button",{name:"Check status",exact:true}).click()
  await expect(page.getByRole("button",{name:"Add proposal",exact:true})).toBeEnabled()
  expect([...runs.keys()]).toEqual(initial)
})

test("fixture duplicate-request failure recovers the reserved run without another submission",async({page})=>{
  const runs=await setup(page)
  let submissions=0
  await page.route("**/api/workspace-ai/research",async route=>{
    submissions++
    const request=route.request().postDataJSON() as ResearchRequest
    runs.set(request.id,response(request))
    await route.fulfill({status:409,json:{error:researchRecovery.verification_unavailable.message,failure:{code:"verification_unavailable"},reserved:true}})
  })
  await openResearch(page)
  await page.getByRole("textbox",{name:"Research request"}).fill("Keep the current work.")
  await page.getByRole("button",{name:"Research",exact:true}).click()
  await expect(page.getByRole("alert")).toHaveText(researchRecovery.verification_unavailable.message)
  await expect(page.getByRole("button",{name:"Research",exact:true})).toHaveCount(0)
  await page.getByRole("button",{name:"Close",exact:true}).click();await openResearch(page)
  await expect(page.getByRole("button",{name:"Add proposal",exact:true})).toBeEnabled()
  expect(submissions).toBe(1)
})

test("fixture invalid saved research offers discard without silently spending again",async({page})=>{
  const runs=await setup(page);await openResearch(page);await generate(page)
  await page.route("**/__fixture/revision-read",route=>route.fulfill({json:{error:researchRecovery.invalid_result.message,failure:{code:"invalid_result"}}}),{times:1})
  await page.evaluate(()=>window.dispatchEvent(new Event("focus")))
  await expect(page.getByRole("alert")).toHaveText(researchRecovery.invalid_result.message)
  await expect(page.getByRole("button",{name:"Check status",exact:true})).toHaveCount(0)
  await expect(page.getByRole("button",{name:"Stop",exact:true})).toHaveCount(0)
  await expect(page.getByRole("list",{name:"Proposed plan items"})).toHaveCount(0)
  await page.getByRole("button",{name:"Discard",exact:true}).click()
  await expect(page.getByRole("textbox",{name:"Research request"})).toHaveValue("Replace the old flyer and keep completed work.")
  await expect(page.getByRole("button",{name:"Research",exact:true})).toBeEnabled()
  expect(runs.size).toBe(1)
})


test("fixture uncertain admission preserves the request and recovers the same run without another generation",async({page})=>{
  const runs=await setup(page)
  let posts=0,runId=""
  await page.route("**/api/workspace-ai/research",async route=>{
    posts++;const input=route.request().postDataJSON() as ResearchRequest
    runId=input.id;runs.set(input.id,response(input))
    await route.fulfill({status:400,json:{reserved:true,error:"Private transport details",failure:{code:"reservation_uncertain"}}})
  })
  await openResearch(page)
  await page.getByRole("textbox",{name:"Research request"}).fill("Keep this request")
  await page.getByRole("button",{name:"Research",exact:true}).click()
  await expect(page.getByRole("alert")).toHaveText(researchRecovery.reservation_uncertain.message)
  await expect(page.getByRole("button",{name:"Research",exact:true})).toHaveCount(0)
  await expect(page.getByRole("textbox",{name:"Research request"})).toHaveValue("Keep this request")
  expect(await page.evaluate(id=>Object.values(sessionStorage).includes(id),runId)).toBe(true)
  await page.getByRole("button",{name:"Close",exact:true}).click();await openResearch(page)
  await expect(page.getByRole("button",{name:"Add proposal",exact:true})).toBeEnabled()
  expect(posts).toBe(1)
})

test("fixture changed pricing requires reopened review before another research attempt",async({page})=>{
  await setup(page)
  let posts=0
  await page.route("**/api/workspace-ai/research",async route=>{
    posts++
    await route.fulfill({status:400,json:{reserved:false,error:"Untrusted price details",failure:{code:"pricing_changed"}}})
  })
  await openResearch(page)
  await page.getByRole("textbox",{name:"Research request"}).fill("Keep this request")
  await page.getByRole("button",{name:"Research",exact:true}).click()
  await expect(page.getByRole("alert")).toHaveText(researchRecovery.pricing_changed.message)
  await expect(page.getByRole("button",{name:"Research",exact:true})).toBeDisabled()
  await expect(page.getByRole("textbox",{name:"Research request"})).toHaveValue("Keep this request")
  await expect(page.getByRole("button",{name:"Check status",exact:true})).toHaveCount(0)
  expect(await page.evaluate(()=>Object.keys(sessionStorage).filter(key=>key.startsWith("workspace-research:")))).toHaveLength(0)
  await page.getByRole("button",{name:"Close",exact:true}).click();await openResearch(page)
  await page.getByRole("textbox",{name:"Research request"}).fill("Reopened request")
  await expect(page.getByText("Up to 10 credits for workspace research.")).toBeVisible()
  await expect(page.getByRole("button",{name:"Research",exact:true})).toBeEnabled()
  expect(posts).toBe(1)
})

for (const code of ["credits_unavailable","usage_limit","capacity_busy","ai_disabled"] as const) {
 test(`fixture confirmed ${code} rejection preserves input without a phantom run`,async({page})=>{
  await setup(page)
  let posts=0
  await page.route("**/api/workspace-ai/research",async route=>{
    posts++
    await route.fulfill({status:409,json:{reserved:false,error:"Private ledger detail",failure:{code}}})
  })
  await openResearch(page)
  await page.getByRole("textbox",{name:"Research request"}).fill("Keep this request")
  await page.getByRole("button",{name:"Research",exact:true}).click()
  await expect(page.getByRole("alert")).toHaveText(researchRecovery[code].message)
  await expect(page.getByRole("textbox",{name:"Research request"})).toHaveValue("Keep this request")
  await expect(page.getByRole("button",{name:"Research",exact:true})).toBeDisabled()
  await expect(page.getByRole("button",{name:"Check status",exact:true})).toHaveCount(0)
  await expect(page.getByRole("button",{name:"Stop",exact:true})).toHaveCount(0)
  expect(await page.evaluate(()=>Object.keys(sessionStorage).filter(key=>key.startsWith("workspace-research:")))).toHaveLength(0)
  expect(posts).toBe(1)
 })
}


test("fixture previous research survives a fresh browser session without regeneration or writes",async({page})=>{
  const runs=await setup(page);await openResearch(page);await generate(page)
  const before=await graph(page)
  await page.evaluate(()=>sessionStorage.clear());await page.reload();await openResearch(page)
  await page.getByRole("textbox",{name:"Research request"}).fill("An unfinished new request")
  let reads=0
  page.on("request",request=>{if(request.url().includes("/__fixture/revision-read"))reads++})
  await page.getByRole("button",{name:"Previous research",exact:true}).focus()
  await page.keyboard.press("Enter")
  const previous=page.getByRole("menuitem",{name:/Ready to review/})
  await expect(previous).toBeVisible();await previous.focus();await page.keyboard.press("Enter")
  await expect(page.getByRole("button",{name:"Add proposal",exact:true})).toBeEnabled()
  expect(reads).toBe(1);expect(runs.size).toBe(1);expect(await graph(page)).toEqual(before)
  await page.getByRole("button",{name:"Discard",exact:true}).click()
  await expect(page.getByRole("textbox",{name:"Research request"})).toHaveValue("An unfinished new request")
})

test("fixture history is plan scoped and rechecks revoked sources before displaying results",async({page})=>{
  const runs=await setup(page);await openResearch(page);await generate(page)
  await page.evaluate(()=>sessionStorage.clear());await page.reload()
  await openResearch(page,"Marketing")
  await page.getByRole("button",{name:"Previous research",exact:true}).click()
  await expect(page.getByRole("menuitem",{name:"No previous research",exact:true})).toBeVisible()
  await page.keyboard.press("Escape");await page.getByRole("button",{name:"Close",exact:true}).click()
  await openResearch(page)
  await page.route("**/__fixture/revision-read",route=>route.fulfill({json:{error:"Untrusted revoked detail",failure:{code:"sources_changed"}}}))
  await page.getByRole("button",{name:"Previous research",exact:true}).click()
  await page.getByRole("menuitem",{name:/Ready to review/}).click()
  await expect(page.getByRole("alert")).toHaveText(researchRecovery.sources_changed.message)
  await expect(page.getByRole("list",{name:"Proposed plan items"})).toHaveCount(0)
  await expect(page.getByRole("button",{name:"Add proposal",exact:true})).toHaveCount(0)
  expect(runs.size).toBe(1)
})

test("fixture history retry keeps request drafts and exposes no private error",async({page})=>{
  await setup(page);await openResearch(page)
  await page.getByRole("textbox",{name:"Research request"}).fill("Keep my draft")
  await page.route("**/__fixture/revision-history",route=>route.fulfill({json:{error:"private database detail"}}),{times:1})
  await page.getByRole("button",{name:"Previous research",exact:true}).click()
  await page.getByRole("menuitem",{name:"Could not load. Try again",exact:true}).click()
  await expect(page.getByRole("menuitem",{name:"No previous research",exact:true})).toBeVisible()
  await expect(page.getByText("private database detail")).toHaveCount(0)
  await page.keyboard.press("Escape")
  await expect(page.getByRole("button",{name:"Previous research",exact:true})).toBeFocused()
  await expect(page.getByRole("textbox",{name:"Research request"})).toHaveValue("Keep my draft")
})


test("revision editing preserves existing members and hides edited content when source verification fails", async ({ page }) => {
  await setup(page)
  await openResearch(page)
  await generate(page)
  await page.getByRole("button", { name: "Edit preview", exact: true }).click()
  await expect(page.getByRole("textbox", { name: "Item 1 title", exact: true })).toHaveValue("Prepare invitations")
  await expect(page.getByRole("textbox", { name: "Item 2 title", exact: true })).toHaveCount(0)
  await page.getByRole("textbox", { name: "Item 1 title", exact: true }).fill("Private edited invitation")
  await page.route("**/__fixture/revision-read", route => route.fulfill({ json: { error: "Source access changed", failure: { code: "verification_unavailable" } } }))
  await page.evaluate(() => window.dispatchEvent(new Event("focus")))
  await expect(page.getByRole("textbox", { name: "Item 1 title", exact: true })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Add proposal", exact: true })).toHaveCount(0)
  await expect(page.getByText("Private edited invitation", { exact: true })).toHaveCount(0)
  await expect(page.getByRole("alert")).toBeVisible()
})

test("fixture Stop supersedes a late JSON result; explicit recovery reads the same run", async ({ page }) => {
  const runs = await setup(page), before = await graph(page)
  let release: () => void = () => undefined
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route("**/api/workspace-ai/research", async route => {
    const request = route.request().postDataJSON() as ResearchRequest
    const result = response(request); runs.set(request.id, result)
    await gate
    await route.fulfill({ json: { run: { version: 1, resultRevision: 1, applicability: "review_required", id: request.id, credits: 0, status: "succeeded", result } } })
  })
  await openResearch(page)
  await page.getByRole("textbox", { name: "Research request" }).fill("Revise this plan")
  await page.getByRole("button", { name: "Research", exact: true }).click()
  await page.getByRole("button", { name: "Stop", exact: true }).click()
  await expect(page.getByRole("alert")).toContainText("Stopping is unavailable")
  release()
  // Enabled status checking proves the original generation finished its finally.
  await expect(page.getByRole("button", { name: "Check status", exact: true })).toBeEnabled()
  await expect(page.getByRole("alert")).toContainText("Stopping is unavailable")
  await expect(page.getByRole("button", { name: "Add proposal", exact: true })).toHaveCount(0)
  expect(await graph(page)).toEqual(before)
  await page.getByRole("button", { name: "Check status", exact: true }).click()
  await expect(page.getByRole("button", { name: "Add proposal", exact: true })).toBeEnabled()
  expect(runs.size).toBe(1); expect(await graph(page)).toEqual(before)
})

for (const invalid of ["running_result", "missing_result", "foreign_run", "unknown_status", "unsaved_revision", "unknown_version", "false_receipt"] as const) {
  test(`fixture rejects ${invalid} snapshots without exposing or applying content`, async ({ page }) => {
    await setup(page)
    const before = await graph(page)
    await page.route("**/api/workspace-ai/research", route => {
      const request = route.request().postDataJSON() as ResearchRequest
      return route.fulfill({ json: { run: {
        version: invalid === "unknown_version" ? 2 : 1,
        resultRevision: invalid === "unsaved_revision" ? 0 : 1,
        applicability: invalid === "false_receipt" ? "already_applied" : "review_required",
        id: invalid === "foreign_run" ? "00000000-0000-4000-8000-000000000999" : request.id,
        credits: null, status: invalid === "running_result" ? "running" : invalid === "unknown_status" ? "complete" : "succeeded",
        result: invalid === "missing_result" ? null : response(request),
      } } })
    })
    await openResearch(page)
    await page.getByRole("textbox", { name: "Research request" }).fill("Revise this plan")
    await page.getByRole("button", { name: "Research", exact: true }).click()
    await expect(page.getByRole("alert")).toHaveText(researchRecovery.invalid_result.message)
    await expect(page.getByRole("list", { name: "Proposed plan items" })).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Add proposal", exact: true })).toHaveCount(0)
    expect(await graph(page)).toEqual(before)
  })
}

test("private draft save survives reload without applying or caching edited text", async ({ page }) => {
  await setup(page); await openResearch(page); await generate(page)
  const before = await graph(page)
  await page.getByRole("button", { name: "Edit preview", exact: true }).click()
  await page.getByRole("textbox", { name: "Plan title", exact: true }).fill("Privately saved checkpoint")
  await page.getByRole("button", { name: "Save draft", exact: true }).click()
  await expect(page.getByText("Private draft saved. Not added to the plan.", { exact: true })).toBeVisible()
  expect(await graph(page)).toEqual(before)
  expect(await page.evaluate(() => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]))).not.toContain("Privately saved checkpoint")
  await page.reload(); await openResearch(page)
  await expect(page.getByRole("textbox", { name: "Plan title", exact: true })).toHaveValue("Privately saved checkpoint")
  await expect(page.getByRole("button", { name: "Add proposal", exact: true })).toBeEnabled()
  expect(await graph(page)).toEqual(before)
})

test("private draft unconfirmed saves retry the same operation and protect editing", async ({ page }) => {
  await setup(page); await openResearch(page); await generate(page)
  await page.getByRole("button", { name: "Edit preview", exact: true }).click()
  await page.getByRole("textbox", { name: "Plan title", exact: true }).fill("Recover uncertain draft")
  const writes: unknown[] = []
  let dropped = false
  await page.route("**/__fixture/research-draft", async route => {
    const body = route.request().postDataJSON()
    if (!body.input) { await route.continue(); return }
    writes.push(body.input)
    if (!dropped) { dropped = true; await route.fetch(); await route.abort(); return }
    await route.continue()
  })
  await page.getByRole("button", { name: "Save draft", exact: true }).click()
  await expect(page.getByRole("alert")).toContainText("Draft save unconfirmed")
  await expect(page.getByRole("textbox", { name: "Plan title", exact: true })).toBeDisabled()
  await expect(page.getByRole("button", { name: "Add proposal", exact: true })).toBeDisabled()
  await page.getByRole("button", { name: "Retry draft", exact: true }).click()
  await expect(page.getByText("Private draft saved. Not added to the plan.", { exact: true })).toBeVisible()
  await expect(page.getByRole("textbox", { name: "Plan title", exact: true })).toBeEnabled()
  expect(writes).toHaveLength(2); expect(writes[1]).toEqual(writes[0])
})

test("private draft conflict preserves local edits and never overwrites a newer checkpoint", async ({ page }) => {
  const runs = await setup(page); await openResearch(page); await generate(page)
  await page.getByRole("button", { name: "Edit preview", exact: true }).click()
  await page.getByRole("textbox", { name: "Plan title", exact: true }).fill("Earlier tab edits")
  await page.route("**/__fixture/research-draft", async route => {
    if (route.request().postDataJSON().input) await route.fulfill({ json: { error: "Draft changed elsewhere. Reopen research before saving.", conflict: true } })
    else await route.continue()
  })
  await page.getByRole("button", { name: "Save draft", exact: true }).click()
  await expect(page.getByRole("alert")).toContainText("Draft changed elsewhere")
  await expect(page.getByRole("textbox", { name: "Plan title", exact: true })).toHaveValue("Earlier tab edits")
  await expect(page.getByRole("button", { name: "Add proposal", exact: true })).toBeDisabled()
  expect(runs.size).toBe(1)
  await page.getByRole("button", { name: "Close", exact: true }).click()
  await page.getByRole("button", { name: "Discard edits", exact: true }).click()
  await expect(page.getByRole("form", { name: "Revise plan with AI" })).toHaveCount(0)
})

test("private draft discard clears persisted edits while preserving generated research", async ({ page }) => {
  await setup(page); await openResearch(page); await generate(page)
  await page.getByRole("button", { name: "Edit preview", exact: true }).click()
  await page.getByRole("textbox", { name: "Plan title", exact: true }).fill("Delete this private draft")
  await page.getByRole("button", { name: "Save draft", exact: true }).click()
  await expect(page.getByText("Private draft saved. Not added to the plan.", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Discard", exact: true }).click()
  await page.getByRole("button", { name: "Discard edits", exact: true }).click()
  await page.getByRole("button", { name: "Previous research", exact: true }).click()
  await page.getByRole("menuitem").filter({ hasText: "Ready" }).click()
  await expect(page.getByRole("button", { name: "Edit preview", exact: true })).toBeEnabled()
  await page.getByRole("button", { name: "Edit preview", exact: true }).click()
  await expect(page.getByRole("textbox", { name: "Plan title", exact: true })).toHaveValue("Workshop preparation revised")
})

test("private draft restoration waits for access checks and rejects corrupt contents", async ({ page }) => {
  await setup(page); await openResearch(page)
  await page.route("**/__fixture/research-draft", route => route.fulfill({ json: { checkpoint: { revision: 1, attempted: false,
    draft: { version: 4, title: "Untrusted private title", summary: "", items: [], addedItems: [], removedKeys: [], decisions: [] } } } }))
  await page.getByRole("textbox", { name: "Research request" }).fill("Develop the plan")
  await page.getByRole("button", { name: "Research", exact: true }).click()
  await expect(page.getByRole("alert")).toContainText("Draft could not be loaded")
  await expect(page.getByText("Untrusted private title", { exact: true })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Add proposal", exact: true })).toBeDisabled()
})

test("private draft proposal retry survives reload with its exact edited payload", async ({ page }) => {
  await setup(page); await openResearch(page); await generate(page)
  await page.getByRole("button", { name: "Edit preview", exact: true }).click()
  await page.getByRole("textbox", { name: "Plan title", exact: true }).fill("Durable application retry")
  await page.evaluate(() => localStorage.setItem("revision-fail-next-save", "1"))
  await page.getByRole("button", { name: "Add proposal", exact: true }).click()
  await expect(page.getByRole("alert")).toContainText("Proposal could not be added")
  await page.reload(); await openResearch(page)
  await expect(page.getByText("Saving was attempted. Retry uses these same edits.", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Edit preview", exact: true })).toHaveCount(0)
  await expect(page.getByText("Durable application retry", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Add proposal", exact: true }).click()
  await expect(page.getByRole("form", { name: "Revise plan with AI" })).toHaveCount(0)
  expect(planning(await graph(page)).planning.proposals).toHaveLength(1)
})

test("private draft closing drops only newer unsaved edits and restores the saved checkpoint", async ({ page }) => {
  await setup(page); await openResearch(page); await generate(page)
  await page.getByRole("button", { name: "Edit preview", exact: true }).click()
  await page.getByRole("textbox", { name: "Plan title", exact: true }).fill("Keep saved checkpoint")
  await page.getByRole("button", { name: "Save draft", exact: true }).click()
  await expect(page.getByText("Private draft saved. Not added to the plan.", { exact: true })).toBeVisible()
  await page.getByRole("textbox", { name: "Plan title", exact: true }).fill("Discard only this new edit")
  await page.getByRole("button", { name: "Close", exact: true }).click()
  await page.getByRole("button", { name: "Discard edits", exact: true }).click()
  await openResearch(page)
  await expect(page.getByRole("textbox", { name: "Plan title", exact: true })).toHaveValue("Keep saved checkpoint")
})

test("private draft acknowledgement after switching plans cannot apply the old proposal", async ({ page }) => {
  await setup(page); await openResearch(page); await generate(page)
  const before = await graph(page)
  await page.getByRole("button", { name: "Edit preview", exact: true }).click()
  await page.getByRole("textbox", { name: "Plan title", exact: true }).fill("Old plan draft")
  await page.evaluate(() => window.dispatchEvent(new Event("focus")))
  await expect(page.getByRole("textbox", { name: "Plan title", exact: true })).toBeEnabled()
  let release: () => void = () => undefined, started: () => void = () => undefined
  const gate = new Promise<void>(resolve => { release = resolve })
  const writing = new Promise<void>(resolve => { started = resolve })
  await page.route("**/__fixture/research-draft", async route => {
    if (!route.request().postDataJSON().input) { await route.continue(); return }
    started(); await gate; await route.fulfill({ response: await route.fetch() })
  })
  await page.getByRole("button", { name: "Add proposal", exact: true }).click(); await writing
  await openResearch(page, "Marketing")
  await expect(page.getByText("Revise Marketing", { exact: true })).toBeVisible()
  const received = page.waitForResponse(response => response.url().includes("/__fixture/research-draft") && Boolean(response.request().postDataJSON().input))
  release(); await (await received).finished()
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  expect(await graph(page)).toEqual(before)
  await expect(page.getByText("Revise Marketing", { exact: true })).toBeVisible()
})

for (const status of ["running", "denied", "offline"] as const) {
  test(`automatic recovery ${status} waits for verification and never regenerates`, async ({ page }) => {
    const runs = await setup(page); await openResearch(page); await generate(page)
    const before = await graph(page)
    await page.getByRole("button", { name: "Close", exact: true }).click()
    let reads = 0, drafts = 0
    let release: () => void = () => undefined
    const gate = new Promise<void>(resolve => { release = resolve })
    page.on("request", request => { if (request.url().includes("/__fixture/research-draft")) drafts++ })
    await page.route("**/__fixture/revision-read", async route => {
      reads++; await gate
      if (status === "offline") { await route.abort(); return }
      await route.fulfill({ json: status === "denied"
        ? { error: "Private source details", failure: { code: "sources_changed" } }
        : { run: { version: 1, id: route.request().postDataJSON().id, status: "running", result: null, credits: null, resultRevision: null, applicability: "unavailable" } } })
    })
    await openResearch(page)
    await expect.poll(() => reads).toBe(1)
    await expect(page.getByText("Checking research sources…", { exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Add proposal", exact: true })).toHaveCount(0)
    await expect(page.getByRole("list", { name: "Proposed plan items" })).toHaveCount(0)
    release()
    if (status === "running") await expect(page.getByText("Research is still running or recovering. Check status shortly.", { exact: true })).toBeVisible()
    else await expect(page.getByRole("alert")).toHaveText(researchRecovery[status === "denied" ? "sources_changed" : "verification_unavailable"].message)
    // Reconnect makes one authorized read for recoverable runs. A denied
    // source stays denied, and focus cannot duplicate an in-flight read.
    await page.evaluate(() => { window.dispatchEvent(new Event("online")); window.dispatchEvent(new Event("focus")) })
    await expect.poll(() => reads).toBe(status === "denied" ? 1 : 2)
    await expect(page.getByText("Checking research sources…", { exact: true })).toHaveCount(0)
    expect(drafts).toBe(0); expect(runs.size).toBe(1)
    expect(await graph(page)).toEqual(before)
    await expect(page.getByText("Private source details")).toHaveCount(0)
    await page.unroute("**/__fixture/revision-read")
    // Keep the same authorized server fixture for the explicit retry.
    await page.route("**/__fixture/revision-read", route => route.fulfill({ json: { run: {
      version: 1, id: route.request().postDataJSON().id, status: "succeeded", credits: null,
      result: [...runs.values()][0], resultRevision: 1, applicability: "review_required",
    } } }))
    if (status !== "denied") {
      await page.getByRole("button", { name: "Check status", exact: true }).click()
      await expect(page.getByRole("button", { name: "Add proposal", exact: true })).toBeEnabled()
      expect(runs.size).toBe(1); expect(await graph(page)).toEqual(before)
    }
  })
}

test("automatic recovery ignores an invalid browser pointer without requesting research", async ({ page }) => {
  await setup(page); await openResearch(page); await generate(page)
  await page.getByRole("button", { name: "Close", exact: true }).click()
  await page.evaluate(() => {
    for (const key of Object.keys(sessionStorage)) if (key.startsWith("workspace-research:")) sessionStorage.setItem(key, "not-a-run")
  })
  let reads = 0
  page.on("request", request => { if (request.url().includes("/__fixture/revision-read")) reads++ })
  await openResearch(page)
  await expect(page.getByRole("textbox", { name: "Research request" })).toBeEnabled()
  await expect(page.getByRole("button", { name: "Previous research", exact: true })).toBeVisible()
  expect(reads).toBe(0)
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith("workspace-research:")))).toEqual([])
})


for (const destination of ["close", "link"] as const) {
  test(`private draft save and leave ${destination} restores edits without applying`, async ({ page }) => {
    const runs = await setup(page); await openResearch(page); await generate(page)
    const before = await graph(page)
    await page.getByRole("button", { name: "Edit preview", exact: true }).click()
    await page.getByRole("textbox", { name: "Plan title", exact: true }).fill("Save before leaving")
    if (destination === "close") await page.getByRole("button", { name: "Close", exact: true }).click()
    else await (await navigationLink(page)).click()
    await expect(page.getByRole("button", { name: "Keep editing", exact: true })).toBeFocused()
    await page.getByRole("button", { name: destination === "close" ? "Save and close" : "Save and leave", exact: true }).click()
    if (destination === "link") await expect(page).toHaveURL(/\?revisions&destination$/)
    await expect(page.getByRole("form", { name: "Revise plan with AI" })).toHaveCount(0)
    await openResearch(page)
    await expect(page.getByRole("textbox", { name: "Plan title", exact: true })).toHaveValue("Save before leaving")
    expect(await graph(page)).toEqual(before); expect(runs.size).toBe(1)
    expect(await page.evaluate(() => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]))).not.toContain("Save before leaving")
  })
}

test("private draft save and leave uncertain acknowledgement stays open and retries exactly", async ({ page }) => {
  await setup(page); await openResearch(page); await generate(page)
  const before = await graph(page), writes: unknown[] = []
  await page.getByRole("button", { name: "Edit preview", exact: true }).click()
  await page.getByRole("textbox", { name: "Plan title", exact: true }).fill("Retry before leaving")
  await page.route("**/__fixture/research-draft", async route => {
    const input = route.request().postDataJSON().input
    if (!input) { await route.continue(); return }
    writes.push(input)
    if (writes.length === 1) { await route.fetch(); await route.abort(); return }
    await route.continue()
  })
  await page.getByRole("button", { name: "Close", exact: true }).click()
  await page.getByRole("button", { name: "Save and close", exact: true }).click()
  await expect(page.getByRole("alert")).toContainText("Draft save unconfirmed")
  await expect(page.getByRole("form", { name: "Revise plan with AI" })).toBeVisible()
  await page.getByRole("button", { name: "Retry draft", exact: true }).click()
  await expect(page.getByRole("button", { name: "Close saved draft", exact: true })).toBeEnabled()
  await page.getByRole("button", { name: "Close saved draft", exact: true }).click()
  await expect(page.getByRole("form", { name: "Revise plan with AI" })).toHaveCount(0)
  expect(writes).toHaveLength(2); expect(writes[1]).toEqual(writes[0]); expect(await graph(page)).toEqual(before)
})

for (const action of ["keep", "switch"] as const) {
  test(`private draft save and leave late acknowledgement respects ${action}`, async ({ page }) => {
    await setup(page); await openResearch(page); await generate(page)
    const before = await graph(page)
    await page.getByRole("button", { name: "Edit preview", exact: true }).click()
    await page.getByRole("textbox", { name: "Plan title", exact: true }).fill("Late save stays private")
    let release: () => void = () => undefined, started: () => void = () => undefined
    const gate = new Promise<void>(resolve => { release = resolve })
    const writing = new Promise<void>(resolve => { started = resolve })
    await page.route("**/__fixture/research-draft", async route => {
      if (!route.request().postDataJSON().input) { await route.continue(); return }
      started(); await gate; await route.fulfill({ response: await route.fetch() })
    })
    await page.getByRole("button", { name: "Close", exact: true }).click()
    await page.getByRole("button", { name: "Save and close", exact: true }).click(); await writing
    if (action === "keep") await page.getByRole("button", { name: "Keep editing", exact: true }).click()
    else await openResearch(page, "Marketing")
    const received = page.waitForResponse(response => response.url().includes("/__fixture/research-draft") && Boolean(response.request().postDataJSON().input))
    release(); await (await received).finished()
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    await expect(page.getByRole("form", { name: "Revise plan with AI" })).toBeVisible()
    if (action === "keep") await expect(page.getByRole("textbox", { name: "Plan title", exact: true })).toHaveValue("Late save stays private")
    else await expect(page.getByText("Revise Marketing", { exact: true })).toBeVisible()
    expect(await graph(page)).toEqual(before)
  })
}

test("private draft save and leave restores incomplete copy and still blocks application", async ({ page }) => {
  const runs = await setup(page); await openResearch(page); await generate(page)
  const before = await graph(page)
  await page.getByRole("button", { name: "Edit preview", exact: true }).click()
  await page.getByRole("textbox", { name: "Plan title", exact: true }).fill("")
  await page.getByRole("textbox", { name: "Item 1 title", exact: true }).fill("  ")
  await page.getByRole("button", { name: "Add item", exact: true }).click()
  await page.getByRole("textbox", { name: "Item 2 details", exact: true }).fill("Keep these unfinished notes")
  await expect(page.getByRole("button", { name: "Add proposal", exact: true })).toBeDisabled()
  await page.getByRole("button", { name: "Close", exact: true }).click()
  await page.getByRole("button", { name: "Save and close", exact: true }).click()
  await expect(page.getByRole("form", { name: "Revise plan with AI" })).toHaveCount(0)
  await page.reload(); await openResearch(page)
  await expect(page.getByRole("textbox", { name: "Plan title", exact: true })).toHaveValue("")
  await expect(page.getByRole("textbox", { name: "Item 1 title", exact: true })).toHaveValue("  ")
  await expect(page.getByRole("textbox", { name: "Item 2 title", exact: true })).toHaveValue("")
  await expect(page.getByRole("textbox", { name: "Item 2 details", exact: true })).toHaveValue("Keep these unfinished notes")
  await expect(page.getByRole("button", { name: "Save draft", exact: true })).toBeDisabled()
  await expect(page.getByRole("button", { name: "Add proposal", exact: true })).toBeDisabled()
  expect(await graph(page)).toEqual(before); expect(runs.size).toBe(1)
  expect(await page.evaluate(() => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]))).not.toContain("Keep these unfinished notes")
  await page.getByRole("textbox", { name: "Plan title", exact: true }).fill("Finished plan")
  await page.getByRole("textbox", { name: "Item 1 title", exact: true }).fill("Finished item")
  await page.getByRole("textbox", { name: "Item 2 title", exact: true }).fill("Additional item")
  await page.getByRole("button", { name: "Add proposal", exact: true }).click()
  await expect.poll(async () => planning(await graph(page)).planning.proposals.filter(proposal => proposal.status === "pending").length).toBe(1)
})

test("incremental items grow read-only, clear on repair and wait for a saved result",async({page})=>{
 await page.setViewportSize({width:390,height:844})
 const stream=await setupProgress(page),before=await graph(page)
 await stream.send(1,"run.started",{})
 const item={key:"first",kind:"note",title:"Prepare invitations",description:"Use approved details."}
 await stream.send(2,"preview.item",{item})
 const section=page.getByRole("region",{name:"Plan taking shape"})
 await expect(section).toBeVisible()
 await expect(section.getByText("Connections pending.",{exact:false})).toBeVisible()
 await stream.send(3,"preview.item",{item:{...item,key:"second",title:"Confirm schedule"}})
 await expect(section.getByRole("listitem")).toHaveCount(2)
 expect(await section.getByRole("button").count()).toBe(0)
 await expect(page.getByRole("button",{name:"Edit preview",exact:true})).toHaveCount(0)
 expect(await graph(page)).toEqual(before)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await stream.send(4,"preview.cleared",{})
 await expect(section).toHaveCount(0)
 await stream.send(5,"preview.item",{item:{...item,title:"Revised invitations"}})
 await expect(section.getByText("Revised invitations")).toBeVisible()
 await stream.send(6,"preview.cleared",{})
 await stream.send(7,"preview.updated",{result:stream.result})
 await expect(section).toHaveCount(0)
 await expect(page.getByRole("region",{name:"Unsaved plan preview"})).toBeVisible()
 await expect(page.getByRole("button",{name:"Edit preview",exact:true})).toHaveCount(0)
 await stream.send(8,"result.ready",{resultId:stream.result.runId})
 await stream.send(9,"run.snapshot",{watermark:9,run:{version:1,resultRevision:1,applicability:"review_required",id:stream.result.runId,credits:0,status:"succeeded",result:stream.result}})
 await stream.send(10,"run.terminal",{status:"succeeded"})
 await page.evaluate(()=>(window as unknown as StreamWindow).finishResearchStream())
 await expect(page.getByRole("button",{name:"Edit preview",exact:true})).toBeVisible()
 expect(stream.reads()).toBe(0);expect(await graph(page)).toEqual(before)
})

test("interrupted incremental items disappear before denied saved readback",async({page})=>{
 const stream=await setupProgress(page),before=await graph(page)
 await page.route("**/__fixture/revision-read",route=>route.fulfill({json:{error:"Sources are no longer available.",failure:{code:"source_unavailable"}}}))
 await stream.send(1,"run.started",{})
 await stream.send(2,"preview.item",{item:{key:"first",kind:"note",title:"Private incoming item",description:""}})
 await expect(page.getByText("Private incoming item")).toBeVisible()
 await page.evaluate(()=>(window as unknown as StreamWindow).finishResearchStream())
 await expect(page.getByText("Private incoming item")).toHaveCount(0)
 await expect(page.getByRole("button",{name:"Edit preview",exact:true})).toHaveCount(0)
 expect(await graph(page)).toEqual(before)
 expect(await page.evaluate(()=>(window as unknown as StreamWindow).researchStarts)).toBe(1)
})


test("missing outputs remain visible through editing and saved-run recovery", async ({ page }) => {
  const missing = ["Working application form", "Editable response table"]
  const runs = await setup(page, false, undefined, missing)
  await openResearch(page)
  await expect(page.getByText("Creates plan proposals and notes from workspace sources.", { exact: false })).toBeVisible()
  await generate(page)
  const before = await graph(page)
  const omissions = page.getByRole("list", { name: "Unfulfilled outputs" })
  await expect(omissions.getByRole("listitem")).toHaveText(missing)
  await page.getByRole("button", { name: "Edit preview", exact: true }).click()
  await expect(omissions.getByRole("listitem")).toHaveText(missing)
  await page.getByRole("textbox", { name: "Plan title", exact: true }).fill("Editable partial proposal")
  await page.getByRole("button", { name: "Save draft", exact: true }).click()
  await expect(page.getByText("Private draft saved. Not added to the plan.", { exact: true })).toBeVisible()
  await page.reload(); await openResearch(page)
  await expect(omissions.getByRole("listitem")).toHaveText(missing)
  await expect(page.getByRole("textbox", { name: "Plan title", exact: true })).toHaveValue("Editable partial proposal")
  expect(await graph(page)).toEqual(before)
  expect(runs.size).toBe(1)
  await page.getByRole("button", { name: "Review changes", exact: true }).click()
  await expect(omissions.getByRole("listitem")).toHaveText(missing)
  await expect(page.getByRole("button", { name: "Add proposal", exact: true })).toBeEnabled()
})
