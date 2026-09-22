import "server-only"
import { getGoogleDriveFile } from "./google-api"
import { GoogleDriveError } from "../types"

const LIMIT = 15 * 1024 * 1024
const THUMBNAIL_LIMIT = 5 * 1024 * 1024

async function readBoundedResponse(response: Response, limit: number) {
  if (Number(response.headers.get("content-length")) > limit)
    throw new GoogleDriveError("invalid", 413)
  const reader = response.body?.getReader()
  if (!reader) throw new GoogleDriveError("provider_unavailable", 503)
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > limit) {
        await reader.cancel()
        throw new GoogleDriveError("invalid", 413)
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  return Buffer.concat(chunks)
}

export async function downloadGoogleDriveThumbnail(
  accessToken: string,
  fileId: string
) {
  const file = await getGoogleDriveFile(accessToken, fileId)
  if (file.status === "trashed" || !file.thumbnailLink)
    throw new GoogleDriveError("file_not_authorized", 403)
  const response = await fetch(file.thumbnailLink, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
    redirect: "error",
  })
  if (!response.ok) throw new GoogleDriveError("file_not_authorized", 403)
  const contentType = response.headers.get("content-type")?.split(";")[0]
  if (!contentType?.startsWith("image/"))
    throw new GoogleDriveError("provider_unavailable", 503)
  return {
    bytes: await readBoundedResponse(response, THUMBNAIL_LIMIT),
    contentType,
  }
}

export async function downloadGoogleDriveDocument(
  accessToken: string,
  fileId: string
) {
  const file = await getGoogleDriveFile(accessToken, fileId)
  if (file.status === "trashed")
    throw new GoogleDriveError("file_not_authorized", 403)
  const native = file.mimeType === "application/vnd.google-apps.document"
  if (!native && !/\.(docx?|md|markdown)$/i.test(file.name))
    throw new GoogleDriveError("invalid", 400)
  const url = new URL(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}${native ? "/export" : ""}`
  )
  if (native)
    url.searchParams.set(
      "mimeType",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
  else {
    url.searchParams.set("alt", "media")
    url.searchParams.set("supportsAllDrives", "true")
  }
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
    redirect: "error",
  })
  if (!response.ok) throw new GoogleDriveError("file_not_authorized", 403)
  return {
    name: native ? `${file.name}.docx` : file.name,
    bytes: await readBoundedResponse(response, LIMIT),
    sourceUrl: file.webViewLink,
  }
}
