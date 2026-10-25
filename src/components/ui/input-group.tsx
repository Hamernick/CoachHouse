"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

export function InputGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex w-full items-stretch gap-2", className)} {...props} />
}

export function InputGroupAddon({ className, align = "inline", ...props }: React.HTMLAttributes<HTMLDivElement> & { align?: "inline" | "block-end" }) {
  const alignClass = align === "block-end" ? "self-end" : "self-auto"
  return <div className={cn("flex items-center gap-2", alignClass, className)} {...props} />
}

export function InputGroupButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button
      type={props.type ?? "button"}
      variant="secondary"
      className={cn("h-9 border px-3", className)}
      {...props}
    />
  )
}

export function InputGroupText({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex h-9 items-center rounded-md border px-2 text-xs text-muted-foreground bg-muted/60",
        className,
      )}
      {...props}
    />
  )
}

export function InputGroupInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <Input className={cn("flex-1", className)} {...props} />
}

export function InputGroupTextarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <Textarea className={cn("w-full", className)} {...props} />
}
