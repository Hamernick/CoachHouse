import { afterEach,describe,expect,it,vi } from "vitest"
import { applyRoadmapAiProposal } from "@/components/roadmap/roadmap-editor/ai-proposal"
import { createDraft,loadRoadmapDraftsFromStorage,persistRoadmapDraftsToStorage } from "@/components/roadmap/roadmap-editor/helpers"
import { resolveRoadmapSections } from "@/lib/roadmap"
import { acknowledgeRoadmapDraftSave } from "@/components/roadmap/roadmap-editor/save-acknowledgment"

function fixture() {
  const section=resolveRoadmapSections({})[0]
  const draft=createDraft(section)
  const sourceScope={organizationId:"org-a",userId:"actor"}
  const proposal={id:"run",target:{...sourceScope,sectionId:section.id,title:section.title,revision:section.lastUpdated},
    original:draft.content,content:"<p>A reviewed draft</p>",status:"succeeded",credits:10,maxCredits:100}
  return {proposal,sourceScope,canEdit:true,busy:false,sectionsRef:{current:[section]},draftsRef:{current:{[section.id]:draft}},
    activeIdRef:{current:section.id},setDrafts:vi.fn()}
}
afterEach(() => vi.unstubAllGlobals())
describe("AI draft application into the existing core editor",() => {
  it("changes the editor draft only and marks it for a private save",() => {
    const input=fixture()
    expect(applyRoadmapAiProposal(input)).toBe(true)
    expect(input.draftsRef.current[input.activeIdRef.current].content).toBe(input.proposal.content)
    expect(input.sectionsRef.current[0].content).not.toBe(input.proposal.content)
    expect(input.draftsRef.current[input.activeIdRef.current].requiresPrivateSave).toBe(true)
  })
  it("preserves newer local edits and refuses a repeated application",() => {
    const input=fixture()
    input.draftsRef.current[input.activeIdRef.current].content="<p>My unsaved edit</p>"
    expect(applyRoadmapAiProposal(input)).toBe(false)
    expect(input.setDrafts).not.toHaveBeenCalled()
    const clean=fixture()
    expect(applyRoadmapAiProposal(clean)).toBe(true)
    expect(applyRoadmapAiProposal(clean)).toBe(false)
  })
  it("rejects changed organization, revision, permission and in-flight saves",() => {
    for (const modify of [
      (i:ReturnType<typeof fixture>)=>{i.sourceScope.organizationId="org-b"},
      (i:ReturnType<typeof fixture>)=>{i.sectionsRef.current[0].lastUpdated="newer"},
      (i:ReturnType<typeof fixture>)=>{i.canEdit=false},
      (i:ReturnType<typeof fixture>)=>{i.busy=true},
    ]) { const input=fixture(); modify(input); expect(applyRoadmapAiProposal(input)).toBe(false);expect(input.setDrafts).not.toHaveBeenCalled() }
  })
  it("retains draft content and private-save intent across reload before saving",() => {
    const values=new Map<string,string>()
    vi.stubGlobal("window",{localStorage:{getItem:(key:string)=>values.get(key) ?? null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)}})
    const input=fixture()
    applyRoadmapAiProposal(input)
    persistRoadmapDraftsToStorage({storageKey:"test-org",sections:input.sectionsRef.current,drafts:input.draftsRef.current})
    const restored=loadRoadmapDraftsFromStorage("test-org",input.sectionsRef.current)[input.activeIdRef.current]
    expect(restored.content).toBe(input.proposal.content)
    expect(restored.requiresPrivateSave).toBe(true)
    expect(restored.aiRunId).toBe(input.proposal.id)
    expect(loadRoadmapDraftsFromStorage("another-org",input.sectionsRef.current)[input.activeIdRef.current].content).not.toBe(input.proposal.content)
  })
  it("uses a canonical save acknowledgment without losing typing during the request",()=>{
    const input=fixture();applyRoadmapAiProposal(input)
    const submitted=input.draftsRef.current[input.activeIdRef.current]
    const current={...submitted,content:"<p>Typed while saving</p>"}
    const saved={...input.sectionsRef.current[0],content:submitted.content,lastUpdated:"2026-10-22T13:00:00Z",isPublic:false}
    const retained=acknowledgeRoadmapDraftSave(current,submitted,saved)
    expect(retained.content).toBe(current.content)
    expect(retained.aiRunId).toBeUndefined()
    expect(retained.requiresPrivateSave).toBe(false)
    expect(acknowledgeRoadmapDraftSave(submitted,submitted,saved).content).toBe(saved.content)
  })
  it("preserves edits made after a lost save response and clears the recovered application ID",()=>{
    const input=fixture();applyRoadmapAiProposal(input)
    const draft={...input.draftsRef.current[input.activeIdRef.current],content:"<p>Further changes</p>"}
    const saved={...input.sectionsRef.current[0],content:input.proposal.content,lastUpdated:"2026-10-22T13:00:00Z",isPublic:false}
    const retained=acknowledgeRoadmapDraftSave(draft,draft,saved,true)
    expect(retained.content).toBe(draft.content)
    expect(retained.aiRunId).toBeUndefined()
    expect(retained.lastUpdated).toBe(saved.lastUpdated)
  })
  it("retains an AI recovery draft when the server acknowledgment arrives after local persistence",()=>{
    const values=new Map<string,string>()
    vi.stubGlobal("window",{localStorage:{getItem:(key:string)=>values.get(key) ?? null,setItem:(key:string,value:string)=>values.set(key,value)}})
    const input=fixture();applyRoadmapAiProposal(input)
    persistRoadmapDraftsToStorage({storageKey:"test-org",sections:input.sectionsRef.current,drafts:input.draftsRef.current})
    const server=[{...input.sectionsRef.current[0],content:"<p>Server version</p>",lastUpdated:"2099-01-01T00:00:00Z"}]
    const restored=loadRoadmapDraftsFromStorage("test-org",server)[input.activeIdRef.current]
    expect(restored.content).toBe(input.proposal.content)
    expect(restored.aiRunId).toBe(input.proposal.id)
  })
  it("preserves an ordinary unsaved draft and its original baseline across a newer server revision",()=>{
    const values=new Map<string,string>()
    vi.stubGlobal("window",{localStorage:{getItem:(key:string)=>values.get(key) ?? null,setItem:(key:string,value:string)=>values.set(key,value)}})
    const input=fixture()
    const draft=input.draftsRef.current[input.activeIdRef.current]
    draft.content="<p>My unsaved work</p>"
    persistRoadmapDraftsToStorage({storageKey:"test-org",sections:input.sectionsRef.current,drafts:input.draftsRef.current})
    const restored=loadRoadmapDraftsFromStorage("test-org",[{...input.sectionsRef.current[0],content:"<p>Collaborator</p>",lastUpdated:"2099-01-01T00:00:00Z"}])[draft.id]
    expect(restored.content).toBe(draft.content)
    expect(restored.lastUpdated).toBe(draft.lastUpdated)
  })

})
