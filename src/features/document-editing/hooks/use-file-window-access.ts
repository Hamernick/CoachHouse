"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { subscribeWorkspaceAccessChanged } from "@/lib/workspace/access-events"
import type { createDocumentWindowOwner } from "../lib/window-owner"
import type { createWritableDocumentOwner } from "../lib/writable-owner"

type Reader = ReturnType<typeof createDocumentWindowOwner>
type Writer = ReturnType<typeof createWritableDocumentOwner>

/** Retain authorized drafts on successful focus checks; hide before an explicit
 * invalidation. Uncertain access requires a fresh open, never automatic replay. */
export function useFileWindowAccess(orgId: string, reader: Reader, writer: Writer, active: boolean) {
  const [status, setStatus] = useState<"ready" | "checking" | "locked">("ready")
  const current = useRef({ active, retired: false, check: (_clear: boolean) => {} })
  useEffect(() => {
    const lifecycle = current.current
    let disposed = false
    let epoch = 0
    let request: AbortController | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    const cancel = () => { epoch++; request?.abort(); request = null; clearTimeout(timer) }
    const retire = () => {
      if (disposed || lifecycle.retired) return
      lifecycle.retired = true
      cancel()
      reader.lock()
      writer.setActive(false)
      // close preserves the encrypted recovery draft before releasing its replica.
      // Failed durability leaves the paused owner retained, never visible/exportable.
      void writer.close().catch(() => undefined)
      setStatus("locked")
    }
    const check = (clear: boolean) => {
      if (disposed || lifecycle.retired) return
      if (clear) {
        cancel()
        reader.setActive(false)
        writer.setActive(false)
        setStatus("checking")
      } else if (request) return
      if (!lifecycle.active || document.visibilityState === "hidden") return
      const ticket = ++epoch
      const controller = new AbortController()
      request = controller
      timer = setTimeout(retire, 15_000)
      void reader.revalidate(controller.signal).then(capability => {
        if (disposed || controller.signal.aborted || ticket !== epoch) return
        const writing = !["idle", "error", "locked"].includes(writer.getSnapshot().status)
        if (writing && !capability?.editable) { retire(); return }
        clearTimeout(timer); request = null
        setStatus("ready")
        // Ordinary checks preserve the mounted editor, selection and draft.
        reader.setActive(lifecycle.active && !writing)
        writer.setActive(lifecycle.active)
      }).catch(() => { if (!disposed && !controller.signal.aborted && ticket === epoch) retire() })
    }
    lifecycle.check = check
    const ordinary = () => check(false)
    const invalidate = () => check(true)
    const hidden = () => {
      if (disposed || lifecycle.retired) return
      cancel(); reader.setActive(false); writer.setActive(false); setStatus("checking")
    }
    const visibility = () => document.visibilityState === "hidden" ? hidden() : invalidate()
    const stopReader = reader.subscribe(() => { if (reader.getSnapshot().status === "locked") retire() })
    const stop = subscribeWorkspaceAccessChanged(orgId, invalidate)
    window.addEventListener("focus", ordinary)
    window.addEventListener("online", invalidate)
    window.addEventListener("pageshow", invalidate)
    window.addEventListener("pagehide", hidden)
    document.addEventListener("visibilitychange", visibility)
    if (!lifecycle.active || document.visibilityState === "hidden") hidden()
    return () => {
      disposed = true; cancel(); stop(); stopReader()
      lifecycle.check = () => {}
      window.removeEventListener("focus", ordinary)
      window.removeEventListener("online", invalidate)
      window.removeEventListener("pageshow", invalidate)
      window.removeEventListener("pagehide", hidden)
      document.removeEventListener("visibilitychange", visibility)
    }
  }, [orgId, reader, writer])
  useLayoutEffect(() => {
    if (current.current.active === active) return
    current.current.active = active
    current.current.check(true)
  }, [active])
  return active ? status : "checking"
}
