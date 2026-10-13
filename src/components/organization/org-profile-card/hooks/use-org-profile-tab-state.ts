import { useCallback, useEffect, useState } from "react"

import { ORG_PROFILE_TABS } from "@/components/organization/org-profile-card/config"
import type { ProfileTab } from "@/components/organization/org-profile-card/types"

const ACTIVE_TAB_STORAGE_KEY = "myorg.activeTab"

type UseOrgProfileTabStateArgs = {
  initialTab?: ProfileTab
  navigationRequestId?: number
}

export function useOrgProfileTabState({
  initialTab,
  navigationRequestId,
}: UseOrgProfileTabStateArgs) {
  const [tab, setTab] = useState<ProfileTab>(() =>
    initialTab && ORG_PROFILE_TABS.some((option) => option.value === initialTab)
      ? initialTab
      : "company"
  )

  const handleTabChange = useCallback((value: string) => {
    if (!ORG_PROFILE_TABS.some((option) => option.value === value)) return
    setTab(value as ProfileTab)
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, value)
      }
    } catch {
      // ignore storage failures
    }
  }, [])

  useEffect(() => {
    try {
      if (typeof window === "undefined") return
      if (
        initialTab &&
        ORG_PROFILE_TABS.some((option) => option.value === initialTab)
      ) {
        setTab(initialTab)
        window.localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, initialTab)
        return
      }
      const stored = window.localStorage.getItem(
        ACTIVE_TAB_STORAGE_KEY
      ) as ProfileTab | null
      if (
        stored &&
        ORG_PROFILE_TABS.some((option) => option.value === stored)
      ) {
        setTab(stored)
      }
    } catch {
      // ignore
    }
  }, [initialTab, navigationRequestId])

  return {
    tab,
    setTab,
    handleTabChange,
  }
}
