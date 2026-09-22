import { NextResponse } from "next/server"

import { env } from "@/lib/env"
import { createSupabaseServerClient } from "@/lib/supabase/server"

type ManagementAccessResult =
  | { ok: true }
  | { ok: false; response: NextResponse<{ message: string }> }

function getConfiguredProjectRef(): string | null {
  try {
    const hostname = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname
    const [projectRef] = hostname.split(".")
    return projectRef?.trim() || null
  } catch {
    return null
  }
}

export async function requireSupabaseManagementAccess(
  projectRef: string | null | undefined
): Promise<ManagementAccessResult> {
  if (!process.env.SUPABASE_MANAGEMENT_API_TOKEN) {
    console.error("Supabase Management API token is not configured.")
    return {
      ok: false,
      response: NextResponse.json({ message: "Server configuration error." }, { status: 500 }),
    }
  }

  if (!projectRef) {
    return {
      ok: false,
      response: NextResponse.json({ message: "projectRef is required." }, { status: 400 }),
    }
  }

  const expectedProjectRef = getConfiguredProjectRef()
  if (expectedProjectRef && projectRef !== expectedProjectRef) {
    return {
      ok: false,
      response: NextResponse.json(
        { message: "You do not have permission to access this project." },
        { status: 403 }
      ),
    }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ message: "Authentication required." }, { status: 401 }),
    }
  }

  let staff: { access_level: string | null } | null
  try {
    const { data, error } = await supabase
      .from("platform_staff_members")
      .select("access_level")
      .eq("user_id", user.id)
      .maybeSingle<{ access_level: string | null }>()

    if (error) throw error
    staff = data
  } catch (error) {
    console.error("[management-api-auth] Failed to verify developer access.", error)
    return {
      ok: false,
      response: NextResponse.json(
        { message: "Unable to verify access permissions." },
        { status: 500 }
      ),
    }
  }

  if (staff?.access_level !== "developer") {
    return {
      ok: false,
      response: NextResponse.json(
        { message: "You do not have permission to access this project." },
        { status: 403 }
      ),
    }
  }

  return { ok: true }
}
