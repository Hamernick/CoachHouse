"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { linkFiscalOrganization, searchFiscalOrganizationLink } from "../actions"
import type { FiscalOrganizationCandidate, FiscalOrganizationSearch } from "../lib/organization-link"

export function FiscalGuestOrganizationLink({ projectId, applicantEmail }: { projectId: string; applicantEmail: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [result, setResult] = useState<FiscalOrganizationSearch | null>(null)
  const [selected, setSelected] = useState<FiscalOrganizationCandidate | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [uncertain, setUncertain] = useState(false)
  const request = useRef<{ projectId: string; organizationId: string; requestId: string; version: string } | null>(null)
  useEffect(() => {
    let current = true
    if (selected || uncertain) return
    const timeout = setTimeout(async () => {
      setBusy(true); setError("")
      try {
        const loaded = await searchFiscalOrganizationLink(projectId, open ? query : "")
        if (!current) return
        if ("error" in loaded) { setError(loaded.error ?? "Unable to search organizations."); setResult(null) }
        else setResult(loaded.result)
      } catch {
        if (current) { setError("Unable to search organizations. Try again."); setResult(null) }
      } finally { if (current) setBusy(false) }
    }, 250)
    return () => { clearTimeout(timeout); current = false }
  }, [open, projectId, query, selected, uncertain])
  const save = async () => {
    if (!selected || busy) return
    request.current ??= { projectId, organizationId: selected.organizationId, version: selected.version, requestId: crypto.randomUUID() }
    setBusy(true); setError("")
    try {
      const saved = await linkFiscalOrganization(request.current)
      if ("error" in saved) {
        setError(saved.error ?? "Unable to link organization."); setUncertain("retryable" in saved && saved.retryable === true)
        if (!("retryable" in saved)) { request.current = null; setSelected(null); setResult(null) }
        return
      }
      request.current = null; setUncertain(false); setSelected(null)
      setResult({ candidates: [], linked: saved.linked }); router.refresh()
    } catch {
      setUncertain(true); setError("Couldn’t confirm the link. Retry the same request.")
    } finally { setBusy(false) }
  }
  return <Dialog open={open} onOpenChange={(value) => { if (!busy) setOpen(value) }}>
    <DialogTrigger asChild><Button variant="outline" className="mb-3 max-w-full whitespace-normal">{result?.linked ? `Linked to ${result.linked.name}` : "Link organization"}</Button></DialogTrigger>
    <DialogContent>
      <DialogHeader><DialogTitle>Link organization</DialogTitle><DialogDescription>Connect this application to its organization. Application history and files stay together; existing profile information stays unchanged.</DialogDescription></DialogHeader>
      {result?.linked ? <p role="status" className="text-sm">Linked to {result.linked.name}.</p> : <>
        <p className="text-sm">Application email: <span className="break-all font-medium">{applicantEmail}</span></p>
        {selected ? <div className="space-y-2 text-sm"><p>Link to <strong>{selected.name}</strong>?</p><p className="break-all">Confirmed owner: {selected.ownerEmail}</p><p>The owner and organization editors will be able to view this application and respond to requested corrections.</p></div> : <div className="space-y-2">
          <Label htmlFor="fiscal-organization-search">Organization name or owner email</Label>
          <Input id="fiscal-organization-search" value={query} maxLength={100} onChange={(event) => { setQuery(event.target.value); setResult(null) }} />
          <p className="text-xs text-muted-foreground">Only organizations with a confirmed owner using the application email can be linked.</p>
          {busy && <p role="status" className="text-sm">Searching…</p>}
          {!busy && query.trim().length >= 2 && result && !result.candidates.length && <p className="text-sm">No eligible organization found. Confirm the owner signed up with the application email.</p>}
          {result?.candidates.map((candidate) => <Button key={candidate.organizationId} variant="outline" className="h-auto w-full justify-start whitespace-normal text-left" onClick={() => setSelected(candidate)}>{candidate.name}<span className="break-all text-xs text-muted-foreground">{candidate.ownerEmail}</span></Button>)}
        </div>}
      </>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        {selected && !uncertain && <Button variant="outline" disabled={busy} onClick={() => { request.current = null; setSelected(null) }}>Back</Button>}
        {selected ? <Button disabled={busy} onClick={() => { void save() }}>{busy ? "Linking…" : uncertain ? "Retry link" : "Confirm organization link"}</Button> : <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>}
      </DialogFooter>
    </DialogContent>
  </Dialog>
}
