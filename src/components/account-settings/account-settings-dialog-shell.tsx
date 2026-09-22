import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  CommunicationsSection,
  DangerSection,
  DesktopFooter,
  ProfileSection,
  SecuritySection,
} from "./sections/desktop-sections"
import { SideLink } from "./sections/section-helpers"
import {
  MobileMenu,
  MobileSubpage,
  TAB_LABELS,
} from "./sections/mobile-sections"
import type {
  AccountSettingsErrorKey,
  AccountSettingsMobilePage,
  AccountSettingsTabKey,
} from "./types"

type AccountSettingsDialogShellProps = {
  open: boolean
  onOpenChange: (next: boolean) => void
  requestClose: () => void
  tab: AccountSettingsTabKey
  onTabChange: (tab: AccountSettingsTabKey) => void
  mobilePage: AccountSettingsMobilePage
  onMobilePageChange: (page: AccountSettingsMobilePage) => void
  isDirty: boolean
  isSaving: boolean
  justSaved: boolean
  preferencesError: string | null
  preferencesLoading: boolean
  retryPreferences: () => void
  marketingOptIn: boolean
  newsletterOptIn: boolean
  newPassword: string
  confirmPassword: string
  isUpdatingPassword: boolean
  firstName: string
  lastName: string
  title: string
  company: string
  contact: string
  about: string
  phone: string
  email: string
  hasActiveSubscription: boolean
  avatarUrl: string | null
  isUploadingAvatar: boolean
  errors: Partial<Record<AccountSettingsErrorKey, string>>
  onSave: () => void
  onUpdatePassword: () => void
  onDeleteAccount: () => void
  onAvatarFileSelected: (file?: File | null) => void
  onMarketingOptInChange: (value: boolean) => void
  onNewsletterOptInChange: (value: boolean) => void
  onFirstNameChange: (value: string) => void
  onLastNameChange: (value: string) => void
  onTitleChange: (value: string) => void
  onCompanyChange: (value: string) => void
  onContactChange: (value: string) => void
  onAboutChange: (value: string) => void
  onPhoneChange: (value: string) => void
  onNewPasswordChange: (value: string) => void
  onConfirmPasswordChange: (value: string) => void
}

export function AccountSettingsDialogShell({
  open,
  onOpenChange,
  requestClose,
  tab,
  onTabChange,
  mobilePage,
  onMobilePageChange,
  isDirty,
  isSaving,
  justSaved,
  preferencesError,
  preferencesLoading,
  retryPreferences,
  marketingOptIn,
  newsletterOptIn,
  newPassword,
  confirmPassword,
  isUpdatingPassword,
  firstName,
  lastName,
  title,
  company,
  contact,
  about,
  phone,
  email,
  hasActiveSubscription,
  avatarUrl,
  isUploadingAvatar,
  errors,
  onSave,
  onUpdatePassword,
  onDeleteAccount,
  onAvatarFileSelected,
  onMarketingOptInChange,
  onNewsletterOptInChange,
  onFirstNameChange,
  onLastNameChange,
  onTitleChange,
  onCompanyChange,
  onContactChange,
  onAboutChange,
  onPhoneChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
}: AccountSettingsDialogShellProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          onOpenChange(true)
        } else {
          requestClose()
        }
      }}
    >
      <DialogContent
        className={cn(
          "top-auto bottom-0 left-1/2 h-[92vh] w-full max-w-none translate-x-[-50%] translate-y-0 overflow-hidden rounded-t-2xl p-0 sm:top-1/2 sm:bottom-auto sm:w-[min(1120px,96%)] sm:max-w-[1120px] sm:translate-y-[-50%] sm:rounded-lg",
          mobilePage !== "menu"
            ? "[&_[data-slot=dialog-close]]:hidden md:[&_[data-slot=dialog-close]]:block"
            : undefined
        )}
      >
        <div className="flex h-full min-h-0 flex-col">
          <DialogHeader className="hidden border-b px-4 py-3 md:block">
            <DialogTitle>Account settings</DialogTitle>
            <DialogDescription>
              Manage your profile, security, and account preferences.
            </DialogDescription>
          </DialogHeader>

          <div className="border-b px-4 py-3 md:hidden">
            <DialogTitle className="sr-only">Account settings</DialogTitle>
            {mobilePage === "menu" ? (
              <div className="text-center">
                <p className="text-base font-semibold">Settings</p>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground h-auto px-1 text-sm"
                  onClick={() => onMobilePageChange("menu")}
                >
                  Cancel
                </Button>
                <p className="text-base font-semibold capitalize">
                  {TAB_LABELS[mobilePage]}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-primary h-auto px-1 text-sm disabled:opacity-50"
                  onClick={onSave}
                  disabled={!isDirty || isSaving}
                >
                  {isSaving ? "Saving…" : "Save"}
                </Button>
              </div>
            )}
          </div>

          <div className="hidden min-h-0 grow md:flex">
            <aside className="w-[240px] shrink-0 border-r p-4 md:p-6">
              <nav className="grid gap-1">
                <SideLink
                  label="Profile"
                  active={tab === "profile"}
                  onClick={() => onTabChange("profile")}
                />
                <SideLink
                  label="Communications"
                  active={tab === "communications"}
                  onClick={() => onTabChange("communications")}
                />
                <SideLink
                  label="Security"
                  active={tab === "security"}
                  onClick={() => onTabChange("security")}
                />
                <Separator className="my-2" />
                <SideLink
                  label="Danger zone"
                  active={tab === "danger"}
                  onClick={() => onTabChange("danger")}
                  danger
                />
              </nav>
            </aside>
            <div className="flex min-h-0 grow">
              <section className="min-h-0 w-full overflow-y-auto p-4 md:p-6">
                <div hidden={tab !== "profile"}>
                  <ProfileSection
                    avatarUrl={avatarUrl}
                    firstName={firstName}
                    lastName={lastName}
                    title={title}
                    company={company}
                    contact={contact}
                    about={about}
                    phone={phone}
                    email={email}
                    errors={errors}
                    isUploadingAvatar={isUploadingAvatar}
                    idPrefix="desktop-profile"
                    onAvatarFileSelected={onAvatarFileSelected}
                    onFirstNameChange={onFirstNameChange}
                    onLastNameChange={onLastNameChange}
                    onTitleChange={onTitleChange}
                    onCompanyChange={onCompanyChange}
                    onContactChange={onContactChange}
                    onAboutChange={onAboutChange}
                    onPhoneChange={onPhoneChange}
                  />
                </div>

                {tab === "communications" && (
                  <CommunicationsSection
                    preferencesError={preferencesError}
                    preferencesLoading={preferencesLoading}
                    retryPreferences={retryPreferences}
                    marketingOptIn={marketingOptIn}
                    newsletterOptIn={newsletterOptIn}
                    onMarketingOptInChange={onMarketingOptInChange}
                    onNewsletterOptInChange={onNewsletterOptInChange}
                  />
                )}

                {tab === "security" && (
                  <SecuritySection
                    newPassword={newPassword}
                    confirmPassword={confirmPassword}
                    email={email}
                    isUpdatingPassword={isUpdatingPassword}
                    onNewPasswordChange={onNewPasswordChange}
                    onConfirmPasswordChange={onConfirmPasswordChange}
                    onUpdatePassword={onUpdatePassword}
                  />
                )}

                {tab === "danger" && (
                  <DangerSection
                    onDeleteAccount={onDeleteAccount}
                    hasActiveSubscription={hasActiveSubscription}
                  />
                )}
              </section>
            </div>
          </div>

          <DesktopFooter
            justSaved={justSaved}
            isDirty={isDirty}
            isSaving={isSaving}
            onSave={onSave}
            onDone={requestClose}
          />

          <MobileMenu
            activeTab={tab}
            hidden={mobilePage !== "menu"}
            onMobilePageChange={onMobilePageChange}
            onTabChange={onTabChange}
          />

          <MobileSubpage
            tab={tab}
            mobilePage={mobilePage}
            avatarUrl={avatarUrl}
            firstName={firstName}
            lastName={lastName}
            title={title}
            company={company}
            contact={contact}
            about={about}
            phone={phone}
            email={email}
            hasActiveSubscription={hasActiveSubscription}
            errors={errors}
            preferencesError={preferencesError}
            preferencesLoading={preferencesLoading}
            retryPreferences={retryPreferences}
            marketingOptIn={marketingOptIn}
            newsletterOptIn={newsletterOptIn}
            newPassword={newPassword}
            confirmPassword={confirmPassword}
            isUploadingAvatar={isUploadingAvatar}
            onAvatarFileSelected={onAvatarFileSelected}
            onFirstNameChange={onFirstNameChange}
            onLastNameChange={onLastNameChange}
            onTitleChange={onTitleChange}
            onCompanyChange={onCompanyChange}
            onContactChange={onContactChange}
            onAboutChange={onAboutChange}
            onPhoneChange={onPhoneChange}
            onMarketingOptInChange={onMarketingOptInChange}
            onNewsletterOptInChange={onNewsletterOptInChange}
            onNewPasswordChange={onNewPasswordChange}
            onConfirmPasswordChange={onConfirmPasswordChange}
            onDeleteAccount={onDeleteAccount}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
