"use client"

import { ParticleButton as Button } from "@/components/ui/particle-ui"

import { useEffect, useState } from "react"

import { CheckIcon, CopyIcon } from "./shapeshift-icons"

export function ParticleCopyButton({
  text,
  label = "Copy",
}: {
  text: string
  label?: string
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle")
  useEffect(() => {
    if (status === "idle") return
    const timer = setTimeout(() => setStatus("idle"), 1600)
    return () => clearTimeout(timer)
  }, [status])
  return (
    <div className="nodrag nopan flex items-center gap-2">
      <Button color="secondary"
        type="button"
        size="md"
        variant="soft"
        className="rounded-full"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text)
            setStatus("copied")
          } catch {
            setStatus("error")
          }
        }}
      >
        {status === "copied" ? (
          <CheckIcon data-icon="inline-start" />
        ) : (
          <CopyIcon data-icon="inline-start" />
        )}
        {status === "copied" ? "Copied" : label}
      </Button>
      <span role="status" className="text-muted-foreground text-xs">
        {status === "error" ? "Copy failed. Try again." : ""}
      </span>
    </div>
  )
}
