import { expect, test, type Page } from "@playwright/test"
const items=[
 {id:"person:alice",revision:"1",title:"Alice",group:"People",available:true,detail:"Contact",avatarUrl:"http://127.0.0.1:3187/__fixture/alice.svg"},
 {id:"person:bob",revision:"1",title:"Bob Smith",group:"People",available:true,detail:"Team"},
 {id:"particle:card",revision:"1",title:"Review evidence",group:"Particles",available:true},
 {id:"document:mission",revision:"1",title:"Mission",group:"Documents",available:true},
 {id:"particle:objective",revision:"1",title:"Launch pilot",group:"Objectives",available:true},
 {id:"particle:objective:plan:pilot",revision:"1:1",title:"Pilot plan",group:"Plans",available:true},
]
async function setup(page:Page) {
 await page.route("**/__fixture/alice.svg",route=>route.fulfill({contentType:"image/svg+xml",body:'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="#6b859c"/></svg>'}))
 await page.route("**/__fixture/composer-context",route=>{
  const query=route.request().postDataJSON().query.toLowerCase()
  return route.fulfill({json:{items:items.filter(item=>`${item.title} ${item.group}`.toLowerCase().includes(query)),unavailable:[]}})
 })
 await page.goto("/?planner&context")
 return page.getByRole("textbox",{name:"Plan an objective or search Particles"})
}
test("typed slash closes on removal; @ is grouped, keyboard selectable, deduplicated and removable",async({page})=>{
 const input=await setup(page)
 const before=await input.boundingBox()
 await input.pressSequentially("/")
 await expect(page.getByRole("listbox",{name:"Create a Particle"})).toBeVisible()
 await input.press("Backspace")
 await expect(page.getByRole("listbox")).toHaveCount(0)
 expect((await input.boundingBox())!.y).toBe(before!.y)
 await input.pressSequentially("@")
 for(const group of ["People","Particles","Documents","Objectives","Plans"])await expect(page.getByRole("group",{name:group,exact:true})).toBeVisible()
 const contextMenu=page.locator("[data-composer-menu]")
 for(const label of await contextMenu.locator('[role="option"] .truncate').all())await expect(label).toHaveCSS("font-weight","400")
 const documentAction=contextMenu.getByRole("button",{name:"Work on a document…",exact:true})
 await expect(documentAction).toHaveCSS("font-weight","400")
 await expect(documentAction).toHaveCSS("column-gap","6px")
 await expect(documentAction).toHaveCSS("height","32px")
 await expect(documentAction).toHaveCSS("padding-left","8px")
 const alice=page.getByRole("option",{name:"Alice Contact"})
 await expect(alice.locator("img")).toBeVisible()
 await expect(alice.locator("[data-slot=avatar]")).toHaveCSS("width","24px")
 await expect(page.getByRole("option",{name:"Bob Smith Team"}).locator("[data-slot=avatar-fallback]")).toHaveText("BS")
 await input.press("Enter")
 await expect(input).toHaveText("Alice")
 await expect(input.getByRole("button",{name:"Remove Alice from context"})).toBeVisible()
 await expect(page.getByLabel("Selected AI context",{exact:true})).toHaveCount(0)
 await expect(page.getByRole("listbox")).toHaveCount(0)
 await expect(page.getByRole("button",{name:"Remove Alice from context"})).toBeVisible()
 await page.getByRole("button",{name:"Add files and more",exact:true}).click()
 await page.getByRole("option",{name:"Alice Contact"}).click()
 await expect(input.getByRole("button",{name:"Remove Alice from context"})).toHaveCount(2)
 await page.getByRole("button",{name:"Add files and more",exact:true}).click()
 await input.getByRole("button",{name:"Remove Alice from context"}).first().click()
 await input.getByRole("button",{name:"Remove Alice from context"}).click()
 await expect(page.getByRole("listbox")).toHaveCount(0)
 expect(await input.textContent()).not.toContain("Alice")
 await input.fill("")
 await page.getByRole("button",{name:"Add files and more",exact:true}).click()
 await input.pressSequentially("@")
 await expect(page.getByRole("option",{name:"Alice Contact"})).toBeVisible()
 await input.press("Escape")
 await input.fill("email@example.com")
 await expect(page.getByRole("listbox")).toHaveCount(0)
 await input.fill("@")
 await expect(page.getByRole("listbox")).toBeVisible()
 await input.press("Escape")
 await expect(page.getByRole("listbox")).toHaveCount(0)
})
test("selected context survives planning review and reaches the request; inline deletion removes it",async({page})=>{
 const input=await setup(page)
 let submitted:Record<string,unknown>|undefined
 await page.route("**/api/workspace-ai/research",route=>{
  submitted=route.request().postDataJSON()
  return route.fulfill({json:{error:"Fixture stopped before provider",reserved:false}})
 })
 await input.fill("Use @documents")
 await page.getByRole("option",{name:"Mission",exact:true}).click()
 await expect(input).toHaveText("Use Mission")
 await input.press("End")
 await input.pressSequentially("to build a plan")
 await input.press("Enter")
 await expect(page.getByRole("button",{name:"Remove Mission from context"})).toBeVisible()
 await page.getByRole("button",{name:"Generate plan",exact:true}).click()
 await expect.poll(()=>submitted?.context).toEqual([{id:"document:mission",revision:"1"}])
 await expect.poll(()=>submitted?.prompt).toBe("Use @{Mission} to build a plan")
 await input.fill("Build a plan without references")
 await expect(page.getByRole("button",{name:"Remove Mission from context"})).toHaveCount(0)
})
test("context menu fits narrow dark/light surfaces without moving the input",async({page})=>{
 await page.setViewportSize({width:390,height:844})
 const input=await setup(page)
 for(const dark of [false,true]){
  await page.evaluate(dark=>document.documentElement.classList.toggle("dark",dark),dark)
  await input.fill("")
  const before=await input.boundingBox()
  await input.pressSequentially("@")
  await expect(page.getByRole("option",{name:"Mission",exact:true})).toBeVisible()
  expect((await input.boundingBox())!.y).toBe(before!.y)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:`test-results/composer-context-${dark?"dark":"light"}.png`})
 }
})

test("creation menu has compact icons and immediate hover without scrolling",async({page})=>{
 const input=await setup(page)
 await input.fill("/")
 const menu=page.locator("[data-composer-menu]")
 const form=page.getByRole("option",{name:"Form",exact:true})
 await expect(form).toBeVisible()
 await expect(form).toHaveCSS("font-weight","400")
 await expect(form).toHaveCSS("column-gap","6px")
 await expect(form).toHaveCSS("height","32px")
 const frame=await menu.boundingBox(),dock=await page.locator("form.canvas-planning-material").boundingBox()
 expect(dock!.y-frame!.y-frame!.height).toBe(4)
 await expect(form.locator("svg")).toHaveClass(/clipboard-list/)
 await expect(page.getByRole("option",{name:"Objective",exact:true}).locator("svg")).toHaveClass(/flag/)
 const initial=await menu.evaluate(el=>el.scrollTop)
 for(const label of ["Form","Notes","Table","Form"]){
  await page.getByRole("option",{name:label,exact:true}).hover()
  await expect(page.getByRole("option",{name:label,exact:true})).toHaveAttribute("aria-selected","true")
  expect(await menu.evaluate(el=>el.scrollTop)).toBe(initial)
 }
 // A partly visible bottom row must not scroll itself under the pointer.
 await page.mouse.move(frame!.x+100,frame!.y+frame!.height-12)
 await expect(page.getByRole("option",{name:"Finance",exact:true})).toHaveAttribute("aria-selected","true")
 await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))))
 expect(await menu.evaluate(el=>el.scrollTop)).toBe(initial)
 expect(await form.evaluate(el=>({duration:getComputedStyle(el).transitionDuration,before:getComputedStyle(el,"::before").content}))).toEqual({duration:"0s",before:"none"})
 await input.hover()
 await expect(page.getByRole("option",{selected:true})).toHaveCount(0)
 await input.press("ArrowDown")
 await expect(page.getByRole("option",{name:"Objective",exact:true})).toHaveAttribute("aria-selected","true")
 for(const dark of [false,true]){
  await page.evaluate(dark=>document.documentElement.classList.toggle("dark",dark),dark)
  await page.screenshot({path:`test-results/composer-create-${dark?"dark":"light"}.png`})
 }
})

test("context reuses recent results and in-flight loads, expires, and clears across organizations",async({page})=>{
 const now=new Date("2026-11-04T20:00:00Z")
 await page.clock.setFixedTime(now)
 let requests=0,release:()=>void=()=>{}
 const held=new Promise<void>(resolve=>{release=resolve})
 await page.route("**/__fixture/composer-context",async route=>{
  requests++
  if(requests===1)await held
  await route.fulfill({json:{items,unavailable:[]}})
 })
 await page.goto("/?planner&context")
 const input=page.getByRole("textbox",{name:"Plan an objective or search Particles"})
 const plus=page.getByRole("button",{name:"Add files and more",exact:true})
 await input.fill("@")
 await expect.poll(()=>requests).toBe(1)
 await input.press("Escape")
 await plus.click()
 release()
 await expect(page.getByRole("option",{name:"Alice Contact"})).toBeVisible()
 expect(requests).toBe(1)
 await input.press("Escape")
 await plus.click()
 await expect(page.getByRole("option",{name:"Alice Contact"})).toBeVisible()
 await expect(page.getByText("Loading context…",{exact:true})).toHaveCount(0)
 expect(requests).toBe(1)
 await input.press("Escape")
 await page.clock.setFixedTime(new Date(now.getTime()+31_000))
 await plus.click()
 await expect.poll(()=>requests).toBe(2)
 await expect(page.getByRole("option",{name:"Alice Contact"})).toBeVisible()
 await input.press("Escape")
 await page.getByRole("button",{name:"Switch fixture organization"}).click()
 await input.fill("@")
 await expect.poll(()=>requests).toBe(3)
 await expect(page.getByRole("option",{name:"Alice Contact"})).toBeVisible()
})

test("context evicts displayed results on focus and does not restore a pre-invalidation response",async({page})=>{
 let requests=0,release:()=>void=()=>{}
 const held=new Promise<void>(resolve=>{release=resolve})
 await page.route("**/__fixture/composer-context",async route=>{
  const request=++requests
  if(request===2)await held
  await route.fulfill({json:{items:request<3?items:items.filter(item=>item.id!=="person:alice"),unavailable:[]}})
 })
 await page.goto("/?planner&context")
 const input=page.getByRole("textbox",{name:"Plan an objective or search Particles"})
 await input.fill("@")
 await expect(page.getByRole("option",{name:"Alice Contact"})).toBeVisible()
 await page.evaluate(()=>window.dispatchEvent(new Event("focus")))
 await expect.poll(()=>requests).toBe(2)
 await expect(page.getByRole("option",{name:"Alice Contact"})).toHaveCount(0)
 // Coalesced lifecycle events invalidate the outstanding read before reloading.
 await page.evaluate(()=>{window.dispatchEvent(new Event("online"));document.dispatchEvent(new Event("visibilitychange"))})
 await expect.poll(()=>requests).toBe(3)
 await expect(page.getByRole("option",{name:"Bob Smith Team"})).toBeVisible()
 const staleResponse=page.waitForResponse("**/__fixture/composer-context")
 release()
 await staleResponse
 await input.press("Escape")
 await page.getByRole("button",{name:"Add files and more",exact:true}).click()
 await expect(page.getByRole("option",{name:"Bob Smith Team"})).toBeVisible()
 await expect(page.getByRole("option",{name:"Alice Contact"})).toHaveCount(0)
 expect(requests).toBe(3)
})

test("context expiration refreshes an open picker but does not poll a closed one",async({page})=>{
 await page.clock.install()
 let requests=0
 await page.route("**/__fixture/composer-context",route=>route.fulfill({json:{items:++requests===1?items:[],unavailable:[]}}))
 await page.goto("/?planner&context")
 const input=page.getByRole("textbox",{name:"Plan an objective or search Particles"})
 await input.fill("@")
 await expect(page.getByRole("option",{name:"Alice Contact"})).toBeVisible()
 await page.clock.runFor(30_100)
 await expect.poll(()=>requests).toBe(2)
 await expect(page.getByRole("option",{name:"Alice Contact"})).toHaveCount(0)
 await expect(page.getByText("No matches",{exact:true})).toBeVisible()
 await input.press("Escape")
 await page.clock.runFor(60_100)
 await page.evaluate(()=>window.dispatchEvent(new Event("focus")))
 expect(requests).toBe(2)
 await page.getByRole("button",{name:"Add files and more",exact:true}).click()
 await expect.poll(()=>requests).toBe(3)
})

test("context revalidation failure removes previous results and retries without changing the prompt",async({page})=>{
 let requests=0
 await page.route("**/__fixture/composer-context",route=>{
  requests++
  return requests===2?route.fulfill({status:403,json:{error:"Access revoked"}}):route.fulfill({json:{items:requests===1?items:[],unavailable:[]}})
 })
 await page.goto("/?planner&context")
 const input=page.getByRole("textbox",{name:"Plan an objective or search Particles"})
 await input.fill("Help with @")
 await expect(page.getByRole("option",{name:"Alice Contact"})).toBeVisible()
 await page.evaluate(()=>window.dispatchEvent(new Event("focus")))
 await expect(page.getByRole("button",{name:"Retry",exact:true})).toBeVisible()
 await expect(page.getByRole("option",{name:"Alice Contact"})).toHaveCount(0)
 await page.getByRole("button",{name:"Retry",exact:true}).click()
 await expect(page.getByText("No matches",{exact:true})).toBeVisible()
 await expect(input).toHaveText("Help with @")
 expect(requests).toBe(3)
})

test("context retries failures and partial results without mixing query caches",async({page})=>{
 let requests=0
 await page.route("**/__fixture/composer-context",route=>{
  requests++
  if(requests===1)return route.fulfill({status:503,json:{error:"Fixture unavailable"}})
  const query=route.request().postDataJSON().query
  return route.fulfill({json:{items:items.filter(item=>!query||item.title.toLowerCase().includes(query)),unavailable:requests===2?["People"]:[]}})
 })
 await page.goto("/?planner&context")
 const input=page.getByRole("textbox",{name:"Plan an objective or search Particles"})
 const plus=page.getByRole("button",{name:"Add files and more",exact:true})
 await input.fill("@")
 await page.getByRole("button",{name:"Retry",exact:true}).click()
 await expect(page.getByText("People unavailable.",{exact:true})).toBeVisible()
 await input.press("Escape")
 await plus.click()
 await expect.poll(()=>requests).toBe(3)
 await expect(page.getByText("People unavailable.",{exact:true})).toHaveCount(0)
 await input.fill("@mission")
 await expect(page.getByRole("option",{name:"Mission",exact:true})).toBeVisible()
 await expect(page.getByRole("option",{name:"Alice Contact"})).toHaveCount(0)
 expect(requests).toBe(4)
 await input.fill("@")
 await expect(page.getByRole("option",{name:"Alice Contact"})).toBeVisible()
 expect(requests).toBe(4)
})

test("inline references preserve surrounding prose, support atomic deletion and undo, and serialize once",async({page})=>{
 const input=await setup(page)
 await input.fill("Ask @alice about the plan")
 // Place the caret directly after the typed query, in the middle of the sentence.
 for(let i=0;i<15;i++) await input.press("ArrowLeft")
 await expect(page.getByRole("option",{name:"Alice Contact"})).toBeVisible()
 await page.getByRole("option",{name:"Alice Contact"}).click()
 await expect(input).toHaveText("Ask Alice about the plan")
 await expect(input).not.toContainText("@{")
 await page.screenshot({path:"test-results/composer-inline-mentions.png"})
 const chip=input.getByRole("button",{name:"Remove Alice from context"})
 await chip.focus()
 await chip.press("Enter")
 await expect(chip).toHaveCount(0)
 await input.press("ControlOrMeta+z")
 await expect(chip).toBeVisible()
 await expect(input).toHaveText("Ask Alice about the plan")
 // Put the native caret directly after the inline node, then delete with Backspace.
 await chip.evaluate(el=>{
  const range=document.createRange()
  range.setStartAfter(el.closest(".node-mention")!);range.collapse(true)
  const selection=getSelection()!;selection.removeAllRanges();selection.addRange(range)
 })
 await input.press("Backspace")
 await expect(chip).toHaveCount(0)
 await input.press("ControlOrMeta+z")
 await expect(chip).toBeVisible()
 let submitted:Record<string,unknown>|undefined
 await page.route("**/api/workspace-ai/research",route=>{
  submitted=route.request().postDataJSON()
  return route.fulfill({json:{error:"Fixture stopped before provider",reserved:false}})
 })
 await input.press("Enter")
 await page.getByRole("button",{name:"Generate plan",exact:true}).click()
 await expect.poll(()=>submitted?.context).toEqual([{id:"person:alice",revision:"1"}])
 await expect.poll(()=>submitted?.prompt).toBe("Ask @{Alice}  about the plan")
})

test("paste remains plain text and composition does not submit or open a menu",async({page})=>{
 const input=await setup(page)
 await input.focus()
 await input.evaluate(el=>{
  const data=new DataTransfer()
  data.setData("text/plain","@alice\nPlan together")
  data.setData("text/html",'<span data-composer-mention="person:alice">Alice</span>')
  el.dispatchEvent(new ClipboardEvent("paste",{bubbles:true,cancelable:true,clipboardData:data}))
 })
 await expect(input).toContainText("@alice")
 await expect(input.locator("[data-composer-mention]")).toHaveCount(0)
 await expect(page.getByRole("listbox")).toHaveCount(0)
 await input.fill("@")
 await expect(page.getByRole("listbox")).toBeVisible()
 await input.dispatchEvent("compositionstart")
 await input.dispatchEvent("keydown",{key:"Enter",code:"Enter",isComposing:true})
 await expect(page.getByRole("listbox")).toHaveCount(0)
 await expect(page.getByRole("button",{name:"Generate plan",exact:true})).toHaveCount(0)
 await input.dispatchEvent("compositionend")
})

test("local access mutation evicts only the affected organization context",async({page})=>{
 let calls=0
 await page.route("**/__fixture/composer-context",route=>{calls++;return route.fulfill({json:{items:[{...items[0],title:calls===1?"Before access change":"After access change"}],unavailable:[]}})})
 await page.goto("/?planner&context")
 await page.getByRole("textbox",{name:"Plan an objective or search Particles"}).fill("@")
 await expect(page.getByRole("option",{name:/Before access change/})).toBeVisible()
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent("coach-house:workspace-access-changed",{detail:{orgId:"99500000-0000-4000-8000-000000000001"}})))
 expect(calls).toBe(1)
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent("coach-house:workspace-access-changed",{detail:{orgId:"00000000-0000-4000-8000-000000000020"}})))
 await expect(page.getByRole("option",{name:/After access change/})).toBeVisible()
 await expect(page.getByRole("option",{name:/Before access change/})).toHaveCount(0)
})
