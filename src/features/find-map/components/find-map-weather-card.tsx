import { Card, CardContent } from "@/components/ui/card"
import {
  getReactGrabLinkedSurfaceProps,
  getReactGrabOwnerProps,
} from "@/components/dev/react-grab-surface"
import { cn } from "@/lib/utils"

import type { FindMapWeatherSnapshot } from "../types"

const FIND_MAP_WEATHER_CARD_SOURCE =
  "src/features/find-map/components/find-map-weather-card.tsx"
const FIND_MAP_WEATHER_CARD_OWNER_ID = "find-map-weather-card:current-location"

export function FindMapWeatherCard({
  className,
  weather,
}: {
  className?: string
  weather: FindMapWeatherSnapshot | null
}) {
  if (!weather) return null

  const freshnessDescription =
    weather.freshness === "stale" ? " Weather data may be delayed." : ""
  const temperatureDescription =
    weather.temperatureSource === "observation"
      ? "Current observed temperature"
      : "Current forecast temperature"
  const temperatureLabel = `${weather.temperatureFahrenheit}°`
  const temperatureLength = Array.from(temperatureLabel).length
  const temperatureTextClassName =
    temperatureLength >= 5
      ? "text-[10px] sm:text-xs"
      : temperatureLength >= 4
        ? "text-xs sm:text-sm"
        : "text-sm"

  return (
    <Card
      {...getReactGrabOwnerProps({
        ownerId: FIND_MAP_WEATHER_CARD_OWNER_ID,
        component: "FindMapWeatherCard",
        source: FIND_MAP_WEATHER_CARD_SOURCE,
        slot: "card",
        primitiveImport: "@/components/ui/card",
        notes:
          "Compact current-location weather summary on the public Find map.",
      })}
      aria-label={`${temperatureDescription}: ${weather.temperatureFahrenheit} degrees.${freshnessDescription}`}
      role="status"
      data-weather-freshness={weather.freshness}
      data-weather-temperature-source={weather.temperatureSource}
      data-weather-temperature-length={temperatureLength}
      className={cn(
        "pointer-events-auto size-10 shrink-0 gap-0 overflow-hidden rounded-xl py-0 shadow-none sm:size-11",
        className
      )}
    >
      <CardContent
        {...getReactGrabLinkedSurfaceProps({
          ownerId: FIND_MAP_WEATHER_CARD_OWNER_ID,
          component: "FindMapWeatherCard",
          source: FIND_MAP_WEATHER_CARD_SOURCE,
          slot: "temperature",
          surfaceKind: "content",
        })}
        className="flex size-full min-w-0 items-center justify-center p-0 leading-none font-semibold tabular-nums first:pt-0"
      >
        <span
          className={cn(
            "max-w-full tracking-tight whitespace-nowrap",
            temperatureTextClassName
          )}
        >
          {temperatureLabel}
        </span>
      </CardContent>
    </Card>
  )
}
