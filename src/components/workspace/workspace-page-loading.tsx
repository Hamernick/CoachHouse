import LoaderCircleIcon from "lucide-react/dist/esm/icons/loader-circle"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export function WorkspaceLoadingIndicator() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground" role="status" aria-label="Loading canvas">
      <LoaderCircleIcon className="size-4 motion-safe:animate-spin" aria-hidden />
      <span>Opening your workspace…</span>
    </div>
  )
}

export function WorkspacePanelLoading() {
  return (
    <div role="status" data-workspace-panel-loading="true" className="space-y-3 p-4">
      <span className="sr-only">Loading workspace content…</span>
      <Skeleton className="h-8 w-1/2 rounded-lg motion-reduce:animate-none" />
      <Skeleton className="h-40 w-full rounded-2xl motion-reduce:animate-none" />
    </div>
  )
}

export function WorkspacePageLoading({ embedded = false }: { embedded?: boolean }) {
  return (
    <div
      data-workspace-loading="true"
      className={cn("flex min-h-0 min-w-0 flex-1 flex-col", !embedded && "-m-[var(--shell-content-pad)] min-h-[calc(100%_+_var(--shell-content-pad)_+_var(--shell-content-pad))]")}
      aria-busy="true"
    >
      <div className="workspace-loading-surface relative min-h-[min(820px,calc(100svh-9.5rem))] flex-1 overflow-hidden bg-zinc-50 dark:bg-zinc-800">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute left-3 top-3 flex flex-col gap-3">
            <Skeleton className="h-9 w-44 rounded-full motion-reduce:animate-none" />
            <Skeleton className="h-8 w-32 rounded-full motion-reduce:animate-none" />
          </div>
          <Skeleton className="absolute left-1/2 top-3 hidden h-8 w-40 -translate-x-1/2 rounded-full motion-reduce:animate-none sm:block" />
          <div className="absolute bottom-6 left-1/2 flex w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 flex-col items-center gap-3">
            <Skeleton className="h-9 w-52 rounded-full motion-reduce:animate-none" />
            <Skeleton className="h-12 w-full rounded-full motion-reduce:animate-none" />
          </div>
        </div>
        <WorkspaceLoadingIndicator />
      </div>
    </div>
  )
}
