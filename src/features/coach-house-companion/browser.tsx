"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { CoachHouseCompanionPanel } from "./components"
import type { CompanionSnapshot, CompanionTransport } from "./types"

const browserTransport: CompanionTransport = async (name, args) => {
  const response = await fetch("/api/companion/sandbox", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, arguments: args }), cache: "no-store" })
  const result = await response.json()
  if (!response.ok) throw Object.assign(new Error(result.error ?? "Could not save. Retry or reload saved work."), { code: result.code })
  return result
}

export function CompanionBrowser() {
  const [snapshot, setSnapshot] = useState<CompanionSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function load() {
    setError(null)
    try {
      const response = await fetch("/api/companion/sandbox", { cache: "no-store" })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setSnapshot(result.snapshot)
    } catch (value) { setError(value instanceof Error ? value.message : "Could not open the sandbox") }
  }
  useEffect(() => { void load() }, [])
  async function reset() {
    setBusy(true)
    try {
      await fetch("/api/companion/sandbox", { method: "DELETE" })
      setSnapshot(null)
      await load()
    } finally { setBusy(false) }
  }
  return <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-8 sm:py-10">
    <div className="mx-auto max-w-5xl">
      {error ? <Alert variant="destructive"><AlertTitle>Sandbox Unavailable</AlertTitle><AlertDescription>{error}</AlertDescription>
        <div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => void load()}>Retry Connection</Button><Button variant="outline" disabled={busy} onClick={() => void reset()}>Start New Sandbox</Button></div>
      </Alert> : snapshot ? <CoachHouseCompanionPanel key={snapshot.organization.id} initialSnapshot={snapshot} transport={browserTransport} /> :
        <div role="status" aria-label="Opening Companion" className="flex flex-col gap-4"><Skeleton className="h-8 w-56" /><Skeleton className="h-64 w-full" /></div>}
      <footer className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t pt-4 text-xs text-muted-foreground">
        <p>Local Plugin Preview · Persistent Sandbox · Calendar Export Only</p>
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => void reset()}>Start New Sandbox</Button>
      </footer>
    </div>
  </main>
}
