import "server-only"
import { randomUUID } from "node:crypto"
import sharp from "sharp"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { MAX_PERSON_PHOTO_DATA_URL_LENGTH } from "./profile-photo"

/** Called only after the existing People edit authorization. Never overwrite an old photo before the contact save succeeds. */
export async function storePersonPhoto(image: string, orgId: string, actorId: string): Promise<string> {
  if (image.length > MAX_PERSON_PHOTO_DATA_URL_LENGTH) throw new Error("Choose a smaller profile photo.")
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image)
  if (!match) throw new Error("Choose a PNG, JPEG, or WebP photo.")
  const bytes = Buffer.from(match[2], "base64")
  const photo = sharp(bytes, { limitInputPixels: 40_000_000 })
  const metadata = await photo.metadata()
  if (!["png", "jpeg", "webp"].includes(metadata.format ?? "")) throw new Error("Unsupported profile photo.")
  const normalized = await photo.rotate().resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer()
  const path = `users/${orgId}/${randomUUID()}.webp`
  const { error } = await createSupabaseAdminClient({ actorId }).storage.from("avatars").upload(path, normalized, { contentType: "image/webp", upsert: false })
  if (error) throw new Error("The profile photo could not be uploaded. Please try again.")
  return path
}
