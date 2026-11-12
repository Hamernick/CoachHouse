import type { AccessData } from "@/lib/workspace/access"
import { test,expect } from "@playwright/test"
const owner="99890000-0000-4000-8000-000000000001",alice="99890000-0000-4000-8000-000000000002",creator="99890000-0000-4000-8000-000000000003"
const initial: AccessData={name:"Finance",deleted:false,restricted:true,canManage:true,revision:2,members:[{id:owner,name:"Owner",owner:true,capability:null},{id:creator,name:"Creator",owner:false,retained:"Creator",capability:null},{id:alice,name:"Alice",owner:false,capability:"edit",inheritedCapability:"view"}]}
async function open(page:import("@playwright/test").Page){
 await page.getByRole("button",{name:"Actions for Finance"}).click()
 await expect(page.getByRole("menuitem")).toHaveCount(1)
 await page.getByRole("menuitem",{name:"Access",exact:true}).click()
 await expect(page.getByRole("dialog")).toHaveAccessibleName("Finance access")
}
test("folder menu saves only direct grants and preserves retained/derived access",async({page})=>{
 let state=structuredClone(initial),writes=0
 await page.route("**/__fixture/folder-access",route=>{
  const cmd=route.request().postDataJSON()
  if(cmd.members){expect(cmd.revision).toBe(state.revision);expect(cmd.members).toEqual([]);writes++;state={...state,revision:state.revision+1,members:state.members.map(m=>m.id===alice?{...m,capability:null}:m)}}
  return route.fulfill({json:{data:state}})
 })
 await page.goto("/?folder-access");await open(page)
 await expect(page.getByRole("combobox")).toHaveCount(1)
 await expect(page.getByText("View via workspace")).toBeVisible()
 await page.getByRole("combobox").selectOption("none")
 await page.getByRole("button",{name:"Save access"}).click()
 await expect(page.getByRole("dialog")).toHaveCount(0)
 await expect(page.getByRole("button",{name:"Actions for Finance"})).toBeFocused()
 await expect(page.getByLabel("Access refresh count")).toHaveText("1")
 await open(page)
 await expect(page.getByRole("combobox")).toHaveValue("none")
 await expect(page.getByText("View via workspace")).toBeVisible()
 expect(writes).toBe(1)
 await page.setViewportSize({width:390,height:800})
 const box=await page.getByRole("dialog").boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(390)
 await page.screenshot({path:".tmp/ch-hosted-staging-20261103/folder-access-mobile.png",animations:"disabled"})
})
test("inherited folder remains read-only and cannot activate privacy",async({page})=>{
 await page.route("**/__fixture/folder-access",route=>route.fulfill({json:{data:{...initial,restricted:false,canManage:false}}}))
 await page.goto("/?folder-access");await open(page)
 await expect(page.getByRole("combobox")).toHaveCount(0)
 await expect(page.getByRole("button",{name:"Save access"})).toHaveCount(0)
 await expect(page.getByRole("checkbox")).toHaveCount(0)
 await page.keyboard.press("Escape")
 await expect(page.getByRole("button",{name:"Actions for Finance"})).toBeFocused()
})
test("stale folder save retains draft and denied reload removes names",async({page})=>{
 let denied=false
 await page.route("**/__fixture/folder-access",route=>{
  const cmd=route.request().postDataJSON()
  if(cmd.members){denied=true;return route.fulfill({json:{error:"Access changed. Reload before saving.",code:"conflict"}})}
  return route.fulfill({json:denied?{error:"Folder access is no longer available.",code:"denied"}:{data:initial}})
 })
 await page.goto("/?folder-access");await open(page)
 await page.getByRole("combobox").selectOption("manage")
 await page.getByRole("button",{name:"Save access"}).click()
 await expect(page.getByRole("combobox")).toHaveValue("manage")
 await expect(page.getByRole("button",{name:"Save access"})).toBeDisabled()
 await expect(page.getByLabel("Access refresh count")).toHaveText("1")
 await page.getByRole("button",{name:"Reload access"}).click()
 await expect(page.getByRole("alert")).toContainText("no longer available")
 await expect(page.getByRole("list",{name:"Folder access"})).toHaveCount(0)
})
const programs="99890000-0000-4000-8000-000000000020",board="99890000-0000-4000-8000-000000000021"
const workspaceState: AccessData={...initial,workspaces:[{id:programs,name:"Programs",revision:4,capability:null,canManage:true},{id:board,name:"Board",revision:2,capability:"view",canManage:false}]}
test("folder workspace selection saves one reviewed patch, reopens and removes it",async({page})=>{
 let state=structuredClone(workspaceState),writes=0
 await page.route("**/__fixture/folder-access",route=>{
  const cmd=route.request().postDataJSON()
  if(cmd.members){
   expect(cmd.revision).toBe(state.revision)
   expect(cmd.members).toEqual([{memberId:alice,capability:"edit"}])
   expect(cmd.workspaceChanges).toEqual([{canvasId:programs,revision:4,capability:writes===0?"edit":null}])
   state={...state,revision:state.revision+1,workspaces:state.workspaces!.map(w=>w.id===programs?{...w,capability:writes===0?"edit":null}:w)};writes++
  }
  return route.fulfill({json:{data:state}})
 })
 await page.goto("/?folder-access");await open(page)
 const section=page.getByRole("region",{name:"Workspace access"})
 await expect(section.getByRole("combobox")).toHaveCount(1)
 await expect(section.getByText("Board",{exact:true})).toBeVisible()
 await page.getByLabel("Folder access for Programs").selectOption("edit")
 await page.getByRole("button",{name:"Save access"}).click()
 await expect(page.getByRole("dialog")).toHaveCount(0)
 await open(page);await expect(page.getByLabel("Folder access for Programs")).toHaveValue("edit")
 await page.setViewportSize({width:390,height:700})
 const box=await page.getByRole("dialog").boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(390)
 await page.screenshot({path:".tmp/ch-hosted-staging-20261103/folder-workspaces-mobile.png",animations:"disabled"})
 await page.getByLabel("Folder access for Programs").selectOption("none")
 await page.getByRole("button",{name:"Save access"}).click()
 await open(page);await expect(page.getByLabel("Folder access for Programs")).toHaveValue("none")
 expect(writes).toBe(2)
})
test("workspace patch conflicts preserve draft; denied reload clears workspace names",async({page})=>{
 let conflict=false
 await page.route("**/__fixture/folder-access",route=>{
  const cmd=route.request().postDataJSON()
  if(cmd.members){conflict=true;return route.fulfill({json:{error:"Workspace access changed. Reload before saving.",code:"conflict"}})}
  return route.fulfill({json:conflict?{error:"Folder access is no longer available.",code:"denied"}:{data:workspaceState}})
 })
 await page.goto("/?folder-access");await open(page)
 await page.getByLabel("Folder access for Programs").selectOption("manage")
 await page.getByRole("button",{name:"Save access"}).click()
 await expect(page.getByLabel("Folder access for Programs")).toHaveValue("manage")
 await expect(page.getByRole("button",{name:"Save access"})).toBeDisabled()
 await page.getByRole("button",{name:"Reload access"}).click()
 await expect(page.getByRole("region",{name:"Workspace access"})).toHaveCount(0)
 await expect(page.getByText("Programs",{exact:true})).toHaveCount(0)
})
test("workspace-only dirty edits use the existing discard guard",async({page})=>{
 await page.route("**/__fixture/folder-access",route=>route.fulfill({json:{data:workspaceState}}))
 await page.goto("/?folder-access");await open(page)
 await page.getByLabel("Folder access for Programs").selectOption("view")
 await page.getByRole("button",{name:"Cancel",exact:true}).click()
 await expect(page.getByRole("alertdialog")).toBeVisible()
 await page.getByRole("button",{name:"Keep editing"}).click()
 await expect(page.getByLabel("Folder access for Programs")).toHaveValue("view")
})
