"use client"

import { useEffect, useRef, useState } from "react"
import { useInView } from "motion/react"
import { z } from "zod"
import { readImageResponse } from "../lib/particle-image"
import { htmlToMarkdown } from "@/lib/markdown/convert"
import {
  particleDocumentEndpoint,
  particleDocumentOriginal,
} from "../lib/particle-library-document"
import type { ParticleDocument } from "../lib/particle-file"

export function useParticleFileUrl(
  workspaceId: string,
  file: ParticleDocument,
  expanded: boolean
) {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { margin: "200px" })
  const active = inView || expanded
  const [url, setUrl] = useState<string | null>(null)
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const endpoint = particleDocumentEndpoint(workspaceId, file)
  const roadmap = file.source?.kind === "roadmap"
  useEffect(() => {
    if (!active || !endpoint) return
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    let current = true
    setUrl(null)
    setText(null)
    setError(null)
    void fetch(endpoint, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(readImageResponse)
      .then((body) => {
        if (roadmap) {
          const result = z
            .object({
              detail: z.object({
                contentHtml: z.string().max(1_000_000).nullable(),
              }),
            })
            .parse(body)
          if (current) setText(htmlToMarkdown(result.detail.contentHtml ?? ""))
          return
        }
        const result = z
          .object({ url: z.url({ protocol: /^https?$/ }) })
          .parse(body)
        if (current) setUrl(result.url)
      })
      .catch(() => {
        if (current) setError("Could not load this file. Try again.")
      })
      .finally(() => clearTimeout(timeout))
    return () => {
      current = false
      clearTimeout(timeout)
      controller.abort()
    }
  }, [active, endpoint, roadmap, attempt])
  return {
    ref,
    active,
    url: particleDocumentOriginal(file) ?? url,
    text,
    error,
    retry: () => setAttempt((value) => value + 1),
  }
}
