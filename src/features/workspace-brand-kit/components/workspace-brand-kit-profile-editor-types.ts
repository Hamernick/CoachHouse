import type { OrgProfile } from "@/lib/organization/org-profile-brand-types"

export type WorkspaceBrandKitProfileEditorProps = {
  readOnly?: boolean
  onBusyChange?: (busy: boolean) => void
  profile: OrgProfile
  errors: Record<string, string>
  onChange: (updates: Partial<OrgProfile>) => void
  onAutoSave: (updates: Partial<OrgProfile>) => Promise<void>
}
