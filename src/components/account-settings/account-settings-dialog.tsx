"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { toast } from "@/lib/toast"
import type { AccountDeletionPreflight } from "@/lib/account-deletion/types"

import { AccountSettingsDraftsProvider } from "./account-settings-drafts"
import { AccountSettingsAvatarCropDialog } from "./account-settings-avatar-crop-dialog"
import { AccountSettingsDeleteAccountDialog } from "./account-settings-delete-account-dialog"
import { AccountSettingsDiscardChangesDialog } from "./account-settings-discard-changes-dialog"
import { type CropArea, getCroppedBlob } from "./account-settings-image-utils"
import { AccountSettingsDialogShell } from "./account-settings-dialog-shell"
import { useAccountSettingsDialogState } from "./account-settings-dialog-state"
import { requestDeleteAccountPreflight } from "./account-settings-dialog-state-helpers"
import type { AccountSettingsTabKey } from "./types"

type TabKey = AccountSettingsTabKey

type AccountSettingsDialogProps = {
  open: boolean
  onOpenChange: (next: boolean) => void
  initialTab?: TabKey
  defaultName?: string | null
  defaultEmail?: string | null
  defaultMarketingOptIn?: boolean
  defaultNewsletterOptIn?: boolean
  hasActiveSubscription?: boolean
}

function AccountSettingsDialogContent({
  open,
  onOpenChange,
  initialTab = "profile",
  defaultName = "",
  defaultEmail = "",
  defaultMarketingOptIn = true,
  defaultNewsletterOptIn = true,
  hasActiveSubscription = false,
}: AccountSettingsDialogProps) {
  const router = useRouter()
  const MAX_AVATAR_BYTES = 5 * 1024 * 1024
  const ALLOWED_AVATAR_TYPES = new Set([
    "image/png",
    "image/jpeg",
    "image/webp",
  ])

  const [cropOpen, setCropOpen] = useState(false)
  const [rawImageUrl, setRawImageUrl] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedArea, setCroppedArea] = useState<CropArea | null>(null)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [deleteEmailInput, setDeleteEmailInput] = useState("")
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [deletePreflight, setDeletePreflight] =
    useState<AccountDeletionPreflight | null>(null)
  const [isDeletePreflightLoading, setIsDeletePreflightLoading] =
    useState(false)
  const [deletePreflightError, setDeletePreflightError] = useState<
    string | null
  >(null)
  const [billingCancellationAcknowledged, setBillingCancellationAcknowledged] =
    useState(false)

  const {
    tab,
    setTab: selectTab,
    mobilePage,
    handleMobilePageChange,
    firstName,
    lastName,
    title,
    company,
    contact,
    about,
    phone,
    preferencesError,
    preferencesLoading,
    retryPreferences,
    marketingOptIn,
    newsletterOptIn,
    newPassword,
    confirmPassword,
    isSaving,
    justSaved,
    isUpdatingPassword,
    confirmClose,
    setConfirmClose,
    isDirty,
    errors,
    avatarUrl,
    email,
    handleSave,
    handleUpdatePassword,
    handleDeleteAccount,
    requestClose,
    handleMarketingOptInChange,
    handleNewsletterOptInChange,
    handleFirstNameChange,
    handleLastNameChange,
    handleTitleChange,
    handleCompanyChange,
    handleContactChange,
    handleAboutChange,
    handlePhoneChange,
    handleNewPasswordChange,
    handleConfirmPasswordChange,
    applyAvatarUrl,
  } = useAccountSettingsDialogState({
    open,
    initialTab,
    defaultName,
    defaultEmail,
    defaultMarketingOptIn,
    defaultNewsletterOptIn,
    onOpenChange,
  })

  const normalizedAccountEmail = email.trim().toLowerCase()
  const normalizedDeleteEmail = deleteEmailInput.trim().toLowerCase()
  const hasDeletionBlockers = Boolean(deletePreflight?.blockingIssues.length)
  const hasBillingCancellationRisk =
    deletePreflight?.billing.hasCancellationRisk ?? hasActiveSubscription
  const canDeleteAccount =
    normalizedAccountEmail.length > 0 &&
    normalizedDeleteEmail.length > 0 &&
    normalizedDeleteEmail === normalizedAccountEmail &&
    (!hasBillingCancellationRisk || billingCancellationAcknowledged) &&
    !isDeletePreflightLoading &&
    !hasDeletionBlockers &&
    !isDeletingAccount

  async function loadDeletePreflight() {
    setIsDeletePreflightLoading(true)
    setDeletePreflightError(null)
    const result = await requestDeleteAccountPreflight()
    setIsDeletePreflightLoading(false)
    if (result.ok) {
      setDeletePreflight(result.preflight)
      return
    }
    setDeletePreflight(null)
    setDeletePreflightError(result.message)
  }

  function openDeleteAccountConfirmation() {
    setDeleteEmailInput("")
    setBillingCancellationAcknowledged(false)
    setDeletePreflight(null)
    setDeletePreflightError(null)
    setConfirmDeleteOpen(true)
    void loadDeletePreflight()
  }

  function resetAvatarCropState() {
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedArea(null)
    setRawImageUrl((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous)
      }
      return null
    })
  }

  async function confirmAccountDeletion() {
    if (!canDeleteAccount) return

    setIsDeletingAccount(true)
    try {
      const deleted = await handleDeleteAccount()
      if (deleted) {
        setConfirmDeleteOpen(false)
      }
    } finally {
      setIsDeletingAccount(false)
    }
  }

  function handleAvatarFileSelected(file?: File | null) {
    if (!file) return
    if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
      toast.error("Unsupported image type. Use PNG, JPEG, or WebP.")
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Image too large. Max size is 5 MB.")
      return
    }
    if (rawImageUrl) {
      URL.revokeObjectURL(rawImageUrl)
    }
    const url = URL.createObjectURL(file)
    setRawImageUrl(url)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedArea(null)
    setCropOpen(true)
  }

  useEffect(() => {
    return () => {
      if (rawImageUrl) {
        URL.revokeObjectURL(rawImageUrl)
      }
    }
  }, [rawImageUrl])

  return (
    <>
      <AccountSettingsDialogShell
        open={open}
        onOpenChange={onOpenChange}
        requestClose={requestClose}
        tab={tab}
        onTabChange={selectTab}
        mobilePage={mobilePage}
        onMobilePageChange={handleMobilePageChange}
        isDirty={isDirty}
        isSaving={isSaving}
        justSaved={justSaved}
        preferencesError={preferencesError}
        preferencesLoading={preferencesLoading}
        retryPreferences={retryPreferences}
        marketingOptIn={marketingOptIn}
        newsletterOptIn={newsletterOptIn}
        newPassword={newPassword}
        confirmPassword={confirmPassword}
        isUpdatingPassword={isUpdatingPassword}
        firstName={firstName}
        lastName={lastName}
        title={title}
        company={company}
        contact={contact}
        about={about}
        phone={phone}
        email={email}
        hasActiveSubscription={hasActiveSubscription}
        avatarUrl={avatarUrl}
        isUploadingAvatar={isUploadingAvatar}
        errors={errors}
        onSave={handleSave}
        onUpdatePassword={handleUpdatePassword}
        onDeleteAccount={openDeleteAccountConfirmation}
        onAvatarFileSelected={handleAvatarFileSelected}
        onMarketingOptInChange={handleMarketingOptInChange}
        onNewsletterOptInChange={handleNewsletterOptInChange}
        onFirstNameChange={handleFirstNameChange}
        onLastNameChange={handleLastNameChange}
        onTitleChange={handleTitleChange}
        onCompanyChange={handleCompanyChange}
        onContactChange={handleContactChange}
        onAboutChange={handleAboutChange}
        onPhoneChange={handlePhoneChange}
        onNewPasswordChange={handleNewPasswordChange}
        onConfirmPasswordChange={handleConfirmPasswordChange}
      />

      <AccountSettingsAvatarCropDialog
        open={cropOpen}
        onOpenChange={(next) => {
          setCropOpen(next)
          if (!next) {
            resetAvatarCropState()
          }
        }}
        rawImageUrl={rawImageUrl}
        crop={crop}
        onCropChange={setCrop}
        zoom={zoom}
        onZoomChange={setZoom}
        onCropComplete={setCroppedArea}
        isUploadingAvatar={isUploadingAvatar}
        onApply={async () => {
          if (!rawImageUrl || !croppedArea) return
          setIsUploadingAvatar(true)
          const toastId = toast.loading("Uploading photo...")
          try {
            const blob = await getCroppedBlob(rawImageUrl, croppedArea)
            if (!blob) throw new Error("Failed to crop image")
            if (blob.size > MAX_AVATAR_BYTES) {
              toast.error("Cropped image is over 5 MB.")
              return
            }
            const formData = new FormData()
            formData.append(
              "file",
              new File([blob], "avatar.png", { type: blob.type || "image/png" })
            )
            const res = await fetch("/api/account/avatar", {
              method: "POST",
              body: formData,
            })
            if (!res.ok) {
              const err = await res.json().catch(() => ({}))
              const debugToken =
                typeof err?.debugToken === "string" &&
                err.debugToken.trim().length > 0
                  ? err.debugToken
                  : null
              const errorMessage =
                typeof err?.error === "string" && err.error.trim().length > 0
                  ? err.error
                  : "Upload failed"
              throw new Error(
                debugToken
                  ? `${errorMessage} (ref: ${debugToken})`
                  : errorMessage
              )
            }
            const { avatarUrl: url } = await res.json()
            if (typeof url !== "string" || url.trim().length === 0) {
              throw new Error(
                "Upload succeeded but no avatar URL was returned."
              )
            }
            applyAvatarUrl(url)
            setCropOpen(false)
            resetAvatarCropState()
            toast.success("Profile photo updated", { id: toastId })
            requestAnimationFrame(() => {
              router.refresh()
            })
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Upload failed"
            toast.error(message, { id: toastId })
          } finally {
            setIsUploadingAvatar(false)
          }
        }}
      />

      <AccountSettingsDeleteAccountDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        isDeletingAccount={isDeletingAccount}
        deleteEmailInput={deleteEmailInput}
        onDeleteEmailInputChange={setDeleteEmailInput}
        accountEmail={email}
        hasActiveSubscription={hasBillingCancellationRisk}
        deletePreflight={deletePreflight}
        isDeletePreflightLoading={isDeletePreflightLoading}
        deletePreflightError={deletePreflightError}
        billingCancellationAcknowledged={billingCancellationAcknowledged}
        onBillingCancellationAcknowledgedChange={
          setBillingCancellationAcknowledged
        }
        canDeleteAccount={canDeleteAccount}
        onConfirmDelete={confirmAccountDeletion}
      />

      <AccountSettingsDiscardChangesDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        onDiscard={() => {
          setConfirmClose(false)
          onOpenChange(false)
        }}
      />
    </>
  )
}

export function AccountSettingsDialog(props: AccountSettingsDialogProps) {
  return (
    <AccountSettingsDraftsProvider key={props.open ? "open" : "closed"}>
      <AccountSettingsDialogContent {...props} />
    </AccountSettingsDraftsProvider>
  )
}
