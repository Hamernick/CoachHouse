import { CommunicationsPreferencesFields } from "@/components/account-settings/sections/communications-preferences-fields"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GoogleAccountConnection } from "@/features/google-auth"
import type {
  AccountSettingsErrorKey,
  AccountSettingsMobilePage,
  AccountSettingsTabKey,
} from "../types"
import { ProfileSection } from "./profile-section"

export const TAB_LABELS: Record<AccountSettingsTabKey, string> = {
  profile: "Profile",
  communications: "Communications",
  security: "Security",
  danger: "Danger zone",
}

export const MOBILE_LINKS: Array<{
  key: AccountSettingsTabKey
  description?: string
}> = [
  { key: "profile", description: "Details, public page, collections" },
  { key: "communications", description: "Emails & notifications" },
  { key: "security", description: "Sign-in methods, password" },
  { key: "danger", description: "Delete account" },
]

export function MobileMenu({
  activeTab,
  hidden,
  onMobilePageChange,
  onTabChange,
}: {
  activeTab: AccountSettingsTabKey
  hidden: boolean
  onMobilePageChange: (page: AccountSettingsMobilePage) => void
  onTabChange: (tab: AccountSettingsTabKey) => void
}) {
  return (
    <div className="min-h-0 grow overflow-y-auto p-2 md:hidden" hidden={hidden}>
      <div className="text-muted-foreground px-2 pt-2 text-xs font-semibold">
        Account
      </div>
      <div className="bg-card/60 mt-2 rounded-xl border">
        {MOBILE_LINKS.map((link, index) => (
          <Button
            key={link.key}
            type="button"
            variant="ghost"
            className={
              "h-auto w-full justify-between gap-4 rounded-none px-4 py-3 text-left text-sm whitespace-normal " +
              (index < MOBILE_LINKS.length - 1 ? "border-b" : "")
            }
            onClick={() => {
              onTabChange(link.key)
              onMobilePageChange(link.key)
            }}
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                {TAB_LABELS[link.key]}
              </span>
              {link.description ? (
                <span className="text-muted-foreground text-xs">
                  {link.description}
                </span>
              ) : null}
            </div>
            <span
              className={
                activeTab === link.key
                  ? "text-primary text-xs tracking-wide uppercase"
                  : "text-muted-foreground text-xs tracking-wide uppercase"
              }
            >
              Manage
            </span>
          </Button>
        ))}
      </div>
    </div>
  )
}

export function MobileSubpage({
  tab,
  mobilePage,
  avatarUrl,
  firstName,
  lastName,
  title,
  company,
  contact,
  about,
  phone,
  email,
  hasActiveSubscription,
  errors,
  preferencesError,
  preferencesLoading,
  retryPreferences,
  marketingOptIn,
  newsletterOptIn,
  newPassword,
  confirmPassword,
  isUploadingAvatar,
  onAvatarFileSelected,
  onFirstNameChange,
  onLastNameChange,
  onTitleChange,
  onCompanyChange,
  onContactChange,
  onAboutChange,
  onPhoneChange,
  onMarketingOptInChange,
  onNewsletterOptInChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onDeleteAccount,
}: {
  tab: AccountSettingsTabKey
  mobilePage: AccountSettingsMobilePage
  avatarUrl: string | null
  firstName: string
  lastName: string
  title: string
  company: string
  contact: string
  about: string
  phone: string
  email: string
  hasActiveSubscription: boolean
  errors: Partial<Record<AccountSettingsErrorKey, string>>
  preferencesError: string | null
  preferencesLoading: boolean
  retryPreferences: () => void
  marketingOptIn: boolean
  newsletterOptIn: boolean
  newPassword: string
  confirmPassword: string
  isUploadingAvatar: boolean
  onAvatarFileSelected: (file?: File | null) => void
  onFirstNameChange: (value: string) => void
  onLastNameChange: (value: string) => void
  onTitleChange: (value: string) => void
  onCompanyChange: (value: string) => void
  onContactChange: (value: string) => void
  onAboutChange: (value: string) => void
  onPhoneChange: (value: string) => void
  onMarketingOptInChange: (value: boolean) => void
  onNewsletterOptInChange: (value: boolean) => void
  onNewPasswordChange: (value: string) => void
  onConfirmPasswordChange: (value: string) => void
  onDeleteAccount: () => void
}) {
  return (
    <div
      className="min-h-0 grow overflow-y-auto p-4 md:hidden"
      hidden={mobilePage === "menu"}
    >
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
          idPrefix="mobile-profile"
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
        <div className="space-y-6">
          <header>
            <h3 className="text-muted-foreground text-sm font-semibold">
              Communications
            </h3>
          </header>
          <CommunicationsPreferencesFields
            idPrefix="mobile-communications"
            preferencesError={preferencesError}
            preferencesLoading={preferencesLoading}
            retryPreferences={retryPreferences}
            marketingOptIn={marketingOptIn}
            newsletterOptIn={newsletterOptIn}
            onMarketingOptInChange={onMarketingOptInChange}
            onNewsletterOptInChange={onNewsletterOptInChange}
          />
        </div>
      )}

      {tab === "security" && (
        <div className="space-y-6">
          <header>
            <h3 className="text-muted-foreground text-sm font-semibold">
              Security
            </h3>
          </header>
          <GoogleAccountConnection email={email} viewport="mobile" />
          <div className="grid max-w-xl gap-4">
            <h4 className="font-medium">Password</h4>
            <div className="grid gap-2">
              <Label htmlFor="m-newPassword">New password</Label>
              <Input
                id="m-newPassword"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) =>
                  onNewPasswordChange(event.currentTarget.value)
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="m-confirmPassword">Confirm password</Label>
              <Input
                id="m-confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) =>
                  onConfirmPasswordChange(event.currentTarget.value)
                }
              />
            </div>
          </div>
        </div>
      )}

      {tab === "danger" && (
        <div className="space-y-6">
          <header>
            <h3 className="text-destructive text-sm font-semibold">
              Danger zone
            </h3>
          </header>
          <div className="border-destructive/30 bg-destructive/5 rounded-md border p-4">
            <p className="text-sm">
              This action is permanent and cannot be undone.
            </p>
            {hasActiveSubscription ? (
              <p className="text-muted-foreground mt-2 text-sm">
                Deleting your account does not cancel Stripe billing. Cancel in
                the billing portal first, or continue after cancellation if your
                access remains active through the paid period.
              </p>
            ) : null}
            <div className="mt-3">
              <Button variant="destructive" onClick={onDeleteAccount}>
                Delete my account
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
