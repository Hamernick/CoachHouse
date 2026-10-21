"use client"

import { useId } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldMessage,
} from "@/components/ui/field"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@/components/ui/select"
import {
  CALENDAR_CHANNELS,
  CALENDAR_STATUSES,
  type CalendarEntry,
  type CalendarActivity,
} from "../lib/particle-calendar"
import { particleCalendarEntrySchema } from "../lib/particle-schema"
import { ParticleCalendarDateField } from "./particle-calendar-date-field"
import { useParticleSurface } from "./particle-surface"

function CalendarChoice<Value extends string>({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string
  value: Value
  options: ReadonlyArray<{ value: Value; label: string }>
  disabled: boolean
  onChange: (value: Value) => void
}) {
  const id = useId()
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(next) => {
          const option = options.find((item) => item.value === next)
          if (option) onChange(option.value)
        }}
      >
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  )
}

export function ParticleCalendarEntryFields({
  entry,
  activities,
  disabled,
  onChange,
}: {
  entry: CalendarEntry
  activities: readonly CalendarActivity[]
  disabled: boolean
  onChange: (entry: CalendarEntry) => void
}) {
  const id = useId()
  const surface = useParticleSurface()
  const parsed = particleCalendarEntrySchema.safeParse(entry)
  const error = (field: string) =>
    parsed.success
      ? undefined
      : parsed.error.issues.find((issue) => issue.path[0] === field)?.message
  const knownActivity =
    !entry.activityId ||
    activities.some((activity) => activity.id === entry.activityId)
  return (
    <FieldGroup {...surface()}>
      <Field data-invalid={Boolean(error("title"))}>
        <FieldLabel htmlFor={`${id}-title`}>Entry title</FieldLabel>
        <Input
          id={`${id}-title`}
          value={entry.title}
          maxLength={240}
          required
          disabled={disabled}
          aria-invalid={Boolean(error("title"))}
          aria-describedby={error("title") ? `${id}-title-error` : undefined}
          onChange={(event) =>
            onChange({ ...entry, title: event.target.value })
          }
        />
        {error("title") ? (
          <FieldMessage id={`${id}-title-error`}>{error("title")}</FieldMessage>
        ) : null}
      </Field>
      <fieldset className="space-y-2" disabled={disabled}>
        <legend className="text-sm font-medium">Channels</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {CALENDAR_CHANNELS.map((channel) => (
            <label
              key={channel.value}
              className="flex min-h-11 items-center gap-2 text-sm"
            >
              <Checkbox
                checked={entry.channels.includes(channel.value)}
                onCheckedChange={(checked) =>
                  onChange({
                    ...entry,
                    channels:
                      checked === true
                        ? [...new Set([...entry.channels, channel.value])]
                        : entry.channels.filter(
                            (value) => value !== channel.value
                          ),
                  })
                }
              />
              {channel.label}
            </label>
          ))}
        </div>
        {error("channels") ? (
          <FieldMessage>Select at least one channel.</FieldMessage>
        ) : null}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <CalendarChoice
          label="Content type"
          value={entry.contentType}
          disabled={disabled}
          options={[
            { value: "post", label: "Post" },
            { value: "newsletter", label: "Newsletter" },
            { value: "article", label: "Article" },
            { value: "email", label: "Email" },
          ]}
          onChange={(contentType) => onChange({ ...entry, contentType })}
        />
        <CalendarChoice
          label="Delivery"
          value={entry.delivery}
          disabled={disabled}
          options={[
            { value: "manual", label: "Manual" },
            { value: "automatic", label: "Automatic" },
          ]}
          onChange={(delivery) => onChange({ ...entry, delivery })}
        />
        <CalendarChoice
          label="Entry status"
          value={entry.status}
          options={CALENDAR_STATUSES}
          disabled={disabled}
          onChange={(status) => onChange({ ...entry, status })}
        />
        <CalendarChoice
          label="Linked Activity"
          value={entry.activityId ?? "none"}
          disabled={disabled}
          options={[
            { value: "none", label: "None" },
            ...activities.map((activity) => ({
              value: activity.id,
              label: activity.title,
            })),
            ...(!knownActivity && entry.activityId
              ? [{ value: entry.activityId, label: "Unavailable activity" }]
              : []),
          ]}
          onChange={(activityId) =>
            onChange({
              ...entry,
              activityId: activityId === "none" ? undefined : activityId,
            })
          }
        />
      </div>
      <ParticleCalendarDateField
        label="Scheduled for"
        value={entry.scheduledAt}
        disabled={disabled}
        onChange={(scheduledAt) => onChange({ ...entry, scheduledAt })}
      />
      <Field>
        <FieldLabel htmlFor={`${id}-content`}>Draft content</FieldLabel>
        <Textarea
          id={`${id}-content`}
          value={entry.content}
          maxLength={10000}
          disabled={disabled}
          rows={6}
          onChange={(event) =>
            onChange({ ...entry, content: event.target.value })
          }
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-cta`}>Call to action</FieldLabel>
        <Input
          id={`${id}-cta`}
          value={entry.cta}
          maxLength={500}
          disabled={disabled}
          onChange={(event) => onChange({ ...entry, cta: event.target.value })}
        />
      </Field>
      <Field data-invalid={Boolean(error("externalUrl"))}>
        <FieldLabel htmlFor={`${id}-url`}>External URL</FieldLabel>
        <Input
          id={`${id}-url`}
          type="url"
          value={entry.externalUrl ?? ""}
          disabled={disabled}
          aria-invalid={Boolean(error("externalUrl"))}
          aria-describedby={
            error("externalUrl") ? `${id}-url-error` : undefined
          }
          onChange={(event) =>
            onChange({ ...entry, externalUrl: event.target.value || undefined })
          }
        />
        {error("externalUrl") ? (
          <FieldMessage id={`${id}-url-error`}>
            Use an http or https URL.
          </FieldMessage>
        ) : null}
      </Field>
      {entry.status === "published" || entry.publishedAt ? (
        <>
          <ParticleCalendarDateField
            label="Actual publish time"
            value={entry.publishedAt}
            required={entry.status === "published"}
            disabled={disabled}
            onChange={(publishedAt) => onChange({ ...entry, publishedAt })}
          />
          {error("publishedAt") ? (
            <FieldMessage>{error("publishedAt")}</FieldMessage>
          ) : null}
        </>
      ) : null}
      <p className="text-muted-foreground text-xs">
        Saving entries does not send or publish content. Automatic delivery
        requires a connected provider.
      </p>
    </FieldGroup>
  )
}
