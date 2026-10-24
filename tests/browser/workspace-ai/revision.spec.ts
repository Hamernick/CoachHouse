import { expect, test, type Page } from "@playwright/test"
import type { ResearchRequest, ResearchResult } from "../../../src/features/workspace-ai/research-types"
import type { ParticleGraph } from "../../../src/features/workspace-particles/types"

const kept = "00000000-0000-4000-8000-000000000104", removed = "00000000-0000-4000-8000-000000000105"
const first = "00000000-0000-4000-8000-000000000102", second = "00000000-0000-4000-8000-000000000103"
function response(request: ResearchRequest, removalOnly = false): ResearchResult {
  return {runId:request.id,target:request.target,title:"Workshop preparation revised",summary:"Fixture research: replace the old flyer while preserving completed venue work.",questions:[],decisions:[],removeReferences:[`particle:${removed}`],
    items:removalOnly?[]:[{key:"venue",title:"Venue confirmed",kind:"reference",description:"",referenceId:`particle:${kept}`,evidenceIds:[],dependsOn:[]},{key:"invitation",title:"Prepare invitations",kind:"note",description:"Use the approved venue details.",referenceId:null,evidenceIds:[],dependsOn:["venue"]}],
    sources:[{id:`particle:${kept}`,title:"Venue confirmed",href:"/workspace",revision:"0",checkedAt:"2026-10-24T12:00:00.000Z",kind:"workspace"},{id:`particle:${removed}`,title:"Old flyer",href:"/workspace",revision:"0",checkedAt:"2026-10-24T12:00:00.000Z",kind:"workspace"}]}
}
async function setup(page: Page, removalOnly = false) {
  const runs = new Map<string, ResearchResult>()
  await page.route("**/api/workspace-ai/research",async route=>{
    const request=route.request().postDataJSON() as ResearchRequest
    const result=response(request,removalOnly);runs.set(request.id,result)
    await page.evaluate(({id,result})=>localStorage.setItem(`revision-result:${id}`,JSON.stringify(result)),{id:request.id,result})
    await route.fulfill({json:{run:{status:"succeeded",result}}})
  })
  await page.route("**/__fixture/revision-read",async route=>{
    const {id}=route.request().postDataJSON()
    await route.fulfill({json:{run:{status:"succeeded",result:runs.get(id)}}})
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

test("fixture revision keeps accepted work until owner accepts; reload preserves it",async({page})=>{
  const runs=await setup(page)
  await openResearch(page);await generate(page)
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
  await page.getByRole("button",{name:"Check status",exact:true}).click()
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
  await page.route("**/api/workspace-ai/research",async route=>{started();await gate;await route.fulfill({json:{run:{status:"succeeded",result:response(route.request().postDataJSON())}}})})
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

test("fixture stale recovered research remains readable but cannot be proposed",async({page})=>{
  await setup(page);await openResearch(page);await generate(page)
  await page.getByRole("button",{name:"Close",exact:true}).click()
  await page.getByRole("button",{name:"Advance fixture plan revision",exact:true}).click()
  await page.reload();await openResearch(page)
  await page.getByRole("button",{name:"Check status",exact:true}).click()
  await expect(page.getByRole("list",{name:"Research membership removals"})).toContainText("Old flyer")
  await expect(page.getByRole("button",{name:"Add proposal",exact:true})).toBeDisabled()
  await expect(page.getByText("This plan or objective changed.",{exact:false})).toBeVisible()
  await page.getByRole("button",{name:"Discard",exact:true}).click()
  await expect(page.getByRole("textbox",{name:"Research request"})).toBeEnabled()
})

test("fixture late recovery cannot replace a newer run on the same plan",async({page})=>{
  const runs=await setup(page);await openResearch(page);await generate(page)
  const firstRun=[...runs.keys()][0]
  await page.getByRole("button",{name:"Close",exact:true}).click();await openResearch(page)
  let release:()=>void=()=>undefined
  const gate=new Promise<void>(resolve=>{release=resolve})
  let started:()=>void=()=>undefined
  const requestStarted=new Promise<void>(resolve=>{started=resolve})
  await page.route("**/__fixture/revision-read",async route=>{started();await gate;await route.fulfill({json:{run:{status:"succeeded",result:runs.get(firstRun)}}})})
  await page.getByRole("button",{name:"Check status",exact:true}).click();await requestStarted
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
