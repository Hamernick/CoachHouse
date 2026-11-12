"use client"

import { ParticleMenu } from "@/components/ui/particle-ui"

const statuses = [
  { value: "backlog", label: "Not started", tone: "var(--muted-foreground)" },
  { value: "in_progress", label: "In progress", tone: "var(--planning-active)" },
  { value: "blocked", label: "Blocked", tone: "var(--planning-blocked)" },
  { value: "done", label: "Complete", tone: "var(--planning-complete)" },
] as const

type ObjectiveStatus = typeof statuses[number]["value"]

export function ObjectiveStatusMenu({ value, disabled, onChange, completionLabel = "Confirm outcome" }: {
  completionLabel?: string
  value: string
  disabled: boolean
  onChange: (status: ObjectiveStatus) => void
}) {
  const current = statuses.find(status => status.value === value)
  return <ParticleMenu.Sub>
    <ParticleMenu.SubTrigger disabled={disabled} className="gap-2">
      <span className="flex min-w-0 items-center gap-1.5">
        <span aria-hidden className="flex size-4 shrink-0 items-center justify-center"><span className="size-2 rounded-full" style={{ backgroundColor: current?.tone ?? "var(--muted-foreground)" }} /></span>
        <span>Status</span>
      </span>
    </ParticleMenu.SubTrigger>
    <><ParticleMenu.SubContent minWidth={0} width={224}>
      <ParticleMenu.RadioGroup value={value} onChange={next => {
        const status = statuses.find(item => item.value === next)
        if (status && !disabled && status.value !== value) onChange(status.value)
      }}>
        {statuses.map(status => <ParticleMenu.RadioItem key={status.value} value={status.value} disabled={disabled}>
          <span className="flex min-w-0 items-center gap-2">
            <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: status.tone }} />
            <span>{status.value === "done" ? completionLabel : status.label}</span>
          </span>

        </ParticleMenu.RadioItem>)}
      </ParticleMenu.RadioGroup>
    </ParticleMenu.SubContent></>
  </ParticleMenu.Sub>
}
