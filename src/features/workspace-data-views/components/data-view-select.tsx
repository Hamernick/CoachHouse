"use client"
import type { ReactNode } from "react"
import { ParticleSelect } from "@/components/ui/particle-ui"

export function DataViewSelect({ value, onChange, children, id, disabled, autoFocus, "aria-label": label }: {
  value: string; onChange: (event: { target: { value: string } }) => void; children: ReactNode; id?: string; disabled?: boolean; autoFocus?: boolean; "aria-label"?: string
}) {
  return <ParticleSelect value={value} id={id} disabled={disabled} aria-label={label} autoFocus={autoFocus} onChange={onChange}>{children}</ParticleSelect>
}
export function DataViewOption({ value, children }: { value: string; children: ReactNode }) {
  return <option value={value}>{children}</option>
}
