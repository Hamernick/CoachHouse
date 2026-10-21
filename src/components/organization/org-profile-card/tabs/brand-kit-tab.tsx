"use client"

import {
  hasWorkspaceBrandKitProfileContent,
  WorkspaceBrandKitProfilePreview,
} from "@/features/workspace-brand-kit"

import { BrandKitSection } from "./company-tab/edit-sections/brand-kit"
import type { CompanyEditProps } from "./company-tab/types"

type BrandKitTabProps = Pick<
  CompanyEditProps,
  "company" | "errors" | "onUpdate" | "onDirty" | "onAutoSave"
> & { editMode: boolean }

export function BrandKitTab({ editMode, ...props }: BrandKitTabProps) {
  return (
    <div key={editMode ? "edit" : "view"} className="animate-in fade-in duration-150 motion-reduce:animate-none">
      {editMode ? (
        <BrandKitSection {...props} />
      ) : hasWorkspaceBrandKitProfileContent(props.company) ? (
        <WorkspaceBrandKitProfilePreview profile={props.company} />
      ) : (
        <p className="text-muted-foreground text-center text-sm">No brand assets yet.</p>
      )}
    </div>
  )
}
