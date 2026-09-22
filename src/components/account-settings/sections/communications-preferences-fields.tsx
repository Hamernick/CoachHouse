import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

type CommunicationsPreferencesFieldsProps = {
  preferencesError: string | null
  preferencesLoading: boolean
  retryPreferences: () => void
  marketingOptIn: boolean
  newsletterOptIn: boolean
  onMarketingOptInChange: (value: boolean) => void
  onNewsletterOptInChange: (value: boolean) => void
  idPrefix?: string
}

export function CommunicationsPreferencesFields({
  preferencesError,
  preferencesLoading,
  retryPreferences,
  marketingOptIn,
  newsletterOptIn,
  onMarketingOptInChange,
  onNewsletterOptInChange,
  idPrefix = "communications",
}: CommunicationsPreferencesFieldsProps) {
  const marketingId = `${idPrefix}-marketing`
  const newsletterId = `${idPrefix}-newsletter`

  return (
    <div className="grid max-w-xl gap-4">
      {preferencesError ? (
        <div role="alert" className="space-y-2 text-sm">
          <p>{preferencesError}</p>
          <Button variant="outline" size="sm" onClick={retryPreferences}>
            Try again
          </Button>
        </div>
      ) : null}
      {preferencesLoading ? (
        <p role="status" className="text-sm">
          Loading email preferences…
        </p>
      ) : null}
      <div className="flex items-start gap-3 rounded-md border p-3">
        <Checkbox
          id={marketingId}
          className="mt-0.5"
          disabled={preferencesLoading || Boolean(preferencesError)}
          checked={marketingOptIn}
          onCheckedChange={(checked) =>
            onMarketingOptInChange(checked === true)
          }
        />
        <div>
          <Label htmlFor={marketingId} className="text-sm font-medium">
            Product communication
          </Label>
          <p className="text-muted-foreground text-sm">
            Updates about new features, tips, and offers.
          </p>
        </div>
      </div>
      <div className="flex items-start gap-3 rounded-md border p-3">
        <Checkbox
          id={newsletterId}
          className="mt-0.5"
          disabled={preferencesLoading || Boolean(preferencesError)}
          checked={newsletterOptIn}
          onCheckedChange={(checked) =>
            onNewsletterOptInChange(checked === true)
          }
        />
        <div>
          <Label htmlFor={newsletterId} className="text-sm font-medium">
            Weekly newsletter
          </Label>
          <p className="text-muted-foreground text-sm">
            Curated resources and Coach House news.
          </p>
        </div>
      </div>
    </div>
  )
}
