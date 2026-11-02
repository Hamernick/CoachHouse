"use server"

import type { PostgrestSingleResponse } from "@supabase/supabase-js"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { Json } from "@/lib/supabase"
import { dataViewCommandSchema, type DataViewResult } from "../lib/schema"

export async function runDataViewCommand(input: unknown): Promise<DataViewResult> {
  const parsed = dataViewCommandSchema.safeParse(input)
  if (!parsed.success) return { ok: false, code: "invalid", error: parsed.error.issues[0]?.message ?? "Check the view settings." }
  try {
  const client = await createSupabaseServerClient()
  const { data: auth, error: authError } = await client.auth.getUser()
  if (authError || !auth.user) return { ok: false, code: "denied", error: "Sign in to access this dataset." }
  // New RPC has a local typed boundary until generated Supabase types are refreshed.
  const rpc = client.rpc.bind(client) as unknown as (name: "workspace_data_view_command", args: { p_command: Json }) => { abortSignal: (signal: AbortSignal) => PromiseLike<PostgrestSingleResponse<Json>> }
    const { data, error } = await rpc("workspace_data_view_command", { p_command: parsed.data as Json }).abortSignal(AbortSignal.timeout(10_000))
    if (!error) return { ok: true, data }
    if (error.message.includes("Project source access required")) return { ok: false, code: "denied", error: "Projects access is required for this source. Choose a workspace table or manage your plan." }
    if (error.code === "42501") return { ok: false, code: "denied", error: "This dataset is unavailable or your access changed. Reopen the source after access is restored." }
    if (["40001", "23505", "55P03"].includes(error.code)) return { ok: false, code: "conflict", error: "The saved source or view changed. Review the latest values before saving again." }
    if (["22023", "22007", "22008", "23514"].includes(error.code)) return { ok: false, code: "invalid", error: "Check the columns, values and view settings. Nothing was changed." }
    return { ok: false, code: "unavailable", error: "Unable to confirm this request. Retry the same request to reconcile its result." }
  } catch {
    return { ok: false, code: "unavailable", error: "Unable to confirm this request. Retry the same request to reconcile its result." }
  }
}
