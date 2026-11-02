import { describe, expect, it } from "vitest"
import { createResearchItemParser } from "@/features/workspace-ai/lib/research-item-preview"

const item={key:"prepare",kind:"note",title:"Prepare",description:'Quoted "items": [{ braces } and Unicode 界',referenceId:null,evidenceIds:[],dependsOn:["later"]}
const document={title:"Plan",summary:"",questions:[],decisions:[],removeReferences:[],items:[item,{...item,key:"later"}]}
describe("bounded complete item framing",()=>{
 it.each([1,2,7,1024])("frames complete typed items across %i-character chunks",width=>{
  const parse=createResearchItemParser(),text=JSON.stringify(document),items=[]
  for(let i=0;i<text.length;i+=width) {
   const result=parse(text.slice(i,i+width));expect(result.invalid).toBe(false);items.push(...result.items)
  }
  expect(items).toEqual(document.items)
 })
 it("does not wait for the remaining array or invent incomplete values",()=>{
  const parse=createResearchItemParser()
  expect(parse('{"items":['+JSON.stringify(item).slice(0,-1)).items).toEqual([])
  expect(parse('},').items).toEqual([item])
  expect(parse('{"key":"later"').items).toEqual([])
 })
 it.each([
  {items:[{...item,title:""}]}, {items:[{...item,kind:"code"}]},
  {items:[{...item,arbitraryAction:"publish"}]}, {items:[item,item]},
  {items:Array.from({length:13},(_,i)=>({...item,key:`item${i}`}))},
 ])("disables invalid items without returning them: %j",value=>{
  const parse=createResearchItemParser()
  expect(parse(JSON.stringify(value))).toEqual({items:[],invalid:true})
  expect(parse(JSON.stringify(document))).toEqual({items:[],invalid:true})
 })
 it("bounds private buffered content even before an item is complete",()=>{
  const parse=createResearchItemParser()
  expect(parse('{"title":"'+'界'.repeat(11000))).toEqual({items:[],invalid:true})
 })
 it("does not mistake nested or quoted items for root items",()=>{
  const parse=createResearchItemParser()
  expect(parse(JSON.stringify({summary:'"items":[]',decisions:[{items:[item]}],items:[item]})).items).toEqual([item])
 })
})
