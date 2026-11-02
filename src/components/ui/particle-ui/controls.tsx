"use client"

import type { ComponentProps, HTMLAttributes } from "react"
import { Button, ButtonLink } from "@openai/apps-sdk-ui/components/Button"
import { Alert } from "@openai/apps-sdk-ui/components/Alert"
import { Badge } from "@openai/apps-sdk-ui/components/Badge"
import { Input } from "@openai/apps-sdk-ui/components/Input"
import { Textarea } from "@openai/apps-sdk-ui/components/Textarea"
import { Checkbox } from "@openai/apps-sdk-ui/components/Checkbox"
import { Switch } from "@openai/apps-sdk-ui/components/Switch"
import { cn } from "@/lib/utils"

// Keep SDK props/ref behavior intact and give independently mounted editors the
// same scoped foundation. Styling and interaction stay with the actual SDK.
export function ParticleButton({ className, ...props }: ComponentProps<typeof Button>) {
  return <Button {...props} className={cn("particle-ui", className)} />
}
export function ParticleInput({ className, invalid, ...props }: ComponentProps<typeof Input>) {
  return <Input {...props} invalid={invalid ?? (props["aria-invalid"] === true || props["aria-invalid"] === "true")} className={cn("particle-ui", className)} />
}
export function ParticleTextarea({ className, invalid, ...props }: ComponentProps<typeof Textarea>) {
  return <Textarea {...props} invalid={invalid ?? (props["aria-invalid"] === true || props["aria-invalid"] === "true")} className={cn("particle-ui particle-ui-textarea", className)} />
}
export function ParticleCheckbox({ className, ...props }: ComponentProps<typeof Checkbox>) {
  return <Checkbox {...props} className={cn("particle-ui", className)} />
}
export function ParticleSwitch({ className, ...props }: ComponentProps<typeof Switch>) {
  return <Switch {...props} className={cn("particle-ui", className)} />
}
export const ParticleButtonLink: typeof ButtonLink = props => <ButtonLink {...props} className={cn("particle-ui", props.className)} />
export function ParticleBadge({ className, ...props }: ComponentProps<typeof Badge>) {
  return <Badge {...props} className={cn("particle-ui", className)} />
}

export function ParticleAlert({ className, ...props }: ComponentProps<typeof Alert> & Omit<HTMLAttributes<HTMLDivElement>, "color" | "title" | "children">) {
  return <Alert {...props} className={cn("particle-ui", className)} />
}
