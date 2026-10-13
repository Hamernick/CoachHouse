const AVATAR_DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([a-zA-Z0-9+/=]+)$/

export async function serializeOnboardingAvatar(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  // Cropped avatars are capped at 512px; chunk to avoid an argument-limit error.
  let binary = ""
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
  }
  return `data:${blob.type};base64,${btoa(binary)}`
}

export function restoreOnboardingAvatar(form: HTMLFormElement, value: string) {
  if (value.length > 2_000_000) return false
  const match = value.match(AVATAR_DATA_URL)
  if (!match) return false
  try {
    const input = form.querySelector<HTMLInputElement>('input[name="avatar"]')
    if (!input) return false
    const bytes = Uint8Array.from(atob(match[2]), (character) => character.charCodeAt(0))
    const transfer = new DataTransfer()
    transfer.items.add(new File([bytes], "avatar.png", { type: match[1] }))
    input.files = transfer.files
    return true
  } catch { return false }
}
