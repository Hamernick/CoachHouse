"use server"
import { z } from "zod"
import { newObjectiveTargetSchema, type NewObjectiveTarget } from "./research-types"
import { loadResearchContext } from "./server/research-context"
import { listComposerContext, revalidateComposerContext } from "./server/composer-context"
import { composerContextReferencesSchema, type ComposerContextReference } from "@/lib/workspace/composer-context"

export async function listWorkspaceComposerContext(target: NewObjectiveTarget, query: string) {
  const scope = newObjectiveTargetSchema.parse(target)
  const search = z.string().max(160).parse(query)
  const context = await loadResearchContext(scope, false, { includeDataViewSources: false })
  return listComposerContext(context, search)
}

export async function revalidateWorkspaceComposerContext(target: NewObjectiveTarget, references: ComposerContextReference[]) {
  const scope = newObjectiveTargetSchema.parse(target)
  const refs = composerContextReferencesSchema.parse(references)
  const context = await loadResearchContext(scope, false, { includeDataViewSources: false })
  return revalidateComposerContext(context, refs)
}
