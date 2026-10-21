"use client"

import { useId, useState, type ReactNode } from "react"
import ImageIcon from "lucide-react/dist/esm/icons/image"
import { toast } from "@/lib/toast"

import Image from "next/image"
import { cn } from "@/lib/utils"
import {
  uploadOrgMedia,
  validateOrgMediaFile,
} from "@/lib/organization/org-media"
import {
  getOrganizationFocusTargetProps,
  ORGANIZATION_FOCUS_TARGET_CLASSNAME,
} from "./organization-deep-link-focus"

import { OrgProfileHeaderLogoControls } from "./header-controls"

type OrgProfileHeaderProps = {
  name: string
  tagline: string
  logoUrl: string
  editMode: boolean
  isSaving: boolean
  canEdit: boolean
  links?: ReactNode
  donationAction?: ReactNode
  onLogoChange: (url: string | null) => Promise<void>
}

export function OrgProfileHeader({
  name,
  tagline,
  logoUrl,
  editMode,
  isSaving,
  canEdit,
  links,
  donationAction,
  onLogoChange,
}: OrgProfileHeaderProps) {
  const logoInputId = useId()
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [isRemovingLogo, setIsRemovingLogo] = useState(false)

  const handleUpload = async (file: File): Promise<boolean> => {
    const error = validateOrgMediaFile(file)
    if (error) {
      toast.error(error)
      return false
    }

    setIsUploadingLogo(true)
    const toastId = toast.loading("Uploading image…")
    try {
      const url = await uploadOrgMedia({ file, kind: "logo" })
      await onLogoChange(url)
      toast.success("Image saved", { id: toastId })
      return true
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Upload failed", {
        id: toastId,
      })
      return false
    } finally {
      setIsUploadingLogo(false)
    }
  }

  const handleRemove = async () => {
    setIsRemovingLogo(true)
    const toastId = toast.loading("Removing image…")
    try {
      await onLogoChange(null)
      toast.success("Image removed", { id: toastId })
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Remove failed", {
        id: toastId,
      })
    } finally {
      setIsRemovingLogo(false)
    }
  }

  const logoBusy = isUploadingLogo || isRemovingLogo || isSaving
  const hasLogo = Boolean(logoUrl)

  return (
    <div className="bg-background relative flex flex-col items-center gap-4 p-6 text-center">
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
          onUploadLogo={(file) => void handleUpload(file)}
          onRemoveLogo={() => void handleRemove()}
        />
      </div>

      <div className="flex w-full min-w-0 flex-col items-center">
        <h2 className="text-2xl font-semibold tracking-tight">
          {name || "Organization"}
        </h2>
        <p className="text-muted-foreground max-w-md text-sm">
          {tagline || "—"}
        </p>
        {links}
      </div>

      {donationAction ? <div className="empty:hidden">{donationAction}</div> : null}
    </div>
  )
}
