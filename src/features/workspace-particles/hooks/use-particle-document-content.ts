"use client"
import { useEffect, useState } from "react"
import {
  documentContentSchema,
  type DocumentContent,
} from "../lib/particle-document-content"
import type { ParticleDocument } from "../lib/particle-file"
import { MAX_BYTES } from "@/lib/organization/document-storage"
import { z } from "zod"

export function useParticleDocumentContent(
  url: string,
  format: ParticleDocument["format"]
) {
  const [content, setContent] = useState<DocumentContent | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (["pdf", "doc", "image", "link", "roadmap"].includes(format)) return
    const controller = new AbortController()
    let worker: Worker | undefined
    let active = true
    const timeout = setTimeout(() => {
      controller.abort()
      worker?.terminate()
      if (active) setError("Preview timed out. Try again or open the original.")
    }, 15000)
    setContent(null)
    setError(null)
    void (async () => {
      const response = await fetch(url, { signal: controller.signal })
      if (!response.ok) throw new Error("File unavailable. Reload its preview.")
      // Bound downloaded bytes even if a replaced object reports a larger size.
      const reader = response.body?.getReader()
      if (!reader) throw new Error("File stream unavailable.")
      const chunks: Uint8Array[] = []
      let size = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > MAX_BYTES) {
          await reader.cancel()
          throw new Error("This file is too large to preview.")
        }
        chunks.push(value)
      }
      if (!active || controller.signal.aborted) return
      const bytes = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) {
        bytes.set(chunk, offset)
        offset += chunk.length
      }
      worker = new Worker(
        new URL("../lib/particle-document.worker.ts", import.meta.url),
        { type: "module" }
      )
      worker.onmessage = (event: MessageEvent<unknown>) => {
        clearTimeout(timeout)
        worker?.terminate()
        if (!active) return
        const parsed = z
          .object({ content: documentContentSchema })
          .safeParse(event.data)
        if (parsed.success) setContent(parsed.data.content)
        else
          setError(
            "This document could not be previewed. Open the original or try another file."
          )
      }
      worker.onerror = () => {
        clearTimeout(timeout)
        worker?.terminate()
        if (active)
          setError("Preview unavailable. Try again or open the original.")
      }
      worker.postMessage({ format, buffer: bytes.buffer }, [bytes.buffer])
    })().catch((reason: unknown) => {
      clearTimeout(timeout)
      if (active)
        setError(
          reason instanceof Error ? reason.message : "Preview unavailable."
        )
    })
    return () => {
      active = false
      clearTimeout(timeout)
      controller.abort()
      worker?.terminate()
    }
  }, [url, format])
  return { content, error }
}
