"use client"

import type { ComponentProps } from "react"
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"
import { ParticleButton } from "./controls"

// The SDK has no dialog primitive. Preserve the existing Radix confirmation,
// cancellation and focus owners while using SDK buttons for actual controls.
export function ParticleAlertDialogAction({ children, ...props }: Omit<ComponentProps<typeof AlertDialogPrimitive.Action>, "asChild">) {
  return <AlertDialogPrimitive.Action {...props} asChild><ParticleButton color="primary" size="lg">{children}</ParticleButton></AlertDialogPrimitive.Action>
}
export function ParticleAlertDialogCancel({ children, ...props }: Omit<ComponentProps<typeof AlertDialogPrimitive.Cancel>, "asChild">) {
  return <AlertDialogPrimitive.Cancel {...props} asChild><ParticleButton color="secondary" variant="outline" size="lg">{children}</ParticleButton></AlertDialogPrimitive.Cancel>
}
