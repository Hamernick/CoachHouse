"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

type FieldRootProps = React.HTMLAttributes<HTMLDivElement> & {
  orientation?: "vertical" | "horizontal" | "responsive"
}

export function Field({ className, orientation = "vertical", ...props }: FieldRootProps) {
  const orient =
    orientation === "horizontal"
      ? "grid grid-cols-3 items-start gap-3"
      : orientation === "responsive"
      ? "grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-start sm:gap-3"
      : "grid grid-cols-1 gap-1"
  return <div data-slot="field" className={cn("w-full", orient, className)} {...props} />
}

export function FieldLabel({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label data-slot="field-label" className={cn("text-sm font-medium leading-none", className)} {...props} />
}

export function FieldControl({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("col-span-2", className)} {...props} />
}

export function FieldDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs text-muted-foreground", className)} {...props} />
}

export function FieldMessage({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs text-destructive", className)} {...props} />
}

export function FieldGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="field-group" className={cn("grid gap-3", className)} {...props} />
}

export function FieldSet({ className, ...props }: React.HTMLAttributes<HTMLFieldSetElement>) {
  return <fieldset data-slot="field-set" className={cn("grid gap-3", className)} {...props} />
}

export function FieldLegend({ className, ...props }: React.HTMLAttributes<HTMLLegendElement>) {
  return <legend data-slot="field-legend" className={cn("text-sm font-semibold", className)} {...props} />
}

