"use client"

import { useEffect, useId, useState, type ReactNode } from "react"
import ImageIcon from "lucide-react/dist/esm/icons/image"
import { toast } from "@/lib/toast"

import { GridPattern } from "@/components/ui/shadcn-io/grid-pattern/index"
import Image from "next/image"
import { cn } from "@/lib/utils"
import {
  uploadOrgMedia,
  validateOrgMediaFile,
} from "@/lib/organization/org-media"
import { ORG_BANNER_ASPECT_RATIO } from "@/lib/organization/banner-spec"
import {
  getOrganizationFocusTargetProps,
  ORGANIZATION_FOCUS_TARGET_CLASSNAME,
} from "./organization-deep-link-focus"

import {
  type CropArea,
  getCroppedBannerBlob,
  loadImageDimensions,
  validateBannerCropDimensions,
  validateBannerImageDimensions,
} from "./banner-image-utils"
import { OrgProfileBannerCropDialog } from "./org-profile-banner-crop-dialog"
import {
  OrgProfileHeaderBannerControls,
  OrgProfileHeaderLogoControls,
} from "./header-controls"

type OrgProfileHeaderProps = {
  name: string
  tagline: string
  logoUrl: string
  headerUrl: string
  editMode: boolean
  isSaving: boolean
  canEdit: boolean
  links?: ReactNode
  donationAction?: ReactNode
  onLogoChange: (url: string | null) => Promise<void>
  onHeaderChange: (url: string | null) => Promise<void>
}

const headerSquares: Array<[number, number]> = [
  [4, 4],
  [5, 1],
  [8, 2],
  [5, 3],
  [5, 5],
  [10, 10],
  [12, 15],
  [15, 10],
  [10, 15],
  [15, 10],
  [10, 15],
  [15, 10],
]

export function OrgProfileHeader({
  name,
  tagline,
  logoUrl,
  headerUrl,
  editMode,
  isSaving,
  canEdit,
  links,
  donationAction,
  onLogoChange,
  onHeaderChange,
}: OrgProfileHeaderProps) {
  const logoInputId = useId()
  const headerInputId = useId()
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [isUploadingHeader, setIsUploadingHeader] = useState(false)
  const [isRemovingLogo, setIsRemovingLogo] = useState(false)
  const [isRemovingHeader, setIsRemovingHeader] = useState(false)
  const [bannerCropOpen, setBannerCropOpen] = useState(false)
  const [bannerCrop, setBannerCrop] = useState({ x: 0, y: 0 })
  const [bannerZoom, setBannerZoom] = useState(1)
  const [bannerCroppedArea, setBannerCroppedArea] = useState<CropArea | null>(
    null
  )
  const [bannerRawImageUrl, setBannerRawImageUrl] = useState<string | null>(
    null
  )

  const revokeIfObjectUrl = (url: string | null) => {
    if (!url?.startsWith("blob:")) return
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    return () => {
      revokeIfObjectUrl(bannerRawImageUrl)
    }
  }, [bannerRawImageUrl])

  const resetBannerCropState = () => {
    setBannerCrop({ x: 0, y: 0 })
    setBannerZoom(1)
    setBannerCroppedArea(null)
  }

  const setBannerDraftImageUrl = (nextUrl: string | null) => {
    setBannerRawImageUrl((previous) => {
      if (previous && previous !== nextUrl) {
        revokeIfObjectUrl(previous)
      }
      return nextUrl
    })
  }

  const handleBannerCropOpenChange = (nextOpen: boolean) => {
    setBannerCropOpen(nextOpen)
    if (nextOpen) return
    resetBannerCropState()
    setBannerDraftImageUrl(null)
  }

  const handleUpload = async (
    file: File,
    kind: "logo" | "header"
  ): Promise<boolean> => {
    const error = validateOrgMediaFile(file)
    if (error) {
      toast.error(error)
      return false
    }

    const setUploading =
      kind === "logo" ? setIsUploadingLogo : setIsUploadingHeader
    setUploading(true)
    const toastId = toast.loading("Uploading image…")
    try {
      const url = await uploadOrgMedia({ file, kind })
      if (kind === "logo") {
        await onLogoChange(url)
      } else {
        await onHeaderChange(url)
      }
      toast.success("Image saved", { id: toastId })
      return true
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Upload failed", {
        id: toastId,
      })
      return false
    } finally {
      setUploading(false)
    }
  }

  const handleStartBannerUpload = async (file: File) => {
    const fileError = validateOrgMediaFile(file)
    if (fileError) {
      toast.error(fileError)
      return
    }

    const objectUrl = URL.createObjectURL(file)
    try {
      const dimensions = await loadImageDimensions(objectUrl)
      const dimensionError = validateBannerImageDimensions(dimensions)
      if (dimensionError) {
        toast.error(dimensionError)
        URL.revokeObjectURL(objectUrl)
        return
      }

      resetBannerCropState()
      setBannerDraftImageUrl(objectUrl)
      setBannerCropOpen(true)
    } catch {
      URL.revokeObjectURL(objectUrl)
      toast.error("Unable to read image. Try a different banner file.")
    }
  }

  const handleAdjustExistingBanner = async () => {
    if (!headerUrl) return
    try {
      const dimensions = await loadImageDimensions(headerUrl)
      const dimensionError = validateBannerImageDimensions(dimensions)
      if (dimensionError) {
        toast.error(dimensionError)
        return
      }

      resetBannerCropState()
      setBannerDraftImageUrl(headerUrl)
      setBannerCropOpen(true)
    } catch {
      toast.error("Unable to load the current banner. Try uploading it again.")
    }
  }

  const handleApplyBannerCrop = async () => {
    if (!bannerRawImageUrl || !bannerCroppedArea) {
      toast.error("Select a banner crop before applying.")
      return
    }
    const cropValidationError = validateBannerCropDimensions(bannerCroppedArea)
    if (cropValidationError) return void toast.error(cropValidationError)

    const croppedBlob = await getCroppedBannerBlob(
      bannerRawImageUrl,
      bannerCroppedArea
    )
    if (!croppedBlob) {
      toast.error("Failed to crop banner image.")
      return
    }

    const bannerFile = new File(
      [croppedBlob],
      `organization-banner-${Date.now()}.webp`,
      {
        type: "image/webp",
      }
    )
    const uploaded = await handleUpload(bannerFile, "header")
    if (!uploaded) return
    handleBannerCropOpenChange(false)
  }

  const handleRemove = async (kind: "logo" | "header") => {
    const setRemoving =
      kind === "logo" ? setIsRemovingLogo : setIsRemovingHeader
    setRemoving(true)
    const toastId = toast.loading("Removing image…")
    try {
      if (kind === "logo") {
        await onLogoChange(null)
      } else {
        await onHeaderChange(null)
      }
      toast.success("Image removed", { id: toastId })
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Remove failed", {
        id: toastId,
      })
    } finally {
      setRemoving(false)
    }
  }

  const logoBusy = isUploadingLogo || isRemovingLogo || isSaving
  const headerBusy = isUploadingHeader || isRemovingHeader || isSaving
  const hasLogo = Boolean(logoUrl),
    hasHeader = Boolean(headerUrl)

  return (
    <>
      <div
        className="border-border/60 bg-background relative w-full overflow-hidden border-b"
        style={{ aspectRatio: ORG_BANNER_ASPECT_RATIO }}
      >
        {headerUrl ? (
          <Image
            src={headerUrl}
            alt=""
            fill
            className="object-cover object-center"
            sizes="(max-width: 1024px) 100vw, 1024px"
            loading="eager"
          />
        ) : null}
        {!headerUrl ? (
          <>
            <div className="from-background/5 via-background/10 to-background/40 absolute inset-0 bg-gradient-to-b" />
            <GridPattern
              patternId="org-profile-header-pattern"
              squares={headerSquares}
              className={cn(
                "inset-x-0 inset-y-[-30%] h-[200%] skew-y-12 [mask-image:radial-gradient(320px_circle_at_center,white,transparent)] opacity-70"
              )}
            />
          </>
        ) : null}
        <OrgProfileHeaderBannerControls
          canEdit={canEdit}
          editMode={editMode}
          headerInputId={headerInputId}
          headerBusy={headerBusy}
          hasHeader={hasHeader}
          isUploadingHeader={isUploadingHeader}
          onStartBannerUpload={(file) => void handleStartBannerUpload(file)}
          onAdjustHeader={() => void handleAdjustExistingBanner()}
          onRemoveHeader={() => void handleRemove("header")}
        />
      </div>

      <div className="bg-background relative p-6">
        <div className="absolute -top-12 left-6">
          <div
            {...getOrganizationFocusTargetProps("logoUrl")}
            className={cn(
              "relative h-24 w-24",
              ORGANIZATION_FOCUS_TARGET_CLASSNAME
            )}
          >
            <div className="border-border bg-background relative h-24 w-24 overflow-hidden rounded-xl border">
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt="Logo"
                  fill
                  className="object-cover"
                  sizes="96px"
                />
              ) : (
                <div className="text-muted-foreground grid h-full w-full place-items-center">
                  <ImageIcon className="h-6 w-6" aria-hidden />
                </div>
              )}
            </div>
            <OrgProfileHeaderLogoControls
              canEdit={canEdit}
              editMode={editMode}
              logoInputId={logoInputId}
              logoBusy={logoBusy}
              hasLogo={hasLogo}
              isUploadingLogo={isUploadingLogo}
              onUploadLogo={(file) => void handleUpload(file, "logo")}
              onRemoveLogo={() => void handleRemove("logo")}
            />
          </div>
        </div>

        <div className="mt-12">
          <h2 className="text-2xl font-semibold tracking-tight">
            {name || "Organization"}
          </h2>
          <p className="text-muted-foreground max-w-md text-sm">
            {tagline || "—"}
          </p>
          {links}
        </div>

        {donationAction ? <div className="absolute top-6 right-6">{donationAction}</div> : null}
      </div>

      <OrgProfileBannerCropDialog
        open={bannerCropOpen}
        onOpenChange={handleBannerCropOpenChange}
        rawImageUrl={bannerRawImageUrl}
        crop={bannerCrop}
        onCropChange={setBannerCrop}
        zoom={bannerZoom}
        onZoomChange={setBannerZoom}
        onCropComplete={setBannerCroppedArea}
        isUploadingBanner={isUploadingHeader}
        onApply={handleApplyBannerCrop}
      />
    </>
  )
}
