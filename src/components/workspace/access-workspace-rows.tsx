"use client"

import { ParticleSelect as NativeSelect } from "@/components/ui/particle-ui"
import type { AccessData } from "@/lib/workspace/access"

type Rows = NonNullable<AccessData["workspaces"]>
const labels = { view: "View", edit: "Edit", manage: "Manage" }

export function AccessWorkspaceRows({ rows, disabled, onChange }: {
  rows: Rows; disabled: boolean; onChange: (rows: Rows) => void
}) {
  return <section aria-label="Workspace access" className="mt-3 border-t border-border/60 pt-3">
    <h3 className="mb-1 text-xs text-muted-foreground">Workspaces</h3>
    <ul className="flex flex-col gap-1">
      {rows.map(row => <li key={row.id} className="flex min-w-0 items-center gap-2 py-1">
        <span className="min-w-0 flex-1 truncate text-sm" title={row.name}>{row.name}</span>
        {row.canManage ? <NativeSelect aria-label={`Folder access for ${row.name}`} value={row.capability ?? "none"}
          disabled={disabled} className="h-11 w-36 text-base sm:h-9 sm:text-sm" onChange={event => {
            const value = event.target.value
            if (value === "none" || value === "view" || value === "edit" || value === "manage")
              onChange(rows.map(item => item.id === row.id ? { ...item, capability: value === "none" ? null : value } : item))
          }}>
          <option value="none">None</option>
          {(["view", "edit", "manage"] as const).map(value => <option key={value} value={value}>{labels[value]}</option>)}
        </NativeSelect> : <span className="shrink-0 text-xs text-muted-foreground">{row.capability ? labels[row.capability] : "None"}</span>}
      </li>)}
    </ul>
  </section>
}
