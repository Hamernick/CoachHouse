import LoaderCircleIcon from "lucide-react/dist/esm/icons/loader-circle"

// Authentication decides the destination. Avoid flashing map chrome before a
// signed-in visitor is redirected to their workspace.
export function PublicFindRouteLoading() {
  return (
    <div className="flex min-h-[50dvh] items-center justify-center gap-2 p-6 text-sm text-muted-foreground" role="status" aria-live="polite">
      <LoaderCircleIcon className="size-4 motion-safe:animate-spin" aria-hidden />
      <span>Loading…</span>
    </div>
  )
}
