"use client"

import type { ComponentProps } from "react"
import { Pencil } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import styles from "./opportunity-text-field.module.css"
import { cn } from "@/lib/utils"

// Inline-edit affordance, with changes kept in the report draft until Save.
export function OpportunityTextField({ className, ...props }: ComponentProps<typeof Textarea>) {
  return <div className={styles.field}>
    <Textarea {...props} className={cn(className, "pr-8")} />
    <Pencil data-edit-indicator aria-hidden className={styles.indicator} />
  </div>
}
