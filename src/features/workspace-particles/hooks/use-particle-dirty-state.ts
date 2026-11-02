"use client"

import { useCallback, useReducer, useRef } from "react"

/** One guard combines the focused editor and external assignment drafts. */
export function useParticleDirtyState() {
  const dirty = useRef(false)
  const inspector = useRef(false)
  const assignments = useRef(new Set<string>())
  const [assignmentVersion, changedAssignments] = useReducer(value => value + 1, 0)
  const setDirty = useCallback((value: boolean) => {
    inspector.current = value
    dirty.current = value || assignments.current.size > 0
  }, [])
  const assignmentDirtyChange = useCallback((id: string, value: boolean) => {
    const changed = assignments.current.has(id) !== value
    if (value) assignments.current.add(id)
    else assignments.current.delete(id)
    dirty.current = inspector.current || assignments.current.size > 0
    if (changed) changedAssignments()
  }, [])
  const isAssignmentDirty = useCallback((id: string) => assignments.current.has(id), [])
  return { dirty, setDirty, assignmentDirtyChange, isAssignmentDirty, assignmentVersion }
}
