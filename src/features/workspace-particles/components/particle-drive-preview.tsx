"use client"

import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { useParticleSurface } from "./particle-surface"

/** Mounted only in the open file viewer; closing removes the Google frame.
 * A frame load can be a Google sign-in/access page, not proof of file access. */
export function ParticleDrivePreview({ url, name }: { url: string; name: string }) {
  const [state, setState] = useState<"loading" | "ready" | "slow" | "error">("loading")
  const surface = useParticleSurface()
  useEffect(() => {
    if (state !== "loading") return
    const timer = setTimeout(() => setState("slow"), 12_000)
    return () => clearTimeout(timer)
  }, [state])
  return (
    <div {...surface()} className="relative flex h-full min-h-64 flex-col">
      <iframe
        src={url}
        title={`Google Drive preview: ${name}`}
        className="min-h-0 w-full flex-1 border-0"
        referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        onLoad={() => setState("ready")}
        onError={() => setState("error")}
      />
      {state === "loading" && (
        <Skeleton
          role="status"
          aria-label="Loading Google Drive preview"
          className="pointer-events-none absolute inset-0 rounded-none motion-reduce:animate-none"
        />
      )}
      {(state === "slow" || state === "error") && (
        <p role="status" className="bg-muted text-muted-foreground shrink-0 px-4 py-2 text-center text-xs">
          {state === "slow" ? "Google’s preview is taking longer than expected." : "Google’s preview could not load."}
          {" "}Refresh or open the original to check access.
        </p>
      )}
    </div>
  )
}
