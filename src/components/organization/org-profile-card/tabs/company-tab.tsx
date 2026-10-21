"use client"

import { useMemo } from "react"

import type { OrgProfile, OrgProfileErrors } from "../types"
import { buildAddressLines } from "../utils"
import { EditModeSections } from "./company-tab/edit-sections"
import { ViewModeSections } from "./company-tab/display-sections"
import type { CompanyEditProps, CompanyViewProps } from "./company-tab/types"

export type CompanyTabProps = {
  company: OrgProfile
  errors: OrgProfileErrors
  editMode: boolean
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
    ],
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
      <div key="edit" className="animate-in fade-in duration-150 motion-reduce:animate-none">
        <EditModeSections {...editProps} />
      </div>
    )
  }

  const viewProps: CompanyViewProps = {
    company,
    addressLines,
  }

  return (
    <div key="view" className="animate-in fade-in duration-150 motion-reduce:animate-none">
      <ViewModeSections {...viewProps} />
    </div>
  )
}
