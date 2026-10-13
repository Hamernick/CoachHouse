import { Badge } from "@/components/ui/badge"

const labels: Record<string, string> = {
  queued: "Queued", retrying: "Sending / retrying", accepted: "Sent · delivery unconfirmed",
  send_failed: "Sending stopped", "email.sent": "Sent · delivery unconfirmed",
  "email.delivered": "Delivered", "email.delivery_delayed": "Delivery delayed",
  "email.bounced": "Bounced", "email.complained": "Marked as spam",
  "email.failed": "Delivery failed", "email.suppressed": "Suppressed",
}

export function FiscalGuestEmailStatus({ deliveries }: {
  deliveries?: { recipient: string; status: string; queuedAt: string; occurredAt: string | null }[] | null
}) {
  if (!deliveries?.length) return null
  return (
    <section aria-label="Latest application emails" className="rounded-2xl border border-border/60 p-4">
      <h2 className="text-sm font-medium">Latest emails</h2>
      <ul className="mt-2 space-y-2">
        {deliveries.map((delivery) => <li key={delivery.recipient} className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>{delivery.recipient}</span>
          <Badge variant="outline">{labels[delivery.status] ?? "Status unavailable"}</Badge>
        </li>)}
      </ul>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">Delivered means accepted by the recipient’s mail server. It does not confirm they read it. Reload to check for updates.</p>
    </section>
  )
}
