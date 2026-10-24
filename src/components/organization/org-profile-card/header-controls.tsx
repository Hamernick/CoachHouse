"use client"

import { useRef } from "react"
import ArrowUpRight from "lucide-react/dist/esm/icons/arrow-up-right"
import ImagePlus from "lucide-react/dist/esm/icons/image-plus"
import { cn } from "@/lib/utils"
import {
  WorkspaceWindowHeaderPortal,
  useWorkspaceWindowHeader,
  WORKSPACE_HEADER_BUTTON,
} from "@/components/workspace/workspace-window-header-slots"
import Link from "next/link"
import Loader2 from "lucide-react/dist/esm/icons/loader-2"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ORG_BANNER_ASPECT_LABEL,
  ORG_BANNER_MIN_DIMENSIONS_LABEL,
  ORG_BANNER_RECOMMENDED_DIMENSIONS_LABEL,
} from "@/lib/organization/banner-spec"

const IMAGE_ACTION_BUTTON_CLASS = "relative size-7 rounded-full border-border/70 bg-card/95 p-0 shadow-none backdrop-blur-sm dark:bg-card/95 dark:hover:bg-muted after:absolute after:-inset-2"

type OrgProfileHeaderBannerControlsProps = {
  canEdit: boolean
  editMode: boolean
  headerInputId: string
  headerBusy: boolean
  hasHeader: boolean
  isUploadingHeader: boolean
  onStartBannerUpload: (file: File) => void
  onAdjustHeader: () => void
  onRemoveHeader: () => void
}

export function OrgProfileHeaderBannerControls({
  canEdit,
  editMode,
  headerInputId,
  headerBusy,
  hasHeader,
  isUploadingHeader,
  onStartBannerUpload,
  onAdjustHeader,
  onRemoveHeader,
}: OrgProfileHeaderBannerControlsProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  if (!canEdit) return null

  return (
    <div
      aria-hidden={!editMode}
      inert={!editMode ? true : undefined}
      className={cn("absolute top-2 right-4 left-4 flex flex-col items-end gap-2 transition-opacity duration-150 motion-reduce:transition-none", editMode ? "opacity-100" : "pointer-events-none opacity-0")}
    >
      <div id={`${headerInputId}-hint`} className="border-border/60 bg-background/85 text-muted-foreground max-w-full text-right rounded-md border px-2 py-1 text-[10px] backdrop-blur-sm">
        Banner {ORG_BANNER_RECOMMENDED_DIMENSIONS_LABEL}px (
        {ORG_BANNER_ASPECT_LABEL}) recommended · min{" "}
        {ORG_BANNER_MIN_DIMENSIONS_LABEL}px
      </div>
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          id={headerInputId}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            if (!file) return
            onStartBannerUpload(file)
            event.currentTarget.value = ""
          }}
        />
        {hasHeader ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                className={IMAGE_ACTION_BUTTON_CLASS}
                aria-describedby={`${headerInputId}-hint`}
                disabled={headerBusy}
                aria-label="Header image actions"
              >
                <ImagePlus className="size-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={headerBusy}
                onSelect={() => onAdjustHeader()}
              >
                Adjust banner
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                asChild
                disabled={headerBusy}
                className="cursor-pointer"
              >
                <label
                  htmlFor={headerInputId}
                  className="flex w-full cursor-pointer items-center gap-2"
                >
                  {isUploadingHeader ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden />{" "}
                      Uploading…
                    </>
                  ) : (
                    "Replace banner"
                  )}
                </label>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled className="opacity-100">
                <span className="text-muted-foreground text-xs">
                  Banner: {ORG_BANNER_RECOMMENDED_DIMENSIONS_LABEL}px (
                  {ORG_BANNER_ASPECT_LABEL})
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                disabled={headerBusy}
                onSelect={() => onRemoveHeader()}
              >
                Remove banner
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            type="button"
            size="icon"
            variant="outline"
            className={IMAGE_ACTION_BUTTON_CLASS}
            disabled={headerBusy}
            aria-label={isUploadingHeader ? "Uploading banner" : "Add banner image"}
            aria-describedby={`${headerInputId}-hint`}
            onClick={() => inputRef.current?.click()}
          >
            {isUploadingHeader
              ? <Loader2 className="size-4 animate-spin" aria-hidden />
              : <ImagePlus className="size-4" aria-hidden />}
          </Button>
        )}
      </div>

    </div>
  )
}

type OrgProfileHeaderLogoControlsProps = {
  canEdit: boolean
  editMode: boolean
  logoInputId: string
  logoBusy: boolean
  hasLogo: boolean
  isUploadingLogo: boolean
  onUploadLogo: (file: File) => void
  onRemoveLogo: () => void
}

export function OrgProfileHeaderLogoControls({
  canEdit,
  editMode,
  logoInputId,
  logoBusy,
  hasLogo,
  isUploadingLogo,
  onUploadLogo,
  onRemoveLogo,
}: OrgProfileHeaderLogoControlsProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  if (!canEdit) return null

  return (
    <div
      aria-hidden={!editMode}
      inert={!editMode ? true : undefined}
      className={cn("absolute right-1 bottom-1 transition-opacity duration-150 motion-reduce:transition-none", editMode ? "opacity-100" : "pointer-events-none opacity-0")}
    >
      <input
        ref={inputRef}
        id={logoInputId}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          if (!file) return
          onUploadLogo(file)
          event.currentTarget.value = ""
        }}
      />
      {hasLogo ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="outline"
              className={IMAGE_ACTION_BUTTON_CLASS}
              disabled={logoBusy}
              aria-label="Logo image actions"
            >
              <ImagePlus className="size-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              asChild
              disabled={logoBusy}
              className="cursor-pointer"
            >
              <label
                htmlFor={logoInputId}
                className="flex w-full cursor-pointer items-center gap-2"
              >
                {isUploadingLogo ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />{" "}
                    Uploading…
                  </>
                ) : (
                  "Replace logo"
                )}
              </label>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={logoBusy}
              onSelect={() => onRemoveLogo()}
            >
              Remove logo
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button
          type="button"
          size="icon"
          variant="outline"
          className={IMAGE_ACTION_BUTTON_CLASS}
          disabled={logoBusy}
          aria-label={isUploadingLogo ? "Uploading logo" : "Add logo image"}
          onClick={() => inputRef.current?.click()}
        >
          {isUploadingLogo
            ? <Loader2 className="size-4 animate-spin" aria-hidden />
            : <ImagePlus className="size-4" aria-hidden />}
        </Button>
      )}
    </div>
  )
}

type OrgProfileHeaderActionsProps = {
  publicLink?: string | null
  editMode: boolean
  canEdit: boolean
  isSaving: boolean
  isDirty: boolean
  onEnterEdit: () => void
  onCancelEdit: () => void
  onSave: () => void
}

export function OrgProfileHeaderActions({
  publicLink,
  editMode,
  canEdit,
  isSaving,
  isDirty,
  onEnterEdit,
  onCancelEdit,
  onSave,
}: OrgProfileHeaderActionsProps) {
  const inWindowHeader = useWorkspaceWindowHeader()
  if (!canEdit && (!publicLink || editMode)) return null

  return (
    <WorkspaceWindowHeaderPortal>
      <div
        key={editMode ? "edit" : "view"}
        className={cn(
          "flex flex-wrap items-center justify-end gap-2 animate-in fade-in duration-150 motion-reduce:animate-none",
          !inWindowHeader && "pb-3"
        )}
      >
        {publicLink && !editMode ? (
          <Button
            asChild
            size="sm"
            className={inWindowHeader ? WORKSPACE_HEADER_BUTTON : undefined}
            variant="secondary"
          >
            <Link href={publicLink} target="_blank" rel="noopener noreferrer">
              View Public Profile
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
              <span className="sr-only"> (opens in a new tab)</span>
            </Link>
          </Button>
        ) : null}
        {canEdit ? (
          editMode ? (
            <>
              <Button
                size="sm"
                className={inWindowHeader ? WORKSPACE_HEADER_BUTTON : undefined}
                variant="ghost"
                onClick={onCancelEdit}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className={inWindowHeader ? WORKSPACE_HEADER_BUTTON : undefined}
                onClick={onSave}
                disabled={isSaving || !isDirty}
              >
                {isSaving ? "Saving…" : "Save changes"}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              className={inWindowHeader ? WORKSPACE_HEADER_BUTTON : undefined}
              onClick={onEnterEdit}
              data-tour="org-profile-edit"
            >
              Edit
            </Button>
          )
        ) : null}
      </div>
    </WorkspaceWindowHeaderPortal>
  )
}
