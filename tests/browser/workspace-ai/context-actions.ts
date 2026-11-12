import type { NewObjectiveTarget } from "../../../src/features/workspace-ai/research-types"
import type { ComposerContextReference } from "../../../src/lib/workspace/composer-context"
export async function revalidateWorkspaceComposerContext(target: NewObjectiveTarget, references: ComposerContextReference[]) {
  const response = await fetch("/__fixture/composer-context-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target, references }) })
  if (!response.ok) throw new Error("Context unavailable")
  return response.json()
}
export async function listWorkspaceComposerContext(target: NewObjectiveTarget, query: string) {
  const response=await fetch("/__fixture/composer-context",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({target,query})})
  if(!response.ok)throw new Error("Context unavailable")
  return response.json()
}
