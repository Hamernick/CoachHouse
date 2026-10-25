"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

import type { WorkspaceBrandKitProfileEditorProps } from "./workspace-brand-kit-profile-editor-types"

const ATTRIBUTE_FIELDS = [
  {
    name: "brandVoiceAudience",
    label: "Audience",
    placeholder: "Community leaders, funders, and partner organizations",
  },
  {
    name: "brandVoiceTone",
    label: "Tone",
    placeholder: "Warm, practical, and encouraging",
  },
  {
    name: "brandVoiceStyle",
    label: "Style",
    placeholder: "Clear, direct, and community-first",
  },
  {
    name: "brandVoicePersonality",
    label: "Personality",
    placeholder: "A trusted guide in your corner",
  },
] as const

function ErrorMessage({ id, error }: { id: string; error?: string }) {
  if (!error) return null
  return (
    <p id={`${id}-error`} className="text-destructive text-xs">
      {error}
    </p>
  )
}

export function WorkspaceBrandKitProfileVoice({
  hideAudience = false,
  profile,
  errors,
  onChange,
}: Pick<
  WorkspaceBrandKitProfileEditorProps,
  "profile" | "errors" | "onChange"
> & { hideAudience?: boolean }) {
  return (
    <section className="space-y-3">
      <div>
        <h4 className="text-foreground text-sm font-semibold text-balance">
          Brand voice
        </h4>
        <p className="text-muted-foreground mt-1 text-xs text-pretty">
          Define how your organization should sound across channels.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {ATTRIBUTE_FIELDS.filter(field => !hideAudience || field.name !== "brandVoiceAudience").map((field) => {
          const error = errors[field.name]
          return (
            <div key={field.name} className="grid gap-2">
              <Label htmlFor={field.name}>{field.label}</Label>
              <Input
                id={field.name}
                name={field.name}
                value={profile[field.name] ?? ""}
                maxLength={240}
                placeholder={field.placeholder}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? `${field.name}-error` : undefined}
                onChange={(event) =>
                  onChange({ [field.name]: event.currentTarget.value })
                }
              />
              <ErrorMessage id={field.name} error={error} />
            </div>
          )
        })}
      </div>

      <div className="grid gap-3">
        <div className="grid gap-2">
          <Label htmlFor="brandVoiceGuidelines">Guidelines</Label>
          <Textarea
            id="brandVoiceGuidelines"
            name="brandVoiceGuidelines"
            rows={6}
            maxLength={5000}
            value={profile.brandVoiceGuidelines ?? ""}
            placeholder="Explain the language, framing, and vocabulary your team should use."
            aria-invalid={Boolean(errors.brandVoiceGuidelines)}
            aria-describedby={
              errors.brandVoiceGuidelines
                ? "brandVoiceGuidelines-error"
                : undefined
            }
            onChange={(event) =>
              onChange({ brandVoiceGuidelines: event.currentTarget.value })
            }
          />
          <ErrorMessage
            id="brandVoiceGuidelines"
            error={errors.brandVoiceGuidelines}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="brandVoiceAvoid">Avoid</Label>
          <Textarea
            id="brandVoiceAvoid"
            name="brandVoiceAvoid"
            rows={4}
            maxLength={5000}
            value={profile.brandVoiceAvoid ?? ""}
            placeholder="Add one phrase or pattern per line that the team should avoid."
            aria-invalid={Boolean(errors.brandVoiceAvoid)}
            aria-describedby={
              errors.brandVoiceAvoid ? "brandVoiceAvoid-error" : undefined
            }
            onChange={(event) =>
              onChange({ brandVoiceAvoid: event.currentTarget.value })
            }
          />
          <ErrorMessage id="brandVoiceAvoid" error={errors.brandVoiceAvoid} />
        </div>
      </div>
    </section>
  )
}
