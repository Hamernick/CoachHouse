"use client"

import { useMemo, useState } from "react"
import type { FindMapWeatherResponse } from "@/features/find-map/client"
import type { ExternalResourceMapItem } from "@/lib/public-map/resource-map-items"
import {
  shouldShowPublicMapCoolingCenters,
  resolvePublicMapResourcePresentation,
} from "@/lib/public-map/resource-seasonal-presentation"

import { usePublicMapSavedItems } from "./public-map-index-state"

export function usePublicMapSeasonalResources(
  sourceItems: ExternalResourceMapItem[]
) {
  const [weather, setWeather] = useState<FindMapWeatherResponse | null>(null)
  const showCoolingCenters = shouldShowPublicMapCoolingCenters(weather?.signal)
  const resourceItems = useMemo(
    () =>
      sourceItems.flatMap((item) => {
        const presentation = resolvePublicMapResourcePresentation(
          item,
          showCoolingCenters
        )
        return presentation ? [presentation] : []
      }),
    [sourceItems, showCoolingCenters]
  )

  return { resourceItems, showCoolingCenters, weather, setWeather }
}

export function usePublicMapSeasonalSavedItems(
  input: Parameters<typeof usePublicMapSavedItems>[0],
  showCoolingCenters: boolean
) {
  const saved = usePublicMapSavedItems(input)
  const savedResources = useMemo(
    () => saved.savedResources.flatMap(item => {
      const presentation = resolvePublicMapResourcePresentation(item, showCoolingCenters)
      return presentation ? [presentation] : []
    }),
    [saved.savedResources, showCoolingCenters]
  )
  return { ...saved, savedResources }
}
