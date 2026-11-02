import { z } from "zod"
import { formDefinitionSchema } from "@/features/organization-forms"
import { particleSchema, particleGraphSchema, particleRevisionSchema } from "./particle-schema"
import { particleOperationSchema } from "./operation-schema"
import { particlePlanCommandSchema } from "./particle-plan-command"
import type { Particle } from "../types"

const sourceIdentity = {
  organizationId: z.uuid(), id: z.uuid(), revision: particleRevisionSchema,
}
export const workspaceNoteBindingSchema = z.strictObject({ kind: z.literal("workspace_note"), ...sourceIdentity })
export const workspaceFormBindingSchema = z.strictObject({ kind: z.literal("workspace_form"), ...sourceIdentity })
export const objectiveBindingSchema = z.strictObject({ kind: z.literal("objective"), ...sourceIdentity })
export const particleSourceBindingSchema = z.discriminatedUnion("kind", [objectiveBindingSchema, workspaceNoteBindingSchema, workspaceFormBindingSchema])
export type ParticleSourceBinding = z.infer<typeof particleSourceBindingSchema>

/** Existing graph writer receipt, not a second persistence format. */
export const particleCommitSchema = z.object({
  graph: particleGraphSchema,
  inverse: z.array(particleOperationSchema),
  replayed: z.boolean(),
})
export const workspaceNoteEditSchema = z.strictObject({
  source: workspaceNoteBindingSchema,
  body: z.strictObject({ content: z.string().max(20_000), html: z.string().max(120_000).optional() }),
})
export const workspaceNoteDetailSchema = z.object({ particle: particleSchema, revision: particleRevisionSchema })
export const workspaceFormEditSchema = z.strictObject({ source: workspaceFormBindingSchema, definition: formDefinitionSchema })

export type ParticleCapability = {
  id: "plan" | "workspace_note" | "workspace_form"
  label: string
  sourceKind: ParticleSourceBinding["kind"]
  views: readonly ("board" | "inspector" | "editor")[]
  action: "change_plan" | "edit_note" | "edit_form"
  editScope: "plan_membership" | "shared_content"
  permission: "organization_owner" | "workspace_edit"
  inputSchema: z.ZodType
  resultSchema: typeof particleCommitSchema
  sourceSchema: typeof objectiveBindingSchema | typeof workspaceNoteBindingSchema | typeof workspaceFormBindingSchema
  matches: (particle: Particle) => boolean
}

export const planCapability = {
  id: "plan", label: "Plan", sourceKind: "objective",
  views: ["board", "inspector", "editor"], action: "change_plan", editScope: "plan_membership",
  permission: "organization_owner", inputSchema: particlePlanCommandSchema, resultSchema: particleCommitSchema,
  sourceSchema: objectiveBindingSchema,
  matches: (particle: Particle) => particle.type === "objective",
} as const satisfies ParticleCapability

export const workspaceFormCapability = {
  id: "workspace_form", label: "Private form draft", sourceKind: "workspace_form",
  views: ["board", "inspector", "editor"], action: "edit_form", editScope: "shared_content",
  permission: "workspace_edit", inputSchema: workspaceFormEditSchema, resultSchema: particleCommitSchema,
  sourceSchema: workspaceFormBindingSchema,
  matches: (particle: Particle) => particle.type === "activity" && particle.data.widget?.kind === "form",
} as const satisfies ParticleCapability

export const workspaceNoteCapability = {
  id: "workspace_note", label: "Workspace note", sourceKind: "workspace_note",
  views: ["board", "editor"], action: "edit_note", editScope: "shared_content",
  permission: "workspace_edit", inputSchema: workspaceNoteEditSchema, resultSchema: particleCommitSchema,
  sourceSchema: workspaceNoteBindingSchema,
  matches: (particle: Particle) => particle.type === "activity" &&
    particle.data.widget?.kind === "notes" && particle.data.widget.source.kind === "workspace",
} as const satisfies ParticleCapability
