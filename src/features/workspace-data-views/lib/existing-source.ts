import { z } from "zod"
import { googleSheetRangeSchema } from "@/features/google-drive/client"
import { dataViewCommandSchema, type DataViewCommand } from "./schema"
export const existingDataViewSourceSchema=z.discriminatedUnion("kind",[
 z.strictObject({kind:z.literal("table"),tableId:z.uuid()}),z.strictObject({kind:z.literal("responses"),versionId:z.uuid()}),
 z.strictObject({kind:z.literal("sheets"),range:googleSheetRangeSchema}),
])
export const composableDataViewSchema=z.strictObject({viewId:z.uuid(),updatedAt:z.iso.datetime({offset:true}),name:z.string().max(100),source:existingDataViewSourceSchema,sourceTitle:z.string().max(240),canCreate:z.boolean(),sheet:z.strictObject({headerHash:z.string().regex(/^[a-f0-9]{64}$/),executionIdentity:z.string().regex(/^[a-f0-9]{64}$/)}).optional()}).refine(value=>(value.source.kind==="sheets")===Boolean(value.sheet),"Sheet bindings require their verified execution identity.")
export type ComposableDataView=z.infer<typeof composableDataViewSchema>
const create=dataViewCommandSchema.options.find(command=>command.shape.action.value==="create_view")!
type ExistingCreate=Omit<Extract<DataViewCommand,{action:"create_view"}>,"source">&{source:z.infer<typeof existingDataViewSourceSchema>}
export const createExistingDataViewCommandSchema=create.extend({source:existingDataViewSourceSchema}) as z.ZodType<ExistingCreate>
