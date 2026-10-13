import LoaderCircleIcon from "lucide-react/dist/esm/icons/loader-circle"

export function WorkspacePageLoading() {
  return (
    <div className="flex min-h-64 flex-1 items-center justify-center gap-2 p-6 text-sm text-muted-foreground" role="status" aria-live="polite">
      <LoaderCircleIcon className="size-4 motion-safe:animate-spin" aria-hidden />
      <span>Opening your workspace…</span>
    </div>
  )
}
