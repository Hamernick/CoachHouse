"use client"

import type { ReactNode } from "react"
import { CollapsibleContent } from "@/components/ui/collapsible"
import styles from "./particle-objectives.module.css"

export function PlanningDisclosure({ open, children }: { open: boolean; children: ReactNode }) {
  return <CollapsibleContent forceMount inert={!open} aria-hidden={!open}>
    <div data-open={open} className={styles.disclosure}><div>{children}</div></div>
  </CollapsibleContent>
}
