"use client"

import { WorkspaceBrandKitProfileEditor } from "@/features/workspace-brand-kit"
import type { CompanyEditProps } from "./company-tab/types"

type BrandKitTabProps = Pick<CompanyEditProps, "company" | "errors" | "onUpdate" | "onDirty" | "onAutoSave"> & {
  canEdit: boolean
  onBusyChange?: (busy: boolean) => void
}

export function BrandKitTab({ canEdit, company, errors, onUpdate, onDirty, onAutoSave, onBusyChange }: BrandKitTabProps) {
  return <WorkspaceBrandKitProfileEditor profile={company} errors={errors} readOnly={!canEdit} inlineEdit
    onBusyChange={onBusyChange} onAutoSave={onAutoSave}
    onChange={(updates) => { onUpdate(updates); onDirty() }} />
}
