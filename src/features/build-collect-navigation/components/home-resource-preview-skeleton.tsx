import { Skeleton } from "@/components/ui/skeleton"
import { HomeCanvasSearchDockSkeleton } from "@/components/public/home-canvas-dock-slot"

export function HomeResourcePreviewSkeleton() {
  return <div className="w-full min-w-0 space-y-3" role="status" aria-label="Loading resource preview">
    <div className="h-[22rem] w-full min-w-0 overflow-hidden rounded-3xl border bg-muted/30 p-4 sm:aspect-video sm:h-auto sm:min-h-[22rem] sm:rounded-[40px]">
      {[0, 1, 2].map((row) => <div key={row} className="flex items-center gap-3 py-4" aria-hidden>
        <Skeleton className="size-10 shrink-0 rounded-xl motion-reduce:animate-none" />
        <div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/3 motion-reduce:animate-none" /><Skeleton className="h-3 w-1/3 motion-reduce:animate-none" /></div>
      </div>)}
    </div>
    <HomeCanvasSearchDockSkeleton />
  </div>
}
