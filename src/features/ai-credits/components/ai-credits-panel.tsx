import type { AiCreditAccount } from "../types"
import { aiCreditBalance } from "../lib"

export function AiCreditsPanel({ account }: { account: AiCreditAccount }) {
  const balance = aiCreditBalance(account)
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p><strong className="tabular-nums">{balance.available.toLocaleString()}</strong> credits available</p>
      <dl className="grid grid-cols-2 gap-2 text-muted-foreground">
        <dt>Included</dt><dd className="text-right tabular-nums">{balance.included.toLocaleString()}</dd>
        <dt>Purchased</dt><dd className="text-right tabular-nums">{balance.purchased.toLocaleString()}</dd>
        <dt>Reserved</dt><dd className="text-right tabular-nums">{balance.reserved.toLocaleString()}</dd>
      </dl>
      {account.history.length ? <ul className="flex max-h-52 flex-col gap-2 overflow-auto" aria-label="Your AI usage">
        {account.history.map(run => <li key={run.id} className="flex justify-between gap-3 border-t border-border/60 pt-2 text-xs">
          <span>{new Date(run.created_at).toLocaleString()} · {run.status}</span>
          <span className="shrink-0 tabular-nums">{run.charged_credits === null ? `${run.max_credits} reserved` : `${run.charged_credits} credits`}</span>
        </li>)}
      </ul> : null}
    </div>
  )
}
