"use client"

import { useSyncExternalStore } from "react"
import { CheckCircle2Icon, CircleIcon, RefreshCwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import type { CompanionSession } from "../hooks/use-companion-session"
import { CompanionCalendar } from "./companion-calendar"

const subscribe = () => () => {}
function ReceiptTime({ at }: { at: string }) {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false)
  return <time className="text-xs text-muted-foreground" dateTime={at}>{hydrated ? new Date(at).toLocaleString() : at}</time>
}

export function CompanionReceipt({ session }: { session: CompanionSession }) {
  const { snapshot } = session
  const results = [
    { label: "Answers", detail: `Saved revision ${snapshot.draft.revision}`, saved: snapshot.draft.revision > 0 },
    { label: "Document", detail: `Saved revision ${snapshot.document.revision}`, saved: snapshot.document.revision > 0 },
    { label: "Assignment", detail: snapshot.submission.status === "submitted" ? "Submitted" : "Not submitted", saved: snapshot.submission.status === "submitted" },
    { label: "Lesson", detail: snapshot.submission.completed ? "Completed in sandbox" : "Not completed", saved: snapshot.submission.completed },
  ]
  return <section className="flex flex-col gap-8">
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2"><h2 className="text-xl font-semibold tracking-tight">Your work, accounted for.</h2><p className="text-sm text-muted-foreground">These are the saved sandbox results. Each action stands on its own.</p></div>
        <Button variant="ghost" disabled={Boolean(session.pending)} onClick={() => void session.refresh()}><RefreshCwIcon data-icon="inline-start" />Refresh saved state</Button>
      </div>
      <dl className="grid gap-4 sm:grid-cols-2">
        {results.map((result) => <div key={result.label} className="flex items-start gap-3">
          {result.saved ? <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <CircleIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
          <div><dt className="text-sm font-medium">{result.label}</dt><dd className="mt-1 text-sm text-muted-foreground">{result.detail}</dd></div>
        </div>)}
      </dl>
      {snapshot.receipts.length > 0 && <details className="text-sm"><summary className="cursor-pointer py-3 font-medium focus-visible:outline-2 focus-visible:outline-offset-2">View saved activity ({snapshot.receipts.length})</summary><ol className="mt-3 flex flex-col gap-3">{snapshot.receipts.slice(-10).reverse().map((receipt) => <li key={receipt.id} className="flex flex-col gap-1"><p>{receipt.message}</p><ReceiptTime at={receipt.at} /></li>)}</ol></details>}
    </div>
    <Separator />
    <CompanionCalendar session={session} />
  </section>
}
