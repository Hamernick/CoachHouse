import "server-only"

import { notFound, redirect } from "next/navigation"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { formSourcePath } from "../lib/form-source-link"
import { formResponsePath } from "../lib/form-response-link"

/** No active-organization lookup: the response RPC authorizes this exact form. */
export async function requireFormResponseSession(versionId: string) {
  if (!z.uuid().safeParse(versionId).success) notFound()
  const session = await createSupabaseServerClient()
  const { data, error } = await session.auth.getUser()
  if (error || !data.user) redirect(`/login?redirect=${encodeURIComponent(formResponsePath(versionId))}`)
}

/** Exact draft target; no active organization or workspace membership required. */
export async function requireFormSourceSession(organizationId: string, formId: string) {
  if (!z.uuid().safeParse(organizationId).success || !z.uuid().safeParse(formId).success) notFound()
  const session = await createSupabaseServerClient()
  const { data, error } = await session.auth.getUser()
  if (error || !data.user) redirect(`/login?redirect=${encodeURIComponent(formSourcePath(organizationId, formId))}`)
}
