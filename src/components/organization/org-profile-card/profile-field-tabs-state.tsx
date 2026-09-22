"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import type { OrgProfileErrors } from "./types"

const ProfileFieldTabsContext = createContext<{
  selections: Record<string, string>
  select: (group: string, field: string) => void
  focusKey?: string | null
  firstError?: string
  validationAttempt: number
  errors: OrgProfileErrors
} | null>(null)

export function ProfileFieldTabsProvider({
  children,
  focusKey,
  errors,
  validationAttempt = 0,
}: {
  children: ReactNode
  focusKey?: string | null
  errors: OrgProfileErrors
  validationAttempt?: number
}) {
  const [selections, setSelections] = useState<Record<string, string>>({})
  const select = useCallback((group: string, field: string) => {
    setSelections((current) =>
      current[group] === field ? current : { ...current, [group]: field }
    )
  }, [])
  const firstError = Object.entries(errors).find(([, message]) =>
    Boolean(message)
  )?.[0]
  const value = useMemo(
    () => ({
      selections,
      select,
      focusKey,
      firstError,
      errors,
      validationAttempt,
    }),
    [selections, select, focusKey, firstError, errors, validationAttempt]
  )
  return (
    <ProfileFieldTabsContext.Provider value={value}>
      {children}
    </ProfileFieldTabsContext.Provider>
  )
}

export function useProfileFieldTabsState() {
  return useContext(ProfileFieldTabsContext)
}
