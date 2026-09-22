import { CommunicationsPreferencesFields } from "@/components/account-settings/sections/communications-preferences-fields"

export function CommunicationsSection({
  preferencesError,
  preferencesLoading,
  retryPreferences,
  marketingOptIn,
  newsletterOptIn,
  onMarketingOptInChange,
  onNewsletterOptInChange,
}: {
  preferencesError: string | null
  preferencesLoading: boolean
  retryPreferences: () => void
  marketingOptIn: boolean
  newsletterOptIn: boolean
  onMarketingOptInChange: (value: boolean) => void
  onNewsletterOptInChange: (value: boolean) => void
}) {
  return (
    <div className="space-y-6">
      <header>
        <h3 className="text-lg font-semibold">Communications</h3>
        <p className="text-muted-foreground text-sm">
          Choose the updates you’d like to receive.
        </p>
      </header>
      <CommunicationsPreferencesFields
        idPrefix="desktop-communications"
        preferencesError={preferencesError}
        preferencesLoading={preferencesLoading}
        retryPreferences={retryPreferences}
        marketingOptIn={marketingOptIn}
        newsletterOptIn={newsletterOptIn}
        onMarketingOptInChange={onMarketingOptInChange}
        onNewsletterOptInChange={onNewsletterOptInChange}
      />
    </div>
  )
}
