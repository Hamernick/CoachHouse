import LoaderCircleIcon from "lucide-react/dist/esm/icons/loader-circle"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { PublicMapEmbeddedLayout } from "./embedded-layout"

export function PublicMapLoadingState({ loading = true }: { loading?: boolean }) {
  return (
    <div
      data-public-map-loading={loading ? "true" : "false"}
      aria-hidden={!loading}
      className={cn(
        "bg-background pointer-events-none absolute inset-0 z-20 flex items-center justify-center overflow-hidden rounded-3xl transition-[opacity,visibility] duration-500 ease-out motion-reduce:transition-none",
        loading ? "visible opacity-100" : "invisible opacity-0"
      )}
    >
      <div role="status" aria-live="polite" className="text-muted-foreground flex items-center gap-2.5 px-6 text-sm">
        <LoaderCircleIcon
          aria-hidden="true"
          className="size-4 motion-safe:animate-spin motion-safe:[animation-duration:1.4s]"
          strokeWidth={1.5}
        />
        <span>Loading data…</span>
      </div>
    </div>
  )
}

export function PublicMapHomeLoading() {
  return (
    <PublicMapEmbeddedLayout
      toolbar={<Skeleton className="h-4 w-28 rounded-full" />}
      map={<PublicMapLoadingState />}
      panel={<Skeleton className="h-10 w-full rounded-full" />}
    />
  )
}
