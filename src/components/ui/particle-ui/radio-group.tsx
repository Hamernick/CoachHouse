"use client"

import type { HTMLAttributes } from "react"
import { RadioGroup, type RadioGroupProps } from "@openai/apps-sdk-ui/components/RadioGroup"
import { cn } from "@/lib/utils"

function Group<T extends string>({ className, ...props }: RadioGroupProps<T> & Omit<HTMLAttributes<HTMLDivElement>, "onChange" | "defaultValue">) {
  return <RadioGroup {...props} className={cn("particle-ui", className)} />
}
export const ParticleRadioGroup = Object.assign(Group, { Item: RadioGroup.Item })
