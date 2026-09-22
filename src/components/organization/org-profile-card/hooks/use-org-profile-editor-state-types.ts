import type { ChangeEvent, MutableRefObject } from "react"

import type {
  OrgProfile,
  OrgProfileCardProps,
  OrgProfileErrors,
  OrgProgram,
  ProfileTab,
  SlugStatus,
} from "../types"

export type UseOrgProfileEditorStateArgs = {
  initial: OrgProfileCardProps["initial"]
  programs: OrgProgram[]
  canEdit: boolean
  initialTab: OrgProfileCardProps["initialTab"]
  initialProgramId: OrgProfileCardProps["initialProgramId"]
  initialEditMode: OrgProfileCardProps["initialEditMode"]
}

export type UseOrgProfileEditorStateResult = {
  tab: ProfileTab
  handleTabChange: (value: string) => void
  editMode: boolean
  setEditMode: (next: boolean) => void
  isPending: boolean
  dirty: boolean
  company: OrgProfile
  errors: OrgProfileErrors
  validationAttempt: number
  slugStatus: SlugStatus
  setSlugStatus: (next: SlugStatus) => void
  editProgram: OrgProgram | null
  editOpen: boolean
  setEditOpen: (next: boolean) => void
  confirmDiscardOpen: boolean
  setConfirmDiscardOpen: (next: boolean) => void
  currentTabLabel: string
  publicLink: string | null
  handleInputChange: (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void
  handleCompanyUpdate: (updates: Partial<OrgProfile>) => void
  markDirty: () => void
  persistProfileUpdates: (updates: Partial<OrgProfile>) => Promise<void>
  handleSave: () => void
  handleProgramEdit: (program: OrgProgram) => void
  handleCancelEdit: () => void
  handleDiscardConfirm: () => void
  pendingNavigationRef: MutableRefObject<string | null>
}
