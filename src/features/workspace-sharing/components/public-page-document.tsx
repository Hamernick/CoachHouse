"use client"

import { useEffect, useId, useState } from "react"
import FileTextIcon from "lucide-react/dist/esm/icons/file-text"
import { Button } from "@/components/ui/button"

type Reading = { status: "loading" } | { status: "ready"; text: string } | { status: "failed" }

/** Text is deliberately inert, including Markdown links, HTML and CSV formulas.
 * Closing clears the copy; reopening requests a fresh audience check. */
export function PublicPageDocument({ src, name }: { src: string; name: string }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [reading, setReading] = useState<Reading>({ status: "loading" })
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    async function read() {
      try {
        const response = await fetch(src, { cache: "no-store", credentials: "same-origin", signal: controller.signal })
        if (!response.ok || !response.headers.get("content-type")?.startsWith("text/plain")) throw new Error("Unavailable")
        const text = await response.text()
        if (!controller.signal.aborted) setReading({ status: "ready", text })
      } catch { if (!controller.signal.aborted) setReading({ status: "failed" }) }
    }
    void read()
    return () => controller.abort()
  }, [src, open, attempt])
  return <div className="flex min-w-0 flex-col gap-3">
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <FileTextIcon className="text-muted-foreground size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 break-words text-sm">{name}</span>
      <Button type="button" variant="outline" className="h-auto min-h-11 max-w-full shrink-0 whitespace-normal break-words rounded-full shadow-none"
        aria-expanded={open} aria-controls={id} onClick={() => { setReading({ status: "loading" }); setOpen(!open) }}>
        {open ? "Close document" : "Read document"}
      </Button>
    </div>
    <div id={id} hidden={!open}>
      {open && reading.status === "loading" && <p className="text-muted-foreground text-sm" role="status">Loading document…</p>}
      {open && reading.status === "failed" && <div className="flex flex-wrap items-center gap-2">
        <p className="text-muted-foreground text-sm" role="status">Document unavailable.</p>
        <Button type="button" variant="outline" className="min-h-11" onClick={() => { setReading({ status: "loading" }); setAttempt(attempt + 1) }}>Retry</Button>
      </div>}
      {open && reading.status === "ready" && <div className="flex min-w-0 flex-col gap-2">
        <p className="text-muted-foreground text-xs">Read-only text</p>
        <pre tabIndex={0} role="region" aria-label={`${name} contents`} className="focus-ring max-h-96 overflow-y-auto overscroll-contain whitespace-pre-wrap break-words rounded-xl bg-muted p-3 font-sans text-sm leading-relaxed">{reading.text}</pre>
      </div>}
    </div>
  </div>
}
