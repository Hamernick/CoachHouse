import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle"
import MessageCircle from "lucide-react/dist/esm/icons/message-circle"
import Sparkles from "lucide-react/dist/esm/icons/sparkles"
import type { NotificationItem } from "./types"

export function NotificationToneIcon({ tone }: { tone?: NotificationItem["tone"] }) {
  const Icon = tone === "warning" ? AlertTriangle : tone === "success" ? MessageCircle : Sparkles
  return (
    <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-background text-muted-foreground ring-1 ring-border/60">
      <Icon className="size-4" />
    </span>
  )
}
