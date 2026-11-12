import { test, expect } from "@playwright/test"
const owner="99500000-0000-4000-8000-000000000001",alice="99500000-0000-4000-8000-000000000002"
const initial={name:"Finance",deleted:false,restricted:true,canManage:true,revision:1,members:[{id:owner,name:"Organization owner",owner:true,capability:"manage"},{id:alice,name:"Alice",owner:false,capability:"view"}]}
test("workspace access saves, reloads and returns focus; no activation control",async({page})=>{
 let state=structuredClone(initial),writes=0
 await page.route("**/__fixture/workspace-access",async route=>{
  const command=route.request().postDataJSON()
  if(command.members){writes++;expect(command.revision).toBe(state.revision);state={...state,revision:state.revision+1,members:state.members.map(member=>member.owner?member:{...member,capability:command.members.find((row:{memberId:string})=>row.memberId===member.id)?.capability??null})}}
  await route.fulfill({json:{data:state}})
 })
 await page.goto("/?workspace-access")
 await page.getByRole("button",{name:"Access",exact:true}).click()
 await expect(page.getByRole("dialog")).toBeVisible()
 await expect(page.getByRole("checkbox")).toHaveCount(0)
 await expect(page.getByRole("combobox")).toHaveCount(1)
 await page.getByRole("combobox",{name:"Access for Alice"}).selectOption("edit")
 await page.getByRole("button",{name:"Save access"}).click()
 await expect(page.getByRole("dialog")).toHaveCount(0)
 await expect(page.getByRole("button",{name:"Access",exact:true})).toBeFocused()
 expect(writes).toBe(1)
 await page.getByRole("button",{name:"Access",exact:true}).click()
 await expect(page.getByRole("combobox",{name:"Access for Alice"})).toHaveValue("edit")
 await page.getByRole("combobox").selectOption("none")
 await page.keyboard.press("Escape")
 await expect(page.getByRole("alertdialog")).toBeVisible()
 await page.getByRole("button",{name:"Keep editing"}).click()
 await expect(page.getByRole("combobox")).toHaveValue("none")
})
test("conflict preserves draft until reload; denial clears roster",async({page})=>{
 let read=0,denied=false
 await page.route("**/__fixture/workspace-access",route=>{
  const command=route.request().postDataJSON()
  if(command.members)return route.fulfill({json:{error:"Access changed. Reload before saving.",code:"conflict"}})
  read++;return route.fulfill({json:denied?{error:"Access unavailable",code:"denied"}:{data:initial}})
 })
 await page.goto("/?workspace-access")
 await page.getByRole("button",{name:"Access",exact:true}).click()
 await page.getByRole("combobox").selectOption("edit")
 await page.getByRole("button",{name:"Save access"}).click()
 await expect(page.getByRole("alert")).toContainText("Access changed")
 await expect(page.getByRole("combobox")).toHaveValue("edit")
 await expect(page.getByRole("button",{name:"Save access"})).toBeDisabled()
 denied=true
 await page.getByRole("button",{name:"Reload access"}).click()
 await expect(page.getByRole("alert")).toContainText("Access unavailable")
 await expect(page.getByRole("list",{name:"Workspace access"})).toHaveCount(0)
 expect(read).toBeGreaterThan(1)
})
test("inherited team review fits mobile, laptop and wide views without grant controls",async({page})=>{
 await page.route("**/__fixture/workspace-access",route=>route.fulfill({json:{data:{...initial,restricted:false,canManage:false}}}))
 await page.goto("/?workspace-access")
 await page.getByRole("button",{name:"Access",exact:true}).click()
 await expect(page.getByText("Access follows your organization’s team permissions.")).toBeVisible()
 await expect(page.getByRole("combobox")).toHaveCount(0)
 await expect(page.getByRole("button",{name:"Save access"})).toHaveCount(0)
 for(const width of [390,1100,2200]){
  await page.setViewportSize({width,height:850})
  const box=await page.getByRole("dialog").boundingBox()
  expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width)
  await expect(page.getByText("Organization owner",{exact:true})).toBeVisible()
  if(width===390||width===1100)await page.screenshot({path:`.tmp/ch-hosted-staging-20261103/workspace-access-${width}.png`})
 }
 await page.keyboard.press("Escape")
 await expect(page.getByRole("button",{name:"Access",exact:true})).toBeFocused()
})
test("deleted workspace disables increases and permits removal",async({page})=>{
 await page.route("**/__fixture/workspace-access",route=>route.fulfill({json:{data:{...initial,deleted:true,name:"Deleted workspace"}}}))
 await page.goto("/?workspace-access")
 await page.getByRole("button",{name:"Access",exact:true}).click()
 await expect(page.getByRole("option",{name:"Edit",exact:true})).toBeDisabled()
 await expect(page.getByRole("option",{name:"Manage",exact:true})).toBeDisabled()
 await page.getByRole("combobox").selectOption("none")
 await expect(page.getByRole("button",{name:"Save access"})).toBeEnabled()
})


test("viewer menu exposes access without organization editor actions",async({page})=>{
 await page.route("**/__fixture/workspace-access",route=>route.fulfill({json:{data:{...initial,restricted:false,canManage:false}}}))
 await page.goto("/?workspace-access")
 const trigger=page.getByRole("button",{name:"Options for Finance"})
 await trigger.focus();await page.keyboard.press("Enter")
 await expect(page.getByRole("menuitem")).toHaveCount(2)
 await page.getByRole("menuitem",{name:"Access",exact:true}).click()
 await expect(page.getByRole("dialog")).toContainText("Finance access")
 await page.evaluate(()=>{document.documentElement.classList.remove("light");document.documentElement.classList.add("dark")})
 await expect(page.getByRole("dialog")).toHaveCSS("--background", "oklch(0.145 0 0)")
 await page.screenshot({path:".tmp/ch-hosted-staging-20261103/workspace-access-dark.png",animations:"disabled"})
 await page.keyboard.press("Escape")
 await expect(trigger).toBeFocused()
})

test("network failures release loading and retain uncertain save for recovery",async({page})=>{
 let failRead=true
 await page.route("**/__fixture/workspace-access",route=>{
  if(failRead||route.request().postDataJSON().members)return route.abort("failed")
  return route.fulfill({json:{data:initial}})
 })
 await page.goto("/?workspace-access")
 await page.getByRole("button",{name:"Access",exact:true}).click()
 await expect(page.getByRole("alert")).toContainText("Unable to load access")
 failRead=false
 await page.getByRole("button",{name:"Reload access"}).click()
 await page.getByRole("combobox").selectOption("edit")
 await page.getByRole("button",{name:"Save access"}).click()
 await expect(page.getByRole("alert")).toContainText("Unable to confirm the save")
 await expect(page.getByRole("combobox")).toHaveValue("edit")
 await expect(page.getByRole("button",{name:"Save access"})).toBeDisabled()
 await expect(page.getByRole("button",{name:"Reload access"})).toBeEnabled()
 await page.getByRole("button",{name:"Reload access"}).click()
 await expect(page.getByRole("combobox")).toHaveValue("view")
})
