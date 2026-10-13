"use client"

import HeartIcon from "lucide-react/dist/esm/icons/heart"
import { Button } from "@/components/ui/button"
import { usePublicMapPreferences } from "./use-public-map-preferences"

type Viewer = { id: string; email: string | null } | null

export function PublicProfileCollectionButton({ id, kind, viewer = null }: {
  id: string
  kind: "organization" | "resource"
  viewer?: Viewer
}) {
  const preferences = usePublicMapPreferences({ initialViewer: viewer })
  const ids = kind === "organization" ? preferences.favorites : preferences.collectedResourceIds
  const setIds = kind === "organization" ? preferences.setFavorites : preferences.setCollectedResourceIds
  const collected = ids.includes(id)
  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" className="h-11 rounded-full shadow-none" aria-pressed={collected}
        disabled={preferences.preferenceMode === "unknown"}
        onClick={() => setIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [id, ...current].slice(0, 120))}>
        <HeartIcon aria-hidden className={collected ? "fill-current" : undefined} />
        {collected ? "Collected" : "Collect"}
      </Button>
      {preferences.preferencesSaveError ? <p role="status" className="text-destructive text-xs">{preferences.preferencesSaveError}</p> : null}
    </div>
  )
}
