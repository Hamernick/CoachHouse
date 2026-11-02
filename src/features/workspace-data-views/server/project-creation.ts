"use server"

import { z } from "zod"
import type { PostgrestSingleResponse } from "@supabase/supabase-js"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { Json } from "@/lib/supabase"
import { createProjectDataViewCommandSchema, dataViewCreateReceiptSchema } from "../lib/project-source"

const recoverySchema = z.strictObject({ receipt: dataViewCreateReceiptSchema.nullable(),
  view: z.strictObject({ id: z.uuid(), name: z.string().max(100), revision: z.number().int().positive() }).nullable() })
export async function readProjectDataViewCreation(input: unknown) {
  const command = createProjectDataViewCommandSchema.safeParse(input)
  if (!command.success) return { ok: false as const, code: "invalid" as const }
  try {
    const client = await createSupabaseServerClient()
    const { data: auth, error: authError } = await client.auth.getUser()
    if (authError || !auth.user) return { ok: false as const, code: "denied" as const }
    const rpc = client.rpc.bind(client) as unknown as (name: "read_project_data_view_creation", args: { p_command: Json }) => {
      abortSignal: (signal: AbortSignal) => PromiseLike<PostgrestSingleResponse<Json>>
    }
    const { data, error } = await rpc("read_project_data_view_creation", { p_command: command.data as Json }).abortSignal(AbortSignal.timeout(10_000))
    if (error) return { ok: false as const, code: error.code === "42501" ? "denied" as const : error.code === "40001" ? "conflict" as const : "unavailable" as const }
    const parsed = recoverySchema.parse(data)
    if ((parsed.receipt && parsed.receipt.viewId !== command.data.viewId) || (parsed.view && parsed.view.id !== command.data.viewId) || (parsed.view && !parsed.receipt))
      throw new Error("Invalid creation recovery")
    return { ok: true as const, data: parsed }
  } catch { return { ok: false as const, code: "unavailable" as const } }
}
