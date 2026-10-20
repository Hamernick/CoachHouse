import { getProjectAssetUploadId } from "@/lib/workspace/project-asset-upload-id"

type FiscalSponsorshipProjectAssetUploadResponse = {
  assets?: Array<{
    id?: unknown
    name?: unknown
  }>
  error?: unknown
}

function parseFiscalSponsorshipProjectAssetUploadResponse(
  value: FiscalSponsorshipProjectAssetUploadResponse
) {
  const asset = value.assets?.[0]
  const assetId = typeof asset?.id === "string" ? asset.id : ""
  const assetName = typeof asset?.name === "string" ? asset.name : ""
  const error = typeof value.error === "string" ? value.error : null

  return { assetId, assetName, error }
}

export async function uploadFiscalSponsorshipProjectAsset({
  description,
  file,
  projectId,
  title,
}: {
  description: string
  file: File
  projectId: string
  title: string
}) {
  const form = new FormData()
  form.append("uploadId", getProjectAssetUploadId({ projectId, files: [file], title, description }))
  form.append("projectId", projectId)
  form.append("title", title)
  form.append("description", description)
  form.append("files", file)

  const response = await fetch("/api/account/project-assets", {
    body: form,
    method: "POST",
  })
  const payload = (await response
    .json()
    .catch(() => ({}))) as FiscalSponsorshipProjectAssetUploadResponse
  const parsed = parseFiscalSponsorshipProjectAssetUploadResponse(payload)

  if (!response.ok) {
    throw new Error(parsed.error ?? "Unable to upload that file.")
  }

  if (!parsed.assetId) {
    throw new Error("Uploaded file did not return a project asset.")
  }

  return parsed
}
