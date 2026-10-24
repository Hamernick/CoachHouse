"use client"

import Image from "next/image"
import { useId, useRef, useState } from "react"

import Loader2Icon from "lucide-react/dist/esm/icons/loader-2"
import Trash2Icon from "lucide-react/dist/esm/icons/trash-2"
import UploadIcon from "lucide-react/dist/esm/icons/upload"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/lib/toast"
import {
  deleteProgramMedia,
  resolveProgramMediaObjectPath,
  uploadProgramMedia,
  validateProgramMediaFile,
} from "@/lib/storage/program-media"

import type { ProgramWizardFormState } from "../schema"
import type { ProgramWizardFieldErrors, ProgramWizardUpdate } from "../types"

type StepBasicInfoProps = {
  organizationId?: string
  mode: "create" | "edit"
  form: ProgramWizardFormState
  errors: ProgramWizardFieldErrors
  update: ProgramWizardUpdate
}

type ProgramMediaFieldProps = {
  label: string
  value: string
  placeholder: string
  helpText: string
  previewClassName: string
  isUploading: boolean
  isRemoving: boolean
  onChange: (value: string) => void
  onUpload: (file: File) => Promise<void>
  onRemove: () => Promise<void>
}

function ProgramMediaField({
  label,
  value,
  placeholder,
  helpText,
  previewClassName,
  isUploading,
  isRemoving,
  onChange,
  onUpload,
  onRemove,
}: ProgramMediaFieldProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={inputId}>{label}</Label>
      <div className="space-y-2">
        {value ? (
          <div
            className={`border-border/60 bg-muted/20 overflow-hidden rounded-xl border ${previewClassName}`}
          >
            <Image
              src={value}
              alt=""
              width={960}
              height={384}
              className="h-full w-full object-cover"
            />
          </div>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            id={inputId}
            value={value}
            onChange={(event) => onChange(event.currentTarget.value)}
            placeholder={placeholder}
            className="text-base sm:flex-1"
          />
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0]
              if (!file) return
              void onUpload(file)
              event.currentTarget.value = ""
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-10 shrink-0"
            disabled={isUploading || isRemoving}
            onClick={() => inputRef.current?.click()}
          >
            <span>
              {isUploading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden />
                  Uploading…
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <UploadIcon className="h-4 w-4" aria-hidden />
                  Upload image
                </span>
              )}
            </span>
          </Button>
          {value ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-10 shrink-0"
              disabled={isUploading || isRemoving}
              onClick={() => void onRemove()}
            >
              {isRemoving ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden />
                  Removing…
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Trash2Icon className="h-4 w-4" aria-hidden />
                  Remove image
                </span>
              )}
            </Button>
          ) : null}
        </div>
        <p className="text-muted-foreground text-xs">{helpText}</p>
      </div>
    </div>
  )
}

export function StepBasicInfo({
  mode,
  organizationId,
  form,
  errors,
  update,
}: StepBasicInfoProps) {
  const [isUploadingBanner, setIsUploadingBanner] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [isRemovingBanner, setIsRemovingBanner] = useState(false)
  const [isRemovingImage, setIsRemovingImage] = useState(false)

  const handleMediaUpload = async ({
    file,
    field,
    setUploading,
    label,
  }: {
    file: File
    field: "bannerImageUrl" | "imageUrl"
    setUploading: (value: boolean) => void
    label: string
  }) => {
    const validationError = validateProgramMediaFile(file)
    if (validationError) {
      toast.error(validationError)
      return
    }

    setUploading(true)
    const toastId = toast.loading(`Uploading ${label.toLowerCase()}…`)
    try {
      const url = await uploadProgramMedia({ file, organizationId })
      update({ [field]: url } as Partial<ProgramWizardFormState>)
      toast.success(`${label} saved`, { id: toastId })
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Upload failed", {
        id: toastId,
      })
    } finally {
      setUploading(false)
    }
  }

  const handleMediaRemove = async ({
    currentUrl,
    field,
    setRemoving,
  }: {
    currentUrl: string
    field: "bannerImageUrl" | "imageUrl"
    setRemoving: (value: boolean) => void
  }) => {
    const normalizedUrl = currentUrl.trim()
    if (!normalizedUrl) return

    update({ [field]: "" } as Partial<ProgramWizardFormState>)

    if (mode !== "create" || !resolveProgramMediaObjectPath(normalizedUrl)) {
      return
    }

    setRemoving(true)
    const toastId = toast.loading("Removing image…")
    try {
      await deleteProgramMedia({ url: normalizedUrl })
      toast.success("Image removed", { id: toastId })
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Removed from the form, but cleanup failed",
        { id: toastId }
      )
    } finally {
      setRemoving(false)
    }
  }

  return (
    <section className="grid gap-4 sm:grid-cols-2">
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor="programTitle">Resource name</Label>
        <Input
          id="programTitle"
          value={form.title}
          onChange={(event) => update({ title: event.currentTarget.value })}
          placeholder="Community Career Bridge"
          className="text-base"
        />
        {errors.title ? (
          <p className="text-destructive text-xs">{errors.title}</p>
        ) : null}
      </div>
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor="oneSentence">One-sentence description</Label>
        <Textarea
          id="oneSentence"
          value={form.oneSentence}
          onChange={(event) =>
            update({ oneSentence: event.currentTarget.value })
          }
          placeholder="Describe the resource in one clear sentence."
          className="min-h-[96px] text-base"
        />
        {errors.oneSentence ? (
          <p className="text-destructive text-xs">{errors.oneSentence}</p>
        ) : null}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="programSubtitle">Subtitle (optional)</Label>
        <Input
          id="programSubtitle"
          value={form.subtitle}
          onChange={(event) => update({ subtitle: event.currentTarget.value })}
          placeholder="Spring cohort for new board leaders"
          className="text-base"
        />
      </div>
      <div className="sm:col-span-2">
        <ProgramMediaField
          label="Resource banner (optional)"
          value={form.bannerImageUrl}
          placeholder="Paste a wide banner image URL or upload a file"
          helpText="Used for the wide resource header on larger cards and previews."
          previewClassName="h-32"
          isUploading={isUploadingBanner}
          isRemoving={isRemovingBanner}
          onChange={(value) => update({ bannerImageUrl: value })}
          onUpload={(file) =>
            handleMediaUpload({
              file,
              field: "bannerImageUrl",
              setUploading: setIsUploadingBanner,
              label: "Resource banner",
            })
          }
          onRemove={() =>
            handleMediaRemove({
              currentUrl: form.bannerImageUrl,
              field: "bannerImageUrl",
              setRemoving: setIsRemovingBanner,
            })
          }
        />
      </div>
      <ProgramMediaField
        label="Resource profile image (optional)"
        value={form.imageUrl}
        placeholder="Paste a profile image URL or upload a file"
        helpText="Used for compact resource cards and thumbnail surfaces."
        previewClassName="h-32"
        isUploading={isUploadingImage}
        isRemoving={isRemovingImage}
        onChange={(value) => update({ imageUrl: value })}
        onUpload={(file) =>
          handleMediaUpload({
            file,
            field: "imageUrl",
            setUploading: setIsUploadingImage,
            label: "Resource profile image",
          })
        }
        onRemove={() =>
          handleMediaRemove({
            currentUrl: form.imageUrl,
            field: "imageUrl",
            setRemoving: setIsRemovingImage,
          })
        }
      />
    </section>
  )
}
