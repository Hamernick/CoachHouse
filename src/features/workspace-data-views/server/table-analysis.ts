import "server-only"
import { readSheetAnalysisSnapshot } from "./sheet-analysis"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { z } from "zod"
import type { PostgrestSingleResponse } from "@supabase/supabase-js"
import type { Json } from "@/lib/supabase"
import { tableAnalysisSnapshotSchema } from "../lib/table-analysis"

/** Verified actor first. Native RPC and linked-Sheet RPC each enforce their own source authority. */
export async function readTableAnalysisSnapshot(organizationId: string, viewId: string, actorId: string, signal?: AbortSignal) {
  z.uuid().parse(organizationId); z.uuid().parse(viewId); z.uuid().parse(actorId)
  signal?.throwIfAborted()
  const client = await createSupabaseServerClient(), { data, error } = await client.auth.getUser()
  if (error || data.user?.id !== actorId) throw Error("Table unavailable")
  const rpc = client.rpc.bind(client) as unknown as (name: "read_workspace_table_analysis", args: { p_org: string; p_view: string }) => { abortSignal(signal: AbortSignal): PromiseLike<PostgrestSingleResponse<Json>> }
  const reply = await rpc("read_workspace_table_analysis", { p_org: organizationId, p_view: viewId })
    .abortSignal(signal ? AbortSignal.any([signal,AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000))
  signal?.throwIfAborted()
  if (reply.error?.code === "42501") return readSheetAnalysisSnapshot(organizationId,viewId,actorId,signal)
  if (reply.error || !reply.data || Buffer.byteLength(JSON.stringify(reply.data)) > 1_000_000) throw Error("Table unavailable")
  const snapshot = tableAnalysisSnapshotSchema.parse(reply.data)
  if (snapshot.view.id !== viewId) throw Error("Table unavailable")
  return snapshot
}
