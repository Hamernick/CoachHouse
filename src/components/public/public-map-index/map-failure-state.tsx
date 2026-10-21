"use client"

import MapPinOffIcon from "lucide-react/dist/esm/icons/map-pin-off"
import RefreshCwIcon from "lucide-react/dist/esm/icons/refresh-cw"
import SearchIcon from "lucide-react/dist/esm/icons/search"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function PublicMapFailureState({
  className,
  onBrowseDirectory,
  onRetry,
  reason,
}: {
  className?: string
  onBrowseDirectory: () => void
  onRetry?: () => void
  reason: "configuration" | "runtime"
}) {
  const canRetry = reason === "runtime" && Boolean(onRetry)

  return (
    <section

      data-public-map-failure-state={reason}
      role="alert"
      aria-atomic="true"
      className={cn(
        "bg-background relative isolate flex h-full min-h-[480px] items-center justify-center overflow-hidden px-4 py-12 sm:px-6",
        className
      )}
    >
      <div className="bg-muted/30 absolute inset-0" aria-hidden />
      <div
        className="border-border/30 absolute top-1/2 left-1/2 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full border"
        aria-hidden
      />
      <div
        className="border-border/25 absolute top-1/2 left-1/2 size-52 -translate-x-1/2 -translate-y-1/2 rounded-full border"
        aria-hidden
      />

      <div className="border-border/70 bg-card/95 relative w-full max-w-md rounded-2xl border px-6 py-8 text-center shadow-xl shadow-black/5 backdrop-blur-xl sm:px-8">
        <div className="border-destructive/15 bg-destructive/8 text-destructive mx-auto flex size-12 items-center justify-center rounded-xl border">
          <MapPinOffIcon className="size-5" aria-hidden />
        </div>
        <div className="mt-5 space-y-2">
          <h2 className="text-foreground text-xl font-semibold tracking-tight text-balance">
            The map couldn’t load
          </h2>
          <p className="text-muted-foreground mx-auto max-w-[40ch] text-sm leading-6 text-pretty">
            {canRetry
              ? "We hit a connection issue while loading the map. Try again, or continue browsing the directory."
              : "The interactive map is temporarily unavailable. You can still browse every organization and resource in the directory."}
          </p>
        </div>
        <div className="mt-6 flex flex-col-reverse justify-center gap-2 sm:flex-row">
          <Button
            type="button"
            variant={canRetry ? "outline" : "default"}
            className="h-11 rounded-full px-5"
            onClick={onBrowseDirectory}
          >
            <SearchIcon aria-hidden />
            Browse directory
          </Button>
          {canRetry ? (
            <Button
              type="button"
              className="h-11 rounded-full px-5"
              onClick={onRetry}
            >
              <RefreshCwIcon aria-hidden />
              Try map again
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  )
}
