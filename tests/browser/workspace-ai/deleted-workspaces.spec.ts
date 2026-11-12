import { expect, test, type Page } from "@playwright/test"
const canvas="99500000-0000-4000-8000-000000000010", other="99500000-0000-4000-8000-000000000011"
const owner="99500000-0000-4000-8000-000000000001",member="99500000-0000-4000-8000-000000000002"
async function open(page:Page) {
 await page.goto("/?workspace-access")
 await page.getByRole("button",{name:"Options for Finance"}).focus()
 await page.keyboard.press("Enter")
 await page.getByRole("menuitem",{name:"Deleted workspaces",exact:true}).click()
}
test("workspace options discover retained access, reduce it, reopen and return focus",async({page})=>{
 let capability:string|null="edit",revision=2,writes=0
 await page.route("**/__fixture/retained-access",route=>route.fulfill({json:{data:{items:[{canvasId:canvas}],nextAfter:null}}}))
 await page.route("**/__fixture/workspace-access",route=>{
  const command=route.request().postDataJSON();expect(command.canvasId).toBe(canvas)
  if(command.members){expect(command.revision).toBe(revision);capability=command.members.find((row:{memberId:string})=>row.memberId===member)?.capability??null;revision++;writes++}
  return route.fulfill({json:{data:{name:"Deleted workspace",deleted:true,restricted:true,canManage:true,revision,members:[{id:owner,name:"Owner",owner:true,capability:"manage"},...(capability?[{id:member,name:"Alice",owner:false,capability}]:[])]}}})
 })
 await open(page)
 const directory=page.getByRole("dialog",{name:"Deleted workspaces",exact:true})
 await directory.getByRole("button",{name:"Deleted workspace · 00000010",exact:true}).click()
 const access=page.getByRole("dialog",{name:"Deleted workspace access",exact:true})
 await expect(access.getByRole("option",{name:"Manage",exact:true})).toBeDisabled()
 await access.getByRole("combobox").selectOption("view")
 await access.getByRole("button",{name:"Save access",exact:true}).click()
 await expect(access).toHaveCount(0)
 await expect(directory.getByRole("button",{name:"Close",exact:true})).toBeFocused()
 await directory.getByRole("button",{name:"Deleted workspace · 00000010",exact:true}).click()
 await expect(access.getByRole("combobox")).toHaveValue("view")
 await access.getByRole("combobox").selectOption("none")
 await access.getByRole("button",{name:"Save access",exact:true}).click()
 expect(writes).toBe(2)
 await expect(access).toHaveCount(0)
 await directory.getByRole("button",{name:"Close",exact:true}).click()
 await expect(page.getByRole("button",{name:"Options for Finance"})).toBeFocused()
})
test("retained directory pages are bounded and a denied page clears prior entries",async({page})=>{
 let denied=false
 await page.route("**/__fixture/retained-access",route=>{
  const after=route.request().postDataJSON().after
  return route.fulfill({json:denied?{error:"You cannot review this access.",code:"denied"}:{data:after?{items:[{canvasId:other}],nextAfter:null}:{items:[{canvasId:canvas}],nextAfter:canvas}}})
 })
 await open(page)
 await page.getByRole("button",{name:"Next",exact:true}).click()
 await expect(page.getByRole("button",{name:"Deleted workspace · 00000011",exact:true})).toBeVisible()
 await expect(page.getByRole("button",{name:"Deleted workspace · 00000010",exact:true})).toHaveCount(0)
 denied=true
 await page.getByRole("button",{name:"First page",exact:true}).click()
 await expect(page.getByRole("alert")).toContainText("You cannot review")
 await expect(page.getByRole("list",{name:"Deleted workspaces",exact:true})).toHaveCount(0)
})
test("empty directory fits mobile and cannot restore or activate workspaces",async({page})=>{
 await page.setViewportSize({width:390,height:700})
 await page.route("**/__fixture/retained-access",route=>route.fulfill({json:{data:{items:[],nextAfter:null}}}))
 await open(page)
 await expect(page.getByText("No deleted workspaces with access to manage.")).toBeVisible()
 await expect(page.getByRole("checkbox")).toHaveCount(0)
 await expect(page.getByRole("button",{name:/restore|activate/i})).toHaveCount(0)
 const dialog=page.getByRole("dialog")
 const bounds=await dialog.boundingBox()
 expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(390)
 await page.screenshot({path:".tmp/ch-hosted-staging-20261103/retained-access-mobile.png"})
 await page.keyboard.press("Escape")
 await expect(page.getByRole("button",{name:"Options for Finance"})).toBeFocused()
})

test("retained access stays discoverable when no live workspace is visible",async({page})=>{
 await page.route("**/__fixture/retained-access",route=>route.fulfill({json:{data:{items:[{canvasId:canvas}],nextAfter:null}}}))
 await page.goto("/?workspace-access&empty-workspaces")
 await expect(page.getByText("No workspaces",{exact:true})).toBeVisible()
 const trigger=page.getByRole("button",{name:"Deleted workspaces",exact:true})
 await trigger.click()
 await expect(page.getByRole("dialog",{name:"Deleted workspaces",exact:true})).toBeVisible()
 await expect(page.getByRole("button",{name:"Deleted workspace · 00000010",exact:true})).toBeVisible()
 await page.keyboard.press("Escape")
 await expect(trigger).toBeFocused()
})
