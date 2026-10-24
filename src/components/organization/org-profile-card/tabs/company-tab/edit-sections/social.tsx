"use client"

import { Input } from "@/components/ui/input"
import {
  FormRow,
  ProfileField,
} from "@/components/organization/org-profile-card/shared"
import { OrganizationSocialBrandIcon } from "../../../social-brand-icon"
import styles from "../../../profile-edit-fields.module.css"
import type { CompanyEditProps } from "../types"

const SOCIAL_FIELDS = [
  {
    name: "twitter",
    label: "X (Twitter)",
    placeholder: "https://x.com/yourhandle",
  },
  {
    name: "facebook",
    label: "Facebook",
    placeholder: "https://facebook.com/yourpage",
  },
  {
    name: "linkedin",
    label: "LinkedIn",
    placeholder: "https://linkedin.com/company/yourorg",
  },
  {
    name: "instagram",
    label: "Instagram",
    placeholder: "https://instagram.com/yourorg",
  },
  {
    name: "youtube",
    label: "YouTube",
    placeholder: "https://youtube.com/@yourorg",
  },
  {
    name: "tiktok",
    label: "TikTok",
    placeholder: "https://tiktok.com/@yourorg",
  },
  {
    name: "github",
    label: "GitHub",
    placeholder: "https://github.com/yourorg",
  },
] as const

export function SocialSection({
  company,
  errors,
  onInputChange,
}: CompanyEditProps) {
  return (
    <FormRow
      title="Socials"
      description="Share how supporters can follow you."
      layout="stacked"
      inset={false}
    >
      <div className={styles.group}>
        {SOCIAL_FIELDS.map(({ name, label, placeholder }) => (
          <ProfileField
            key={name}
            focusKey={name}
            label={
              <>
                <span className={styles.icon}>
                  <OrganizationSocialBrandIcon platform={name} />
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
              aria-describedby={errors[name] ? `${name}-error` : undefined}
              placeholder={placeholder}
            />
            {errors[name] ? (
              <p id={`${name}-error`} className="text-destructive text-xs">
                {errors[name]}
              </p>
            ) : null}
          </ProfileField>
        ))}
      </div>
    </FormRow>
  )
}
