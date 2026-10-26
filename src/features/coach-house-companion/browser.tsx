"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { CoachHouseCompanionPanel } from "./components"
import type { CompanionProposal, CompanionSnapshot, CompanionTransport } from "./types"

const browserTransport: CompanionTransport = async (name, args) => {
  const response = await fetch("/api/companion/sandbox", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, arguments: args }), cache: "no-store" })
  const result = await response.json()
  if (!response.ok) throw Object.assign(new Error(result.error ?? "Could not save. Retry or reload saved work."), { code: result.code })
  return result
}

export function CompanionBrowser() {
  const [snapshot, setSnapshot] = useState<CompanionSnapshot | null>(null)
  const [proposal, setProposal] = useState<CompanionProposal | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const loading = useRef(false)
  async function load() {
    if (loading.current) return
    loading.current = true
    setError(null)
    try {
      const response = await fetch("/api/companion/sandbox", { cache: "no-store" })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setSnapshot(result.snapshot)
      if (new URLSearchParams(window.location.search).get("example") === "review") {
        const preview = await browserTransport("companion_review_document", {
          organizationId: result.snapshot.organization.id,
          content: "We connect young people with local mentors and practical opportunities so they can build a confident, independent future.",
        })
        setProposal(preview.proposal)
      } else setProposal(undefined)
    } catch (value) { setError(value instanceof Error ? value.message : "Could not open the sandbox") }
    finally { loading.current = false }
  }
  useEffect(() => { void load() }, [])
  async function reset() {
    if (snapshot && !window.confirm("Start a new sandbox? This disconnects the current sandbox session.")) return
    setBusy(true)
    try {
      const response = await fetch("/api/companion/sandbox", { method: "DELETE" })
      if (!response.ok) throw new Error("Could not reset the sandbox. Your saved work is still available; retry shortly.")
      setSnapshot(null)
      await load()
    } catch (value) { setError(value instanceof Error ? value.message : "Could not reset the sandbox") }
    finally { setBusy(false) }
  }
  return <main className="min-h-screen bg-background px-4 py-6 text-foreground">
    <div className="mx-auto max-w-2xl">
      {error ? <Alert variant="destructive"><AlertTitle>Sandbox Unavailable</AlertTitle><AlertDescription>{error}</AlertDescription>
        <div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => void load()}>Retry Connection</Button><Button variant="outline" disabled={busy} onClick={() => void reset()}>Start New Sandbox</Button></div>
      </Alert> : snapshot ? <CoachHouseCompanionPanel key={snapshot.organization.id} initialSnapshot={snapshot} proposal={proposal} transport={browserTransport} /> :
        <div role="status" aria-label="Opening Companion" className="flex flex-col gap-4"><Skeleton className="h-8 w-56" /><Skeleton className="h-64 w-full" /></div>}
      <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <p>Local Plugin Preview</p>
        <Button variant="ghost" size="sm" disabled={busy || (!snapshot && !error)} onClick={() => void reset()}>Start New Sandbox</Button>
      </footer>
    </div>
  </main>
}
