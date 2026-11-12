// Keep the encoded photo well below the Server Action's 1 MiB request limit.
export const MAX_PERSON_PHOTO_DATA_URL_LENGTH = 384 * 1024
export const MAX_PERSON_SAVE_BYTES = 768 * 1024
export const PERSON_PHOTO_TYPES = ["image/png", "image/jpeg", "image/webp"] as const

export async function preparePersonPhoto(file: File): Promise<string> {
  if (!(PERSON_PHOTO_TYPES as readonly string[]).includes(file.type))
    throw new Error("Choose a PNG, JPEG, or WebP photo.")
  if (file.size > 20 * 1024 * 1024)
    throw new Error("Choose a photo smaller than 20 MB.")
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40_000_000)
      throw new Error("Choose a photo smaller than 40 megapixels.")
    const canvas = document.createElement("canvas")
    for (const size of [512, 256]) {
      const scale = Math.min(1, size / Math.max(image.naturalWidth, image.naturalHeight))
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      const context = canvas.getContext("2d")
      if (!context) throw new Error("This photo could not be prepared. Try another photo.")
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      const result = canvas.toDataURL("image/webp", 0.82)
      if (result.startsWith("data:image/") && result.length <= MAX_PERSON_PHOTO_DATA_URL_LENGTH) return result
    }
    throw new Error("This photo is too large. Choose a smaller photo.")
  } finally { URL.revokeObjectURL(url) }
}
