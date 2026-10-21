"use client"

import { PROVIDER_ICON } from "@/components/shared/provider-icons"
import { Input } from "@/components/ui/input"
import {
  FormRow,
  ProfileField,
} from "@/components/organization/org-profile-card/shared"
import styles from "../../../profile-edit-fields.module.css"
import type { CompanyEditProps } from "../types"

const PRESENCE_FIELDS = [
  {
    name: "publicUrl",
    label: "Website",
    icon: PROVIDER_ICON.generic,
    placeholder: "example.org",
    hint: "Your organization’s own website.",
  },
  {
    name: "newsletter",
    label: "Newsletter",
    icon: PROVIDER_ICON.email,
    placeholder: "newsletter.example.org",
    hint: null,
  },
  {
    name: "donateUrl",
    label: "Donation page",
    icon: PROVIDER_ICON.link,
    placeholder: "give.example.org",
    hint: "Adds a Donate button to your public profile and Find listing.",
  },
] as const

export function PresenceSection({
  company,
  errors,
  onInputChange,
}: CompanyEditProps) {
  return (
    <FormRow
      title="Presence"
      description="Primary website, newsletter, and donation page."
      layout="stacked"
      inset={false}
    >
      <div className={styles.group}>
        {PRESENCE_FIELDS.map(
          ({ name, label, icon: Icon, placeholder, hint }) => (
            <ProfileField
              key={name}
              focusKey={name}
              label={
                <>
                  <span className={styles.icon}>
                    <Icon className="size-4" aria-hidden />
                  </span>
                  {label}
                </>
              }
            >
              <Input
                id={name}
                name={name}
                value={company[name] ?? ""}
                onChange={onInputChange}
                aria-invalid={Boolean(errors[name])}
                aria-describedby={
                  errors[name]
                    ? `${name}-error`
                    : hint
                      ? `${name}-hint`
                      : undefined
                }
                placeholder={placeholder}
              />
              {errors[name] ? (
                <p id={`${name}-error`} className="text-destructive text-xs">
                  {errors[name]}
                </p>
              ) : null}
              {hint ? (
                <p
                  id={`${name}-hint`}
                  className="text-muted-foreground text-xs"
                >
                  {hint}
                </p>
              ) : null}
            </ProfileField>
          )
        )}
      </div>
    </FormRow>
  )
}
