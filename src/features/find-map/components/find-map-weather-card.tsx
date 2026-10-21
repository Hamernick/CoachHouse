import { Card, CardContent } from "@/components/ui/card"

import { cn } from "@/lib/utils"

import type { FindMapWeatherSnapshot } from "../types"

export function FindMapWeatherCard({
  unstyled = false,
  className,
  weather,
}: {
  className?: string
  weather: FindMapWeatherSnapshot | null
  unstyled?: boolean
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

      aria-label={`${temperatureDescription}: ${weather.temperatureFahrenheit} degrees.${freshnessDescription}`}
      role="status"
      data-weather-freshness={weather.freshness}
      data-weather-temperature-source={weather.temperatureSource}
      data-weather-temperature-length={temperatureLength}
      className={cn(
        "pointer-events-auto size-10 shrink-0 gap-0 overflow-hidden rounded-xl py-0 shadow-sm sm:size-11",
        unstyled && "h-8 w-auto rounded-none border-0 bg-transparent text-foreground shadow-none sm:h-8 sm:w-auto",
        className
      )}
    >
      <CardContent

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
