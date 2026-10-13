import { useState } from "react"
import type { RefObject } from "react"

import { serializeOnboardingAvatar } from "../avatar-draft"
import { getCroppedBlob } from "../helpers"

const CROP_RESET = { x: 0, y: 0 }

type SaveDraft = (extra?: Partial<{ avatar: string | null }>) => void

export function useOnboardingAvatar({
  initialAvatarUrl,
  formRef,
  saveDraft,
}: {
  initialAvatarUrl: string | null
  formRef: RefObject<HTMLFormElement | null>
  saveDraft: SaveDraft
}) {
  const [avatarPreview, setAvatarPreview] = useState<string | null>(initialAvatarUrl)
  const [rawImageUrl, setRawImageUrl] = useState<string | null>(null)
  const [cropOpen, setCropOpen] = useState(false)
  const [crop, setCrop] = useState(CROP_RESET)
  const [zoom, setZoom] = useState(1)
  const [croppedArea, setCroppedArea] = useState<{
    x: number
    y: number
    width: number
    height: number
  } | null>(null)

  const removeAvatar = () => {
    if (avatarPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(avatarPreview)
    }
    if (rawImageUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(rawImageUrl)
    }
    setAvatarPreview(null)
    setRawImageUrl(null)
    setCroppedArea(null)
    setCropOpen(false)
    setCrop(CROP_RESET)
    setZoom(1)

    const input = formRef.current?.querySelector(
      'input[name="avatar"]',
    ) as HTMLInputElement | null
    if (input) {
      input.value = ""
      try {
        const transfer = new DataTransfer()
        input.files = transfer.files
      } catch {
        // ignore
      }
    }

    saveDraft({ avatar: null })
  }

  const handleAvatarSelect = (file: File) => {
    const url = URL.createObjectURL(file)
    setRawImageUrl(url)
    setCrop(CROP_RESET)
    setZoom(1)
    setCroppedArea(null)
    setCropOpen(true)
  }

  const handleApplyCrop = async () => {
    if (rawImageUrl && croppedArea) {
      const blob = await getCroppedBlob(rawImageUrl, croppedArea)
      if (blob) {
        const url = await serializeOnboardingAvatar(blob)
        setAvatarPreview(url)
        saveDraft({ avatar: url })

        const file = new File([blob], "avatar.png", {
          type: blob.type || "image/png",
        })
        const input = formRef.current?.querySelector(
          'input[name="avatar"]',
        ) as HTMLInputElement | null
        if (input) {
          const transfer = new DataTransfer()
          transfer.items.add(file)
          input.files = transfer.files
        }
      }
    }
    setCropOpen(false)
  }

  return {
    avatarPreview,
    crop,
    cropOpen,
    handleApplyCrop,
    handleAvatarSelect,
    rawImageUrl,
    removeAvatar,
    setCrop,
    setCropOpen,
    setAvatarPreview,
    setCroppedArea,
    setZoom,
    zoom,
  }
}
