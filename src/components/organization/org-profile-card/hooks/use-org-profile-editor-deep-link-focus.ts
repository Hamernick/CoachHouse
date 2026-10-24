"use client"

import { useEffect, type RefObject } from "react"

import type { ProfileTab } from "../types"
import { useOrganizationDeepLinkFocus } from "../organization-deep-link-focus"

export function useOrgProfileEditorDeepLinkFocus({
  canEdit,
  editMode,
  focusKey,
  requestId,
  rootRef,
  setEditMode,
  tab,
}: {
  canEdit: boolean
  editMode: boolean
  focusKey?: string | null
  requestId?: number
  rootRef: RefObject<HTMLElement | null>
  setEditMode: (next: boolean) => void
  tab: ProfileTab
}) {
  useEffect(() => {
    if (!focusKey?.trim() || (tab !== "company" && tab !== "brand-kit") || !canEdit || editMode) return
    setEditMode(true)
  }, [canEdit, editMode, focusKey, setEditMode, tab])

  useOrganizationDeepLinkFocus({
    enabled: (tab === "company" || tab === "brand-kit") && (!canEdit || editMode),
    focusKey,
    requestId,
    rootRef,
  })
}
