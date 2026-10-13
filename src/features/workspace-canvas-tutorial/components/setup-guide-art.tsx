import CheckIcon from "lucide-react/dist/esm/icons/check"
import { cn } from "@/lib/utils"
import type { SetupGuideEvidence } from "../lib/setup-guide"

export function SetupGuideArt() {
  return <div aria-hidden="true" className="aspect-[5/2] w-full overflow-hidden bg-sky-100 dark:bg-sky-950" style={{ maxHeight: "min(152px, calc(var(--setup-guide-available-height, 100dvh) * 0.32))", backgroundImage: "radial-gradient(ellipse at 10% 100%, #b7a3fa80, transparent 65%), radial-gradient(ellipse at 90% 0%, #65d9f6a0, transparent 75%)" }} />
}

export function SetupGuideSummary({ evidence }: { evidence: SetupGuideEvidence }) {
  const rows = [
    { label: "Organization profile", detail: evidence.name?.trim() || "Add your details", complete: Boolean(evidence.name?.trim()) },
    { label: "Programs", detail: evidence.programCount ? `${evidence.programCount} saved` : "Ready when you are", complete: evidence.programCount > 0 },
    { label: "Public profile", detail: evidence.isPublic ? "Published" : "Private — your choice", complete: evidence.isPublic === true },
  ]
  return <ul className="divide-y rounded-xl border px-4">{rows.map((row) => <li key={row.label} className="flex items-center gap-3 py-3"><span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full", row.complete ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground")}>{row.complete ? <CheckIcon className="size-4" aria-hidden /> : <span className="size-1.5 rounded-full bg-current" />}</span><span className="min-w-0 text-sm"><span className="block font-medium">{row.label}</span><span className="block truncate text-xs text-muted-foreground">{row.detail}</span></span></li>)}</ul>
}
