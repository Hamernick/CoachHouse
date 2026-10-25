"use client"

import styles from "../../../profile-edit-fields.module.css"

import { Input } from "@/components/ui/input"

import {
  FormRow,
  ProfileField,
} from "@/components/organization/org-profile-card/shared"
import type { CompanyEditProps } from "../types"

export function ContactSection({
  company,
  errors,
  onInputChange,
}: CompanyEditProps) {
  return (
    <FormRow
      layout="stacked"
      inset={false}
      title="Contact"
      description="Primary point of contact and ways to reach you."
    >
      <div className={styles.group}>
        <ProfileField label="Representative" focusKey="rep">
          <Input
            id="rep"
            name="rep"
            value={company.rep ?? ""}
            onChange={onInputChange}
            aria-invalid={Boolean(errors.rep)}
            placeholder="Jordan Lee"
          />
          {errors.rep ? (
            <p className="text-destructive text-xs">{errors.rep}</p>
          ) : null}
        </ProfileField>
        <ProfileField label="Email" focusKey="email">
          <Input
            id="email"
            name="email"
            type="email"
            value={company.email ?? ""}
            onChange={onInputChange}
            aria-invalid={Boolean(errors.email)}
            placeholder="hello@brightfutures.org"
          />
          {errors.email ? (
            <p className="text-destructive text-xs">{errors.email}</p>
          ) : null}
        </ProfileField>
        <ProfileField label="Phone" focusKey="phone">
          <Input
            id="phone"
            name="phone"
            value={company.phone ?? ""}
            onChange={onInputChange}
            aria-invalid={Boolean(errors.phone)}
            placeholder="(555) 123-4567"
          />
          {errors.phone ? (
            <p className="text-destructive text-xs">{errors.phone}</p>
          ) : null}
        </ProfileField>
      </div>
    </FormRow>
  )
}
