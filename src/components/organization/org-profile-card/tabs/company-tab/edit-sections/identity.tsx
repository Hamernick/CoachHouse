"use client"

import styles from "../../../profile-edit-fields.module.css"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

import {
  FormRow,
  ProfileField,
} from "@/components/organization/org-profile-card/shared"
import type { CompanyEditProps } from "../types"

export function IdentitySection({
  company,
  errors,
  onInputChange,
  onUpdate,
  onDirty,
}: CompanyEditProps) {
  return (
    <FormRow
      layout="stacked"
      inset={false}
      title="Identity"
      description="Basic details that represent your organization."
    >
      <div className={styles.group}>
        <ProfileField label="Organization name" focusKey="name" hideLabel>
          <Input
            id="name"
            name="name"
            value={company.name ?? ""}
            onChange={onInputChange}
            aria-invalid={Boolean(errors.name)}
            placeholder="Organization name"
          />
          {errors.name ? (
            <p className="text-destructive text-xs">{errors.name}</p>
          ) : null}
        </ProfileField>
        <ProfileField label="Tagline" focusKey="tagline" hideLabel>
          <Input
            id="tagline"
            name="tagline"
            value={company.tagline ?? ""}
            onChange={onInputChange}
            aria-invalid={Boolean(errors.tagline)}
            placeholder="Tagline"
          />
          {errors.tagline ? (
            <p className="text-destructive text-xs">{errors.tagline}</p>
          ) : null}
        </ProfileField>
        <ProfileField label="Description" focusKey="description">
          <Textarea
            id="description"
            name="description"
            value={company.description ?? ""}
            onChange={onInputChange}
            rows={3}
            aria-invalid={Boolean(errors.description)}
            placeholder="We partner with schools to deliver after-school STEM labs and mentorship for middle school students."
          />
          {errors.description ? (
            <p className="text-destructive text-xs">{errors.description}</p>
          ) : null}
        </ProfileField>
        <ProfileField label="Formation status" focusKey="formationStatus">
          <Select
            value={company.formationStatus || "in_progress"}
            onValueChange={(value) => {
              if (
                value !== "pre_501c3" &&
                value !== "in_progress" &&
                value !== "approved"
              )
                return
              onUpdate({ formationStatus: value })
              onDirty()
            }}
          >
            <SelectTrigger
              id="formationStatus"
              data-tour="org-formation-status"
              className="bg-background"
            >
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pre_501c3">Pre-501(c)(3)</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
            </SelectContent>
          </Select>
        </ProfileField>
        {company.formationStatus === "approved" ? (
          <ProfileField label="EIN" focusKey="ein">
            <Input
              id="ein"
              name="ein"
              required
              aria-describedby={errors.ein ? "ein-hint ein-error" : "ein-hint"}
              value={company.ein ?? ""}
              onChange={onInputChange}
              aria-invalid={Boolean(errors.ein)}
              placeholder="12-3456789"
            />
            {errors.ein ? (
              <p
                id="ein-error"
                role="alert"
                className="text-destructive text-xs"
              >
                {errors.ein}
              </p>
            ) : null}
            <p id="ein-hint" className="text-muted-foreground text-xs">
              Format: 12-3456789
            </p>
          </ProfileField>
        ) : null}
      </div>
    </FormRow>
  )
}
