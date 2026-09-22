import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { useSupabaseClient } from "@/hooks/use-supabase-client"
import { toast } from "@/lib/toast"
import {
  useAccountSettingsDraft,
  useAccountSettingsDrafts,
} from "./account-settings-drafts"
import { useAccountSettingsProfileLoader } from "./account-settings-dialog-profile-loader"
import {
  isMobileSettingsViewport,
  requestDeleteAccount,
  resolveErrorMessage,
  saveCommunicationPreferences,
  saveProfileSettings,
} from "./account-settings-dialog-state-helpers"
import type {
  UseAccountSettingsDialogStateArgs,
  UseAccountSettingsDialogStateResult,
} from "./account-settings-dialog-state-types"
import type {
  AccountSettingsErrorKey,
  AccountSettingsMobilePage,
  AccountSettingsTabKey,
} from "./types"

export function useAccountSettingsDialogState({
  open,
  initialTab,
  defaultName = "",
  defaultEmail = "",
  defaultMarketingOptIn,
  defaultNewsletterOptIn,
  onOpenChange,
}: UseAccountSettingsDialogStateArgs): UseAccountSettingsDialogStateResult {
  const supabase = useSupabaseClient()
  const router = useRouter()

  const [tab, _setTab] = useState<AccountSettingsTabKey>(initialTab)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [title, setTitle] = useState("")
  const [company, setCompany] = useState("")
  const [contact, setContact] = useState("")
  const [about, setAbout] = useState("")
  const [phone, setPhone] = useState("")
  const [preferencesError, setPreferencesError] = useState<string | null>(null)
  const [preferencesLoading, setPreferencesLoading] = useState(true)
  const [preferencesRetry, setPreferencesRetry] = useState(0)
  const retryPreferences = () => setPreferencesRetry((value) => value + 1)
  const [marketingOptIn, setMarketingOptIn] = useState(defaultMarketingOptIn)
  const [newsletterOptIn, setNewsletterOptIn] = useState(defaultNewsletterOptIn)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const dirtyRef = useRef(false)
  const [dirty, setDirty] = useState(false)
  const [errors, setErrors] = useState<
    Partial<Record<AccountSettingsErrorKey, string>>
  >({})
  const [mobilePage, setMobilePage] =
    useState<AccountSettingsMobilePage>("menu")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  const [orgName, setOrgName] = useState("")

  const email = defaultEmail ?? ""
  const initialFirstRef = useRef("")
  const initialLastRef = useRef("")
  const initialTitleRef = useRef("")
  const initialCompanyRef = useRef("")
  const initialContactRef = useRef("")
  const initialAboutRef = useRef("")
  const initialPhoneRef = useRef("")
  const initialMarketingRef = useRef(defaultMarketingOptIn)
  const initialNewsletterRef = useRef(defaultNewsletterOptIn)

  const markDirty = () => {
    dirtyRef.current = true
    setDirty(true)
  }

  const clearError = (key: AccountSettingsErrorKey) => {
    setErrors((prev) => {
      if (!prev?.[key]) {
        return prev
      }
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const handleFirstNameChange = (value: string) => {
    setFirstName(value)
    markDirty()
    clearError("firstName")
  }
  const handleLastNameChange = (value: string) => {
    setLastName(value)
    markDirty()
    clearError("lastName")
  }
  const handlePhoneChange = (value: string) => {
    setPhone(value)
    markDirty()
    clearError("phone")
  }
  const handleTitleChange = (value: string) => {
    setTitle(value)
    markDirty()
  }
  const handleCompanyChange = (value: string) => {
    setCompany(value)
    markDirty()
  }
  const handleContactChange = (value: string) => {
    setContact(value)
    markDirty()
  }
  const handleAboutChange = (value: string) => {
    setAbout(value)
    markDirty()
  }
  const handleMarketingOptInChange = (value: boolean) => {
    setMarketingOptIn(value)
    markDirty()
  }
  const handleNewsletterOptInChange = (value: boolean) => {
    setNewsletterOptIn(value)
    markDirty()
  }
  const handleNewPasswordChange = setNewPassword
  const handleConfirmPasswordChange = setConfirmPassword
  const handleMobilePageChange = (page: AccountSettingsMobilePage) => {
    if (page === "menu") {
      setMobilePage("menu")
      return
    }
    setMobilePage(page)
  }

  function setTab(tabKey: AccountSettingsTabKey) {
    _setTab(tabKey)
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches
    ) {
      setMobilePage(tabKey)
    }
  }

  useEffect(() => {
    dirtyRef.current = false
    setDirty(false)
    setJustSaved(false)
    if (open) {
      _setTab(initialTab)
      setMobilePage(initialTab === "profile" ? "menu" : initialTab)
    } else {
      setMobilePage("menu")
    }
  }, [initialTab, open])

  useAccountSettingsProfileLoader({
    preferencesRetry,
    setPreferencesError,
    setPreferencesLoading,
    open,
    supabase,
    defaultName,
    defaultMarketingOptIn,
    defaultNewsletterOptIn,
    setMarketingOptIn,
    setNewsletterOptIn,
    setPhone,
    setAvatarUrl,
    setFirstName,
    setLastName,
    setTitle,
    setCompany,
    setContact,
    setAbout,
    setOrgName,
    initialFirstRef,
    initialLastRef,
    initialTitleRef,
    initialCompanyRef,
    initialContactRef,
    initialAboutRef,
    initialPhoneRef,
    initialMarketingRef,
    initialNewsletterRef,
  })

  const drafts = useAccountSettingsDrafts()
  useAccountSettingsDraft(dirty)
  const isDirty = dirty || dirtyRef.current || Boolean(drafts?.isDirty)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError) {
        throw userError
      }
      const userId = userData?.user?.id
      if (!userId) {
        throw new Error("Unable to save settings. Please sign in again.")
      }

      {
        const result = await saveProfileSettings({
          supabase,
          userId,
          firstName,
          lastName,
          title,
          company,
          contact,
          about,
          phone,
          initialFirstName: initialFirstRef.current,
          initialLastName: initialLastRef.current,
          initialTitle: initialTitleRef.current,
          initialCompany: initialCompanyRef.current,
          initialContact: initialContactRef.current,
          initialAbout: initialAboutRef.current,
          initialPhone: initialPhoneRef.current,
        })

        initialFirstRef.current = result.initialFirstName
        initialLastRef.current = result.initialLastName
        initialTitleRef.current = result.initialTitle
        initialCompanyRef.current = result.initialCompany
        initialContactRef.current = result.initialContact
        initialAboutRef.current = result.initialAbout
        initialPhoneRef.current = result.initialPhone

        if (result.firstName !== firstName) {
          setFirstName(result.firstName)
        }
        if (result.lastName !== lastName) {
          setLastName(result.lastName)
        }
        if (result.title !== title) {
          setTitle(result.title)
        }
        if (result.company !== company) {
          setCompany(result.company)
        }
        if (result.contact !== contact) {
          setContact(result.contact)
        }
        if (result.about !== about) {
          setAbout(result.about)
        }
      }
      {
        const result = await saveCommunicationPreferences({
          supabase,
          marketingOptIn,
          newsletterOptIn,
          initialMarketingOptIn: initialMarketingRef.current,
          initialNewsletterOptIn: initialNewsletterRef.current,
        })
        initialMarketingRef.current = result.initialMarketingOptIn
        initialNewsletterRef.current = result.initialNewsletterOptIn
      }

      await drafts?.saveDrafts()
      dirtyRef.current = false
      setDirty(false)

      const isMobile = isMobileSettingsViewport()
      if (isMobile) {
        setMobilePage("menu")
        _setTab("profile")
        setJustSaved(false)
      }
      router.refresh()
      if (!isMobile) {
        setJustSaved(true)
      }
    } catch (error) {
      toast.error(resolveErrorMessage(error, "Unable to save settings."))
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword !== confirmPassword) return
    setIsUpdatingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })
      if (error) {
        toast.error(error.message || "Unable to update password.")
        return
      }
      setNewPassword("")
      setConfirmPassword("")
      toast.success("Password updated.")
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  const handleDeleteAccount = async () => {
    const result = await requestDeleteAccount()
    if (!result.ok) {
      toast.error(result.message)
      if (result.sessionExpired) {
        await supabase.auth.signOut().catch(() => undefined)
        router.replace("/login")
        router.refresh()
      }
      return false
    }

    try {
      await supabase.auth.signOut().catch(() => undefined)
      router.replace("/")
      router.refresh()
      return true
    } catch {
      toast.error("Unable to delete account.")
      return false
    }
  }

  const requestClose = () => {
    if (isDirty && !isSaving) {
      setConfirmClose(true)
      return
    }
    onOpenChange(false)
  }

  const applyAvatarUrl = (url: string) => {
    setAvatarUrl(url)
  }

  return {
    tab,
    setTab,
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
    orgName,
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
  }
}
