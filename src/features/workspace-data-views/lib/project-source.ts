import { z } from "zod"
import { dataColumnSchema, dataViewCommandSchema, type DataViewCommand } from "./schema"

/** Declared projects adapter fields. This metadata contains no rows or counts;
 * the canonical RPC rechecks project access and defines the actual query. */
export const PROJECT_DATA_VIEW_COLUMNS = z.array(dataColumnSchema).parse([
  { key: "title", label: "Project", type: "text", options: [], writable: false },
  { key: "status", label: "Status", type: "select", options: ["backlog", "planned", "active", "cancelled", "completed"], writable: true },
  { key: "start_date", label: "Starts", type: "date", options: [], writable: false },
  { key: "end_date", label: "Ends", type: "date", options: [], writable: false },
])
export const projectDataViewSourceSchema = z.strictObject({ kind: z.literal("projects") })
const createViewCommand = dataViewCommandSchema.options.find(command => command.shape.action.value === "create_view")!
type ProjectCreateCommand = Omit<Extract<DataViewCommand, { action: "create_view" }>, "source"> & { source: z.infer<typeof projectDataViewSourceSchema> }
export const createProjectDataViewCommandSchema = createViewCommand.extend({ source: projectDataViewSourceSchema }) as z.ZodType<ProjectCreateCommand>
export const dataViewCreateReceiptSchema = z.strictObject({ viewId: z.uuid(), revision: z.number().int().positive() })
