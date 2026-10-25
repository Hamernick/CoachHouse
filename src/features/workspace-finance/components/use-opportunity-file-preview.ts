"use client"
import { useEffect, useState } from "react"
import { z } from "zod"

export function useOpportunityFilePreview(open: boolean, organizationId: string | undefined, fileId: string | null) {
  const [state, setState] = useState<{ url: string | null; loading: boolean; error: string | null }>({ url: null, loading: false, error: null })
  useEffect(() => {
    if (!open || !organizationId || !fileId) return
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    let active = true
    setState({ url: null, loading: true, error: null })
    const query = new URLSearchParams({ organizationId, expectedOrganizationId: organizationId, id: fileId })
    void fetch(`/api/account/organization-document-files?${query}`, { signal: controller.signal, cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error("File unavailable")
      const { url } = z.object({ url: z.url({ protocol: /^https?$/ }) }).parse(await response.json())
      if (active) setState({ url, loading: false, error: null })
    }).catch(() => { if (active) setState({ url: null, loading: false, error: "This file couldn’t be opened. Reopen the preview to retry." }) }).finally(() => clearTimeout(timer))
    return () => { active = false; clearTimeout(timer); controller.abort() }
  }, [open, organizationId, fileId])
  return state
}
