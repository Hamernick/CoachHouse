import type {
  AccountSettingsErrorKey,
  AccountSettingsMobilePage,
  AccountSettingsTabKey,
} from "./types"

export type UseAccountSettingsDialogStateArgs = {
  open: boolean
  initialTab: AccountSettingsTabKey
  defaultName?: string | null
  defaultEmail?: string | null
  defaultMarketingOptIn: boolean
  defaultNewsletterOptIn: boolean
  onOpenChange: (next: boolean) => void
}

export type UseAccountSettingsDialogStateResult = {
  tab: AccountSettingsTabKey
  setTab: (tab: AccountSettingsTabKey) => void
  mobilePage: AccountSettingsMobilePage
  handleMobilePageChange: (page: AccountSettingsMobilePage) => void
  firstName: string
  lastName: string
  title: string
  company: string
  contact: string
  about: string
  phone: string
  preferencesError: string | null
  preferencesLoading: boolean
  retryPreferences: () => void
  marketingOptIn: boolean
  newsletterOptIn: boolean
  newPassword: string
  confirmPassword: string
  isSaving: boolean
  justSaved: boolean
  isUpdatingPassword: boolean
  confirmClose: boolean
  setConfirmClose: (next: boolean) => void
  isDirty: boolean
  errors: Partial<Record<AccountSettingsErrorKey, string>>
  avatarUrl: string | null
  orgName: string
  email: string
  handleSave: () => Promise<void>
  handleUpdatePassword: () => Promise<void>
  handleDeleteAccount: () => Promise<boolean>
  requestClose: () => void
  handleMarketingOptInChange: (value: boolean) => void
  handleNewsletterOptInChange: (value: boolean) => void
  handleFirstNameChange: (value: string) => void
  handleLastNameChange: (value: string) => void
  handleTitleChange: (value: string) => void
  handleCompanyChange: (value: string) => void
  handleContactChange: (value: string) => void
  handleAboutChange: (value: string) => void
  handlePhoneChange: (value: string) => void
  handleNewPasswordChange: (value: string) => void
  handleConfirmPasswordChange: (value: string) => void
  applyAvatarUrl: (url: string) => void
}
