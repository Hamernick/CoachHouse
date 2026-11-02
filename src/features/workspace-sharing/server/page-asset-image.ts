import "server-only"

import { createHash } from "node:crypto"
import sharp from "sharp"
import { MAX_BYTES } from "@/lib/organization/document-storage"
import { WorkspaceSharingError } from "./page-projection"

export const PUBLIC_IMAGE_INPUT_LIMIT = MAX_BYTES
export const PUBLIC_IMAGE_OUTPUT_LIMIT = 2 * 1024 * 1024
export const PUBLIC_IMAGE_PAGE_LIMIT = 8 * 1024 * 1024
export const PUBLIC_IMAGE_COUNT_LIMIT = 8

const formats = new Map([
  ["image/jpeg", "jpeg"], ["image/png", "png"],
  ["image/webp", "webp"], ["image/gif", "gif"],
])
export const supportsPublicImageMime = (mime: string) => formats.has(mime)

function hasRasterSignature(bytes: Buffer, mime: string) {
  switch (mime) {
    case "image/jpeg": return bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
    case "image/png": return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    case "image/webp": return bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP"
    case "image/gif": return ["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6))
    default: return false
  }
}

/** Internal immutable review bytes, not a URL, public grant or client DTO.
 * Never retain EXIF/GPS/XMP/ICC, active formats, or unreviewed animation frames.
 * Publication must bind these exact bytes to its own revision and audience.
 */
export async function preparePageImage(bytes: Buffer, mime: string) {
  // Reject SVG/other formats before invoking any native format parser. Magic
  // bytes are only admission; the full decoder must still validate the image.
  if (!bytes.length || bytes.length > PUBLIC_IMAGE_INPUT_LIMIT || !hasRasterSignature(bytes, mime))
    throw new WorkspaceSharingError("unsupported", "Choose a supported image within the upload limit.")
  try {
    const image = sharp(bytes, { limitInputPixels: 40_000_000, failOn: "warning" })
      .timeout({ seconds: 5 })
    const metadata = await image.metadata()
    if (metadata.format !== formats.get(mime) || !metadata.width || !metadata.height
      || metadata.width > 20_000 || metadata.height > 20_000 || (metadata.pages ?? 1) !== 1)
      throw new Error("Unsupported representation")
    const result = await image.autoOrient()
      .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 }).toBuffer({ resolveWithObject: true })
    if (!result.data.length || result.data.length > PUBLIC_IMAGE_OUTPUT_LIMIT)
      throw new Error("Representation exceeds limit")
    return {
      version: 1 as const, mimeType: "image/webp" as const,
      bytes: result.data, width: result.info.width, height: result.info.height,
      sha256: createHash("sha256").update(result.data).digest("hex"),
    }
  } catch {
    // Decoder details may contain private content; return one bounded message.
    throw new WorkspaceSharingError("unsupported", "This image cannot be shared yet. Use a static JPEG, PNG, WebP or GIF.")
  }
}

export type PreparedPageImage = Awaited<ReturnType<typeof preparePageImage>>
