"use client"

import { useMemo } from "react"

import { ProfileFieldTabsProvider } from "../profile-field-tabs-state"
import type { OrgProfile, OrgProfileErrors } from "../types"
import { buildAddressLines } from "../utils"
import { EditModeSections } from "./company-tab/edit-sections"
import { ViewModeSections } from "./company-tab/display-sections"
import type { CompanyEditProps, CompanyViewProps } from "./company-tab/types"

export type CompanyTabProps = {
  company: OrgProfile
  errors: OrgProfileErrors
  editMode: boolean
  focusKey?: string | null
  validationAttempt?: number
  onInputChange: CompanyEditProps["onInputChange"]
  onUpdate: CompanyEditProps["onUpdate"]
  onDirty: CompanyEditProps["onDirty"]
  onAutoSave: CompanyEditProps["onAutoSave"]
  slugStatus: CompanyEditProps["slugStatus"]
  setSlugStatus: CompanyEditProps["setSlugStatus"]
}

export function CompanyTab({
  company,
  errors,
  editMode,
  focusKey,
  validationAttempt,
  onInputChange,
  onUpdate,
  onDirty,
  onAutoSave,
  slugStatus,
  setSlugStatus,
}: CompanyTabProps) {
  const addressLines = useMemo(
    () =>
      buildAddressLines({
        street: company.addressStreet,
        city: company.addressCity,
        state: company.addressState,
        postal: company.addressPostal,
        country: company.addressCountry,
        fallback: company.address,
      }),
    [
      company.addressStreet,
      company.addressCity,
      company.addressState,
      company.addressPostal,
      company.addressCountry,
      company.address,
    ]
  )

  const hasAnyBrandLink = useMemo(
    () =>
      [
        company.publicUrl,
        company.newsletter,
        company.twitter,
        company.facebook,
        company.linkedin,
        company.instagram,
        company.youtube,
        company.tiktok,
        company.github,
      ].some((value) => typeof value === "string" && value.trim().length > 0),
    [
      company.publicUrl,
      company.newsletter,
      company.twitter,
      company.facebook,
      company.linkedin,
      company.instagram,
      company.youtube,
      company.tiktok,
      company.github,
    ]
  )

  if (editMode) {
    const editProps: CompanyEditProps = {
      company,
      errors,
      onInputChange,
      onUpdate,
      onDirty,
      onAutoSave,
      slugStatus,
      setSlugStatus,
    }

    return (
      <ProfileFieldTabsProvider
        focusKey={focusKey}
        errors={errors}
        validationAttempt={validationAttempt}
      >
        <EditModeSections {...editProps} />
      </ProfileFieldTabsProvider>
    )
  }

  const viewProps: CompanyViewProps = {
    company,
    addressLines,
    hasAnyBrandLink,
  }

  return (
    <ProfileFieldTabsProvider
      focusKey={focusKey}
      errors={errors}
      validationAttempt={validationAttempt}
    >
      <ViewModeSections {...viewProps} />
    </ProfileFieldTabsProvider>
  )
}
