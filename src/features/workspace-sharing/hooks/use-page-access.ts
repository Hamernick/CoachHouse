"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { workspacePageAccessAction } from "../access-actions"
import type { PageAccessCommand, PageAccessData } from "../lib/page-access"

/** One request at a time; unknown writes retain their exact operation for retry. */
export function usePageAccess(pageId: string) {
  const [data, setData] = useState<PageAccessData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [signIn, setSignIn] = useState(false)
  const [readVersion, setReadVersion] = useState(0)
  const [editVersion, setEditVersion] = useState(0)
  const [mutationPending, setMutationPending] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const active = useRef(true), busy = useRef(false)
  const retry = useRef<PageAccessCommand | null>(null)
  const send = useCallback(async (command: PageAccessCommand) => {
    if (busy.current || (retry.current && retry.current !== command)) return false
    busy.current = true; setPending(true); setMutationPending(command.action !== "read"); setError(null)
    try {
      const result = await workspacePageAccessAction(command)
      if (!active.current) return false
      if (!result.ok) {
        const unknown = result.uncertain && command.action !== "read"
        retry.current = unknown ? command : null; setUncertain(unknown); setError(result.error)
        if (result.code === "scope") setData(null)
        return false
      }
      retry.current = null; setUncertain(false); setSignIn(result.signInRequired)
      setData(result.signInRequired ? null : result.value)
      if (command.action === "read") setReadVersion((value) => value + 1)
      if (command.action === "edit" && !result.signInRequired) setEditVersion((value) => value + 1)
      return !result.signInRequired
    } catch {
      if (!active.current) return false
      const unknown = command.action !== "read"
      retry.current = unknown ? command : null; setUncertain(unknown)
      setError("Unable to confirm. Retry the same request.")
      return false
    } finally {
      busy.current = false
      if (active.current) { setPending(false); setMutationPending(false) }
    }
  }, [])
  useEffect(() => {
    active.current = true
    void send({ action: "read", pageId })
    return () => { active.current = false }
  }, [pageId, send])
  useEffect(() => {
    if (!mutationPending && !uncertain) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [mutationPending, uncertain])
  return { data, error, pending, signIn, uncertain, readVersion, editVersion, locked: pending || uncertain, send,
    reload: () => send({ action: "read", pageId }),
    retry: () => retry.current ? send(retry.current) : send({ action: "read", pageId }) }
}
export type PageAccessController = ReturnType<typeof usePageAccess>
