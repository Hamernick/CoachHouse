import { z } from "zod"
import { createProjectDataViewCommandSchema, dataViewCreateReceiptSchema, projectDataViewSourceSchema } from "@/features/workspace-data-views"

/** Creation is separate from binding an existing particle: the source owner
 * creates the saved view and returns its first revision. No rows are copied. */
export const projectDataViewCapability = {
  id: "project_data_view", label: "Projects data view", sourceKind: "projects",
  views: ["board", "editor"], action: "create_project_view", editScope: "view_configuration",
  permission: "workspace_and_project_access", inputSchema: createProjectDataViewCommandSchema,
  sourceSchema: projectDataViewSourceSchema.extend({ organizationId: z.uuid() }),
  resultSchema: dataViewCreateReceiptSchema,
} as const
