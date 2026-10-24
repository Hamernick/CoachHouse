import {beforeEach,describe,it,expect,vi} from "vitest"
const mocks=vi.hoisted(()=>({load:vi.fn(),file:vi.fn()}))
vi.mock("@/features/workspace-ai/server/knowledge-records",()=>({knowledgeLoader:()=>mocks.load}))
vi.mock("@/features/workspace-ai/server/knowledge-file",()=>({readKnowledgeFile:mocks.file}))
import {createKnowledgeTools} from "@/features/workspace-ai/server/knowledge-tools"
import type {ResearchContext} from "@/features/workspace-ai/server/research-context"
const record={id:"person:known",kind:"person",title:"Marketing director",content:"Owns the marketing plan",href:"/workspace",revision:"current",contentAvailable:true}
beforeEach(()=>{vi.clearAllMocks();mocks.load.mockResolvedValue([record]);mocks.file.mockImplementation(async(_context,value)=>value)})
describe("workspace knowledge tools",()=>{
 it("caches repeated searches only inside one run and reads only discovered IDs",async()=>{
  const tools=createKnowledgeTools({} as ResearchContext)
  await tools.execute("search_workspace",{query:"marketing",kinds:["person"]})
  await tools.execute("search_workspace",{query:"marketing",kinds:["person"]})
  expect(mocks.load).toHaveBeenCalledTimes(1)
  expect(await tools.execute("read_workspace",{ids:["person:other"]})).toEqual({results:[{id:"person:other",error:"Search for this record first."}]})
  expect(mocks.file).not.toHaveBeenCalled()
  await tools.execute("read_workspace",{ids:[record.id]})
  expect(mocks.file).toHaveBeenCalledTimes(1)
  expect(tools.sources.get(record.id)?.revision).toBe("current")
  await createKnowledgeTools({} as ResearchContext).execute("search_workspace",{query:"marketing",kinds:["person"]})
  expect(mocks.load).toHaveBeenCalledTimes(2)
 })
 it("keeps failures explicit without discarding accessible sources",async()=>{
  mocks.load.mockImplementation(async kind=>{if(kind==="document")throw Error("denied");return [record]})
  const value=await createKnowledgeTools({} as ResearchContext).execute("search_workspace",{query:"marketing",kinds:["person","document"]})
  expect(value).toMatchObject({results:[{id:record.id}],unavailableKinds:["document"]})
 })
 it("rejects arbitrary tools and overlarge retrieval requests",async()=>{
  const tools=createKnowledgeTools({} as ResearchContext)
  await expect(tools.execute("send_email",{})).rejects.toThrow(/not available/)
  await expect(tools.execute("read_workspace",{ids:["a","b","c","d","e"]})).rejects.toThrow()
 })
})
