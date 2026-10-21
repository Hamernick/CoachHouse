"use client"

import { WorkspaceBrandKitProfileEditor } from "@/features/workspace-brand-kit"
import type { CompanyEditProps } from "./company-tab/types"

type BrandKitTabProps = Pick<CompanyEditProps, "company" | "errors" | "onUpdate" | "onDirty" | "onAutoSave"> & {
  editMode: boolean
  onBusyChange?: (busy: boolean) => void
}

export function BrandKitTab({ editMode, company, errors, onUpdate, onDirty, onAutoSave, onBusyChange }: BrandKitTabProps) {
  return <WorkspaceBrandKitProfileEditor profile={company} errors={errors} readOnly={!editMode}
    onBusyChange={onBusyChange} onAutoSave={onAutoSave}
    onChange={(updates) => { onUpdate(updates); onDirty() }} />
}
