"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useIsMobile } from "@/hooks/use-mobile"
import { useAiUsage } from "./ai-usage-provider"
import { AiCreditsPanel } from "./ai-credits-panel"

export function AiUsageSettings({ mobile = false }: { mobile?: boolean }) {
  const usage = useAiUsage(), isMobile = useIsMobile()
  if (isMobile !== mobile) return null
  return <section className="mx-auto w-full max-w-3xl space-y-6" aria-label="Usage and billing">
    <header className="space-y-1"><h2 className="text-xl font-medium">Usage &amp; billing</h2><p className="text-sm text-muted-foreground">AI usage for your current workspace.</p></header>
    <div className="flex items-center justify-between gap-4 rounded-2xl border bg-muted/30 p-4">
      <span className="text-sm">Your subscription</span>
      <Button asChild variant="secondary" className="rounded-full font-normal shadow-none"><Link href="/billing">Manage plan</Link></Button>
    </div>
    {usage?.data ? <AiCreditsPanel account={usage.data.account} organizationId={usage.data.organizationId} presentation="settings" /> : <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
      <p role="status">{usage?.error ?? (usage ? "Loading usage…" : "Open your workspace to view AI usage.")}</p>
      {usage?.error && <Button variant="ghost" onClick={usage.refresh}>Retry</Button>}
      {!usage && <Button asChild variant="ghost"><Link href="/workspace">Workspace</Link></Button>}
    </div>}
  </section>
}
