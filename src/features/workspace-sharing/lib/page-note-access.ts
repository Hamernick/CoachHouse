import { z } from "zod"
const target={pageId:z.uuid(),particleId:z.uuid()}
export const pageNoteCommandSchema=z.discriminatedUnion("action",[
 z.strictObject({action:z.literal("list"),pageId:z.uuid()}),
 z.strictObject({action:z.literal("read"),...target}),
 z.strictObject({action:z.literal("review_scope"),...target}),
 z.strictObject({action:z.literal("set_scope"),...target,operationId:z.uuid(),expectedPageRevision:z.int().positive(),expectedNoteRevision:z.int().positive().nullable(),enabled:z.boolean()}),
 z.strictObject({action:z.literal("write"),...target,operationId:z.uuid(),expectedNoteRevision:z.int().positive(),content:z.string().max(20000),html:z.string().max(120000).optional()}),
])
export const pageNoteDataSchema=z.strictObject({
 pageId:z.uuid(),pageRevision:z.int().positive(),canManage:z.boolean(),replayed:z.boolean(),
 notes:z.array(z.strictObject({id:z.uuid(),title:z.string().max(240),enabled:z.boolean(),revision:z.int().positive().nullable()})).max(50),
 note:z.strictObject({id:z.uuid(),title:z.string().max(240),revision:z.int().positive(),content:z.string().max(20000),html:z.string().max(120000).optional()}).nullable(),
})
export type PageNoteCommand=z.infer<typeof pageNoteCommandSchema>
export type PageNoteData=z.infer<typeof pageNoteDataSchema>
