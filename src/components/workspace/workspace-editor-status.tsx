"use client"

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

export type WorkspaceEditorReport = {
  label: string
  dirty: boolean
  pending?: boolean
  error?: boolean
  draft?: boolean
}
export function summarizeWorkspaceEditors(
  reports: readonly WorkspaceEditorReport[]
) {
  const outstanding = reports.filter(
    (report) => report.dirty || report.pending || report.error || report.draft
  )
  const state = outstanding.some((report) => report.error)
    ? "error"
    : outstanding.some((report) => report.pending)
      ? "saving"
      : outstanding.some((report) => report.dirty)
        ? "dirty"
        : outstanding.some((report) => report.draft)
          ? "draft"
          : "clean"
  const labels = [...new Set(outstanding.map((report) => report.label))].join(
    ", "
  )
  const text =
    state === "error"
      ? `Changes need attention: ${labels}`
      : state === "saving"
        ? `Saving: ${labels}`
        : state === "dirty"
          ? `Unsaved changes: ${labels}`
          : state === "draft"
            ? `Not yet added: ${labels}`
            : ""
  return { outstanding: outstanding.length > 0, state, text }
}
const ReportContext = createContext<
  ((id: string, report: WorkspaceEditorReport | null) => void) | null
>(null)
const StatusContext = createContext(summarizeWorkspaceEditors([]))

export function WorkspaceEditorStatusProvider({
  children,
}: {
  children: ReactNode
}) {
  const [reports, setReports] = useState<
    ReadonlyMap<string, WorkspaceEditorReport>
  >(new Map())
  const report = useCallback(
    (id: string, value: WorkspaceEditorReport | null) => {
      setReports((current) => {
        const previous = current.get(id)
        if (!value && !previous) return current
        if (
          value &&
          previous &&
          JSON.stringify(value) === JSON.stringify(previous)
        )
          return current
        const next = new Map(current)
        if (value) next.set(id, value)
        else next.delete(id)
        return next
      })
    },
    []
  )
  const status = useMemo(
    () => summarizeWorkspaceEditors([...reports.values()]),
    [reports]
  )
  return (
    <ReportContext.Provider value={report}>
      <StatusContext.Provider value={status}>{children}</StatusContext.Provider>
    </ReportContext.Provider>
  )
}

// Editors remain the source of truth. Retained/inactive panels keep reporting;
// an editor outside a content window needs no provider and behaves unchanged.
export function useWorkspaceEditorStatus({
  label,
  dirty,
  pending = false,
  error = false,
  draft = false,
}: WorkspaceEditorReport) {
  const report = useContext(ReportContext)
  const id = useId()
  useLayoutEffect(() => {
    report?.(id, { label, dirty, pending, error, draft })
  }, [report, id, label, dirty, pending, error, draft])
  useLayoutEffect(() => () => report?.(id, null), [report, id])
}
export const useWorkspaceWindowStatus = () => useContext(StatusContext)
