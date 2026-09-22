"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

type Draft = { dirty: boolean; save?: () => Promise<void>; group?: string }
type DraftContext = {
  isDirty: boolean
  values: Record<string, unknown>
  setValue: (key: string, value: unknown) => void
  register: (id: string, draft: Draft | null) => void
  saveDrafts: () => Promise<void>
}
const Context = createContext<DraftContext | null>(null)

export function AccountSettingsDraftsProvider({
  children,
}: {
  children: ReactNode
}) {
  const [values, setValues] = useState<Record<string, unknown>>({})
  const setValue = useCallback(
    (key: string, value: unknown) =>
      setValues((current) => ({ ...current, [key]: value })),
    []
  )
  const entries = useRef(new Map<string, Draft>())
  const [isDirty, setIsDirty] = useState(false)
  const register = useCallback((id: string, draft: Draft | null) => {
    if (draft) entries.current.set(id, draft)
    else entries.current.delete(id)
    setIsDirty([...entries.current.values()].some((entry) => entry.dirty))
  }, [])
  const saveDrafts = useCallback(async () => {
    const savedGroups = new Set<string>()
    for (const draft of [...entries.current.values()]) {
      if (
        !draft.dirty ||
        !draft.save ||
        (draft.group && savedGroups.has(draft.group))
      )
        continue
      await draft.save()
      if (draft.group) savedGroups.add(draft.group)
    }
  }, [])
  const value = useMemo(
    () => ({ isDirty, register, saveDrafts, values, setValue }),
    [isDirty, register, saveDrafts, values, setValue]
  )
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useAccountSettingsDrafts() {
  return useContext(Context)
}

export function useAccountSettingsDraft(
  dirty: boolean,
  save?: () => Promise<void>,
  group?: string
) {
  const context = useAccountSettingsDrafts()
  const id = useId()
  const saveRef = useRef(save)
  saveRef.current = save
  const register = context?.register
  const hasSave = Boolean(save)
  useEffect(() => {
    register?.(id, {
      dirty,
      save: hasSave ? () => saveRef.current!() : undefined,
      group,
    })
    return () => register?.(id, null)
  }, [dirty, id, register, hasSave, group])
}

export function useSharedAccountDraft<T>(
  key: string,
  initial: T
): [T, (value: T) => void] {
  const context = useAccountSettingsDrafts()
  const [local, setLocal] = useState(initial)
  const value = context
    ? ((context.values[key] as T | undefined) ?? initial)
    : local
  const setValue = context?.setValue
  const update = useCallback(
    (next: T) => {
      if (setValue) setValue(key, next)
      else setLocal(next)
    },
    [key, setValue]
  )
  return [value, update]
}
