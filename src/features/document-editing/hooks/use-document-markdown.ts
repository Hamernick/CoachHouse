"use client"

import { useEffect, useState } from "react"
import type { JSONContent } from "@tiptap/core"
import type { DocumentSnapshot } from "../types"
import type { MarkdownWorkerResult } from "../lib/document-editing.worker"

export function useDocumentMarkdown(snapshot: DocumentSnapshot, active: boolean): {
  key: string; document: JSONContent | null; loading: boolean; reason?: string
} {
  const source = snapshot.source
  const fileId = source.provider === "coach_house" ? source.fileId : source.attachmentId
  const key = `${source.provider}:${source.organizationId}:${fileId}:${snapshot.revision}`
  const [parsed, setParsed] = useState<{ key: string; document: JSONContent | null; reason?: string } | null>(null)
  useEffect(() => {
    if (!active || parsed?.key === key) return
    let current = true
    let worker: Worker | undefined
    const timeout = setTimeout(() => {
      worker?.terminate()
      if (current) setParsed({ key, document: null, reason: "Rich view timed out. The complete source is available." })
    }, 15000)
    try {
      worker = new Worker(new URL("../lib/document-editing.worker.ts", import.meta.url), { type: "module" })
      worker.onmessage = (event: MessageEvent<MarkdownWorkerResult>) => {
        clearTimeout(timeout)
        worker?.terminate()
        if (!current) return
        setParsed(event.data.kind === "ready"
          ? { key, document: event.data.document }
          : { key, document: null, reason: event.data.reason })
      }
      worker.onerror = () => {
        clearTimeout(timeout)
        worker?.terminate()
        if (current) setParsed({ key, document: null, reason: "The complete source is available." })
      }
      worker.postMessage({ content: snapshot.content })
    } catch {
      clearTimeout(timeout)
      setParsed({ key, document: null, reason: "The complete source is available." })
    }
    return () => { current = false; clearTimeout(timeout); worker?.terminate() }
  }, [active, key, snapshot.content, parsed?.key])
  return parsed?.key === key ? { ...parsed, loading: false } : { key, document: null, loading: true }
}
