import { AiUsageSettings } from "@/features/ai-credits/client"
import { PersonalMemorySettings } from "@/features/workspace-ai/client"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { PublicProfileSettings } from "@/features/public-profiles/client"
import {
  CommunicationsSection,
  DangerSection,
  DesktopFooter,
  ProfileSection,
  SecuritySection,
} from "./sections/desktop-sections"
import { SideLink } from "./sections/section-helpers"
import { MobileMenu, MobileSubpage, TAB_LABELS } from "./sections/mobile-sections"
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
          "h-[92vh] w-full max-w-none overflow-hidden p-0 top-auto bottom-0 left-1/2 translate-x-[-50%] translate-y-0 rounded-t-2xl sm:w-[min(1120px,96%)] sm:max-w-[1120px] sm:rounded-lg sm:top-1/2 sm:bottom-auto sm:translate-y-[-50%]",
          mobilePage !== "menu"
            ? "[&_[data-slot=dialog-close]]:hidden md:[&_[data-slot=dialog-close]]:block"
            : undefined,
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
                  className="h-auto px-1 text-sm text-muted-foreground"
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
                  className="h-auto px-1 text-sm text-primary disabled:opacity-50"
                  onClick={
                    (mobilePage === "public-profile" || mobilePage === "usage" || mobilePage === "memory") ? requestClose : onSave
                  }
                  disabled={
                    (mobilePage === "public-profile" || mobilePage === "usage" || mobilePage === "memory")
                      ? false
                      : !isDirty || isSaving
                  }
                >
                  {(mobilePage === "public-profile" || mobilePage === "usage" || mobilePage === "memory")
                    ? "Done"
                    : isSaving
                      ? "Saving…"
                      : "Save"}
                </Button>
              </div>
            )}
          </div>

          <div className={cn("grow min-h-0 md:flex", tab === "memory" && mobilePage === "memory" ? "flex" : "hidden")}>
            <aside className="hidden w-[240px] shrink-0 border-r p-4 md:block md:p-6">
              <nav className="grid gap-1">
                <SideLink
                  label="Profile"
                  active={tab === "profile"}
                  onClick={() => onTabChange("profile")}
                />
                <SideLink
                  label="Public profile"
                  active={tab === "public-profile"}
                  onClick={() => onTabChange("public-profile")}
                />
                <SideLink
                  label="Communications"
                  active={tab === "communications"}
                  onClick={() => onTabChange("communications")}
                />
                <SideLink label="Usage & billing" active={tab === "usage"} onClick={() => onTabChange("usage")} />
                <SideLink label="Memory" active={tab === "memory"} onClick={() => onTabChange("memory")} />
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
            <div className="flex grow min-h-0">
              <section className="w-full min-h-0 overflow-y-auto p-4 md:p-6">
                {tab === "profile" && (
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
                    onAvatarFileSelected={onAvatarFileSelected}
                    onFirstNameChange={onFirstNameChange}
                    onLastNameChange={onLastNameChange}
                    onTitleChange={onTitleChange}
                    onCompanyChange={onCompanyChange}
                    onContactChange={onContactChange}
                    onAboutChange={onAboutChange}
                    onPhoneChange={onPhoneChange}
                  />
                )}

                {tab === "public-profile" && (
                  <PublicProfileSettings
                    avatarUrl={avatarUrl}
                    displayName={[firstName, lastName].filter(Boolean).join(" ")}
                    headline={title}
                    idPrefix="desktop-public-profile"
                  />
                )}

                {tab === "communications" && (
                  <CommunicationsSection
                    marketingOptIn={marketingOptIn}
                    newsletterOptIn={newsletterOptIn}
                    onMarketingOptInChange={onMarketingOptInChange}
                    onNewsletterOptInChange={onNewsletterOptInChange}
                  />
                )}

                {tab === "usage" && <AiUsageSettings />}
                {tab === "memory" && <PersonalMemorySettings />}

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
            selfManaged={tab === "public-profile" || tab === "usage" || tab === "memory"}
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

          {tab !== "memory" && <MobileSubpage
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
          />}
        </div>
      </DialogContent>
    </Dialog>
  )
}
