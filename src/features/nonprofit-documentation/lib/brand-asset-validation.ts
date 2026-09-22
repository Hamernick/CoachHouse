export const BRAND_ASSET_ACCEPT =
  "image/png,image/jpeg,image/webp,image/svg+xml"
const MAX_ASSET_BYTES = 12 * 1024 * 1024
export function brandAssetError(files: readonly Pick<File, "type" | "size">[]) {
  if (files.length !== 1) return "Choose one image for this tile."
  const file = files[0]
  if (!BRAND_ASSET_ACCEPT.split(",").includes(file.type))
    return "Choose a PNG, JPG, WebP, or SVG image."
  if (file.size === 0) return "This image is empty. Choose another file."
  if (file.size > MAX_ASSET_BYTES) return "Images must be 12 MB or smaller."
  return null
}
