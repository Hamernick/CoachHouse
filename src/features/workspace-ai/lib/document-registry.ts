import type { AiDocumentApplication, AiDocumentProposal, AiDocumentTarget } from "../types"

export type AiDocumentBridge = {
  application?: AiDocumentApplication | null
  target: AiDocumentTarget
  dirty: boolean
  saving: boolean
  content: string
  apply: (proposal: AiDocumentProposal) => boolean
}
export type AiDocumentEditor = AiDocumentBridge & { id:string }
export type AiDocumentScope = Pick<AiDocumentTarget,"userId" | "organizationId">

// Mounted-editor references only. No persisted content or implicit active editor.
export function createAiDocumentRegistry() {
  const editors=new Map<string,AiDocumentEditor>()
  const listeners=new Set<()=>void>()
  let snapshot:readonly AiDocumentEditor[]=[]
  const emit=()=>{snapshot=[...editors.values()];listeners.forEach(listener=>listener())}
  return {
    snapshot:()=>snapshot,
    subscribe:(listener:()=>void)=>{listeners.add(listener);return ()=>{listeners.delete(listener)}},
    update:(id:string,bridge:AiDocumentBridge | null)=>{
      if (bridge) editors.set(id,{...bridge,id})
      else if (!editors.delete(id)) return
      emit()
    },
  }
}

export function availableAiDocumentEditors(editors:readonly AiDocumentEditor[],scope:AiDocumentScope) {
  return editors.filter(editor=>editor.target.userId===scope.userId && editor.target.organizationId===scope.organizationId)
}
export function selectedAiDocumentEditor(editors:readonly AiDocumentEditor[],id:string | null | undefined) {
  // undefined is the initial state: one visible document is unambiguous. null is
  // an explicit removal. A missing selected editor never falls back to another.
  return id === undefined ? (editors.length===1 ? editors[0] : null) : editors.find(editor=>editor.id===id) ?? null
}
