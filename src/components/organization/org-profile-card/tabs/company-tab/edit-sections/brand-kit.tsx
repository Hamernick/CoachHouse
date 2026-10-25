"use client"

import { FormRow } from "@/components/organization/org-profile-card/shared"
import { WorkspaceBrandKitProfileEditor } from "@/features/workspace-brand-kit"

import type { CompanyEditProps } from "../types"

export function BrandKitSection({
  company,
  errors,
  onUpdate,
  onDirty,
  onAutoSave,
}: Pick<CompanyEditProps, "company" | "errors" | "onUpdate" | "onDirty" | "onAutoSave">) {
  return (
    <FormRow
      title="Brand Kit"
      description="Keep your logos, colors, typography, and voice ready for your team."
      focusKey="brand-kit"
    >
      <WorkspaceBrandKitProfileEditor
        profile={company}
        errors={errors}
        onChange={(updates) => {
          onUpdate(updates)
          onDirty()
        }}
        onAutoSave={onAutoSave}
      />
    </FormRow>
  )
}
