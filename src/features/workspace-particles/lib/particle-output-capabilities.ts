import { z } from "zod"
import { createProjectDataViewCommandSchema, createExistingDataViewCommandSchema, existingDataViewSourceSchema, dataViewCreateReceiptSchema, projectDataViewSourceSchema } from "@/features/workspace-data-views"

/** Creation is separate from binding an existing particle: the source owner
 * creates the saved view and returns its first revision. No rows are copied. */
export const projectDataViewCapability = {
  id: "project_data_view", label: "Projects data view", sourceKind: "projects",
  views: ["board", "editor"], action: "create_project_view", editScope: "view_configuration",
  permission: "workspace_and_project_access", inputSchema: createProjectDataViewCommandSchema,
  sourceSchema: projectDataViewSourceSchema.extend({ organizationId: z.uuid() }),
  resultSchema: dataViewCreateReceiptSchema,
} as const

export const existingDataViewCapability = {
  id: "existing_data_view", label: "Existing source data view", sourceKind: "existing_data_view",
  views: ["board", "editor"], action: "create_existing_view", editScope: "view_configuration",
  permission: "current_manual_source_creation_access", inputSchema: createExistingDataViewCommandSchema,
  sourceSchema:z.strictObject({organizationId:z.uuid(),source:existingDataViewSourceSchema}),
  resultSchema:dataViewCreateReceiptSchema,
} as const
