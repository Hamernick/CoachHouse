"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  useAccountSettingsDraft,
  useAccountSettingsDrafts,
  useSharedAccountDraft,
} from "@/components/account-settings/account-settings-drafts"
import { savePublicProfileDetailsAction } from "@/actions/public-profile-settings"
import { toast } from "@/lib/toast"

type Details = { bio: string; location: string; website: string }
const EMPTY: Details = { bio: "", location: "", website: "" }
export function PublicProfileDetailsFields({
  profile,
  disabled,
  idPrefix,
}: {
  profile: {
    bio: string | null
    location_label: string | null
    website_url: string | null
  } | null
  disabled: boolean
  idPrefix: string
}) {
  const coordinator = useAccountSettingsDrafts()
  const [state, setState] = useSharedAccountDraft<{
    saved: Details
    draft: Details
  } | null>("public-details", null)
  const saved = state?.saved ?? EMPTY
  const draft = state?.draft ?? EMPTY
  const setDraft = (draft: Details) => setState({ saved, draft })
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    const next = {
      bio: profile?.bio ?? "",
      location: profile?.location_label ?? "",
      website: profile?.website_url ?? "",
    }
    if (!state && profile) setState({ saved: next, draft: next })
  }, [profile, state, setState])
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  async function save() {
    if (disabled)
      throw new Error("Claim a username before saving public details.")
    setSaving(true)
    try {
      const result = await savePublicProfileDetailsAction(draft)
      if (!result.ok) throw new Error(result.error)
      setState({ saved: draft, draft })
    } finally {
      setSaving(false)
    }
  }
  useAccountSettingsDraft(dirty, save, "public-details")
  return (
    <fieldset disabled={disabled || saving} className="grid gap-4">
      <legend className="mb-2 text-sm font-medium">Public details</legend>
      <p className="text-muted-foreground text-xs">
        These appear when your profile is published. Private contact details
        stay private.
      </p>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-bio`}>Public bio</Label>
        <Textarea
          id={`${idPrefix}-bio`}
          maxLength={500}
          value={draft.bio}
          onChange={(event) => setDraft({ ...draft, bio: event.target.value })}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-location`}>Public location</Label>
          <Input
            id={`${idPrefix}-location`}
            maxLength={120}
            placeholder="City or region"
            value={draft.location}
            onChange={(event) =>
              setDraft({ ...draft, location: event.target.value })
            }
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-website`}>Website</Label>
          <Input
            id={`${idPrefix}-website`}
            type="url"
            maxLength={500}
            placeholder="https://example.org"
            value={draft.website}
            onChange={(event) =>
              setDraft({ ...draft, website: event.target.value })
            }
          />
        </div>
      </div>
      {!coordinator ? (
        <Button
          type="button"
          disabled={!dirty || saving}
          onClick={() =>
            void save().catch((error: Error) => toast.error(error.message))
          }
        >
          Save public details
        </Button>
      ) : null}
    </fieldset>
  )
}
