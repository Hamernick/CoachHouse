import { z } from "zod"
import { dataViewCommandSchema, type DataViewCommand } from "./schema"
export const existingDataViewSourceSchema=z.discriminatedUnion("kind",[
 z.strictObject({kind:z.literal("table"),tableId:z.uuid()}),z.strictObject({kind:z.literal("responses"),versionId:z.uuid()}),
])
export const composableDataViewSchema=z.strictObject({viewId:z.uuid(),updatedAt:z.iso.datetime({offset:true}),name:z.string().max(100),source:existingDataViewSourceSchema,sourceTitle:z.string().max(240),canCreate:z.boolean()})
export type ComposableDataView=z.infer<typeof composableDataViewSchema>
const create=dataViewCommandSchema.options.find(command=>command.shape.action.value==="create_view")!
type ExistingCreate=Omit<Extract<DataViewCommand,{action:"create_view"}>,"source">&{source:z.infer<typeof existingDataViewSourceSchema>}
export const createExistingDataViewCommandSchema=create.extend({source:existingDataViewSourceSchema}) as z.ZodType<ExistingCreate>
