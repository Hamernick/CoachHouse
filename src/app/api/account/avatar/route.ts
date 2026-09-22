import { revalidateTag } from "next/cache"
import { NextResponse, type NextRequest } from "next/server"

import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route"
import { supabaseErrorToError } from "@/lib/supabase/errors"
import {
  uploadAvatarWithUser,
  uploadAvatarAdmin,
  resolveAvatarCleanupPath,
  AVATARS_BUCKET,
} from "@/lib/storage/avatars"

export async function POST(request: NextRequest) {
  const debugToken = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const response = NextResponse.next()
  const supabase = createSupabaseRouteHandlerClient(request, response)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    return NextResponse.json(
      { error: error?.message ?? "Unauthorized" },
      { status: 401 }
    )
  }

  const form = await request.formData()
  const file = form.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 })
  }
  const MAX_BYTES = 5 * 1024 * 1024
  const allowed = new Set([
    "image/png",
    "image/jpeg",
    "image/webp",
  ]) as Set<string>
  if (!allowed.has(file.type)) {
    return NextResponse.json(
      { error: "Unsupported image type. Use PNG, JPEG, or WebP." },
      { status: 400 }
    )
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Image too large. Max size is 5 MB." },
      { status: 400 }
    )
  }

  let previousAvatarUrl: string | null = null
  try {
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .maybeSingle<{ avatar_url: string | null }>()
    previousAvatarUrl = profileRow?.avatar_url ?? null
  } catch {
    previousAvatarUrl = null
  }

  const persistAvatar = async (avatarUrl: string) => {
    const { error: upsertError } = await supabase
      .from("profiles")
      .upsert({ id: user.id, avatar_url: avatarUrl }, { onConflict: "id" })

    if (upsertError) {
      console.warn("Avatar profile save (user client) failed", {
        debugToken,
        userId: user.id,
        message: upsertError.message,
      })

      try {
        const admin = createSupabaseAdminClient()
        const { error: adminUpsertError } = await admin
          .from("profiles")
          .upsert({ id: user.id, avatar_url: avatarUrl }, { onConflict: "id" })
        if (adminUpsertError) {
          throw supabaseErrorToError(
            adminUpsertError,
            "Unable to save profile photo."
          )
        }
      } catch (adminPersistError: unknown) {
        const adminPersistMessage =
          adminPersistError instanceof Error
            ? adminPersistError.message
            : "unknown_error"
        throw new Error(
          `Unable to save profile photo. User policy save failed (${upsertError.message}). Admin fallback failed (${adminPersistMessage}).`
        )
      }
    }

    revalidateTag("public-profiles", { expire: 0 })
    const cleanupPath = resolveAvatarCleanupPath({
      previousUrl: previousAvatarUrl,
      nextUrl: avatarUrl,
      userId: user.id,
    })
    if (cleanupPath) {
      await supabase.storage.from(AVATARS_BUCKET).remove([cleanupPath])
    }
    return avatarUrl
  }

  try {
    // Prefer user-credentialed upload (bucket has RLS for own folder)
    const avatarUrl = await uploadAvatarWithUser({
      client: supabase,
      userId: user.id,
      file,
    })
    const saved = await persistAvatar(avatarUrl)
    return NextResponse.json({ avatarUrl: saved }, { status: 200 })
  } catch (userUploadError: unknown) {
    console.warn("Avatar upload (user client) failed", {
      debugToken,
      userId: user.id,
      bucket: AVATARS_BUCKET,
      message:
        userUploadError instanceof Error
          ? userUploadError.message
          : "unknown_error",
    })
    // Fallback to admin upload if available (e.g., server role configured)
    try {
      const avatarUrl = await uploadAvatarAdmin({ userId: user.id, file })
      const saved = await persistAvatar(avatarUrl)
      return NextResponse.json({ avatarUrl: saved }, { status: 200 })
    } catch (adminError: unknown) {
      const adminMsg =
        adminError instanceof Error ? adminError.message : undefined
      const userMsg =
        userUploadError instanceof Error ? userUploadError.message : undefined
      console.error("Avatar upload failed", {
        debugToken,
        userId: user.id,
        bucket: AVATARS_BUCKET,
        previousAvatarUrl,
        userUploadMessage: userMsg ?? "unknown_error",
        adminUploadMessage: adminMsg ?? "unknown_error",
      })
      return NextResponse.json(
        {
          error: adminMsg ?? userMsg ?? "Upload failed",
          debugToken,
        },
        { status: 500 }
      )
    }
  }
}
