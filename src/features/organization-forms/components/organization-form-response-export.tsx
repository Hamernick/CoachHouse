"use client"
import { useEffect, useRef, useState } from "react"
import DownloadIcon from "lucide-react/dist/esm/icons/download"
import LoaderIcon from "lucide-react/dist/esm/icons/loader-circle"
import { Button } from "@/components/ui/button"
import { FORM_RESPONSE_EXPORT_LIMIT } from "../lib/form-response-export"

export function OrganizationFormResponseExport({ versionId, before, disabled, onPending, onDenied }: {
  versionId: string; before?: string; disabled: boolean; onPending: (pending: boolean) => void; onDenied: (message: string) => void
}) {
  const active = useRef<AbortController | null>(null)
  const [pending, setPending] = useState(false); const [message, setMessage] = useState(""); const [failed, setFailed] = useState(false)
  useEffect(() => () => { active.current?.abort(); active.current = null }, [versionId, before])
  async function download() {
    if (active.current || disabled) return
    const controller = new AbortController(); active.current = controller
    setPending(true); onPending(true); setMessage(""); setFailed(false)
    const timer = setTimeout(() => controller.abort(), 15_000)
    try {
      const query = new URLSearchParams({ versionId, ...(before ? { before } : {}) })
      const response = await fetch(`/api/forms/responses/export?${query}`, { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      if ([401, 403].includes(response.status)) { onDenied("Response access is no longer available."); return }
      if (response.status === 413) { setFailed(true); setMessage("This page is too large to export."); return }
      if (!response.ok || response.headers.get("content-type")?.split(";")[0] !== "text/csv") throw new Error("Export failed")
      const blob = await response.blob()
      if (blob.size > FORM_RESPONSE_EXPORT_LIMIT) throw new Error("Export too large")
      if (controller.signal.aborted || active.current !== controller) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url; link.download = `responses-${versionId}-${before ?? "latest"}.csv`
      document.body.appendChild(link); link.click(); link.remove()
      // Retire the request-local copy after the browser starts its download.
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMessage("Page download started.")
    } catch {
      if (active.current === controller) { setFailed(true); setMessage("Unable to export this page. Try again.") }
    } finally {
      clearTimeout(timer)
      if (active.current === controller) { active.current = null; setPending(false); onPending(false) }
    }
  }
  return <div className="flex min-w-0 flex-col gap-1">
    <Button type="button" variant="outline" className="min-h-11 self-start rounded-xl" disabled={disabled || pending} onClick={() => void download()}>
      {pending ? <LoaderIcon aria-hidden className="animate-spin motion-reduce:animate-none" /> : <DownloadIcon aria-hidden />}Export page (CSV)
    </Button>
    <p className="text-muted-foreground text-xs">Current page only, up to 50 responses. Uses the latest saved answers.</p>
    {message && <p role={failed ? "alert" : "status"} className="text-sm">{message}</p>}
  </div>
}
