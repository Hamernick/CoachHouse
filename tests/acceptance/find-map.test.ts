import { readFileSync } from "node:fs"
import { join } from "node:path"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { afterEach, describe, expect, it, vi } from "vitest"

import {
  FIND_MAP_FEATURE_NAME,
  FindMapLoadingSidebar,
  FindMapLoadingState,
} from "@/features/find-map"
import { FindMapWeatherCard } from "@/features/find-map/client"
import {
  buildFindMapWeatherCell,
  buildFindMapWeatherResponse,
  normalizeNwsHeatEvent,
  parseFindMapWeatherCell,
  parseFindMapWeatherResponse,
} from "@/features/find-map/lib"
import {
  FIND_MAP_WEATHER_REFRESH_MS,
  resolveFindMapWeatherRetryDelay,
} from "@/features/find-map/use-find-map-weather"
import {
  fetchFindMapWeather,
  resolveNwsGridFreshness,
} from "@/features/find-map/server/weather"

const ROOT = process.cwd()

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("find-map feature", () => {
  it("exposes a stable public feature entrypoint", () => {
    expect(FIND_MAP_FEATURE_NAME).toBe("find-map")
  })

  it("uses a layout-preserving initial state instead of generic skeletons", () => {
    const markup = renderToStaticMarkup(createElement(FindMapLoadingState))
    const sidebarMarkup = renderToStaticMarkup(
      createElement(FindMapLoadingSidebar)
    )
    const routeSource = readFileSync(
      join(ROOT, "src/app/(public)/find/loading.tsx"),
      "utf8"
    )
    const routeLoadingSource = readFileSync(
      join(
        ROOT,
        "src/features/find-map/components/public-find-route-loading.tsx"
      ),
      "utf8"
    )
    const shellSource = readFileSync(
      join(ROOT, "src/components/public/home-canvas-find-shell.tsx"),
      "utf8"
    )

    expect(routeSource).toContain("<PublicFindRouteLoading />")
    expect(routeLoadingSource).toContain('role="status"')
    expect(routeLoadingSource).not.toContain("HomeCanvasFindShell")
    expect(routeSource).toContain("function PublicFindLoading()")
    expect(routeSource).not.toContain("async function PublicFindLoading")
    expect(routeSource).not.toContain("fetchPublicMapViewerState")
    expect(routeSource).not.toContain("resolveDashboardLayoutState")
    expect(routeSource).not.toContain("Skeleton")
    expect(shellSource).toContain(
      '"--sidebar-width": sidebarFallback === null ? "23rem" : "15rem"'
    )
    expect(shellSource).toContain("hasSidebarSlot || sidebarFallback !== null")
    expect(sidebarMarkup).toContain('data-find-map-loading-sidebar=""')
    expect(sidebarMarkup).toContain('aria-hidden="true"')
    expect(markup).toContain('data-find-map-loading-state="layout-preserving"')
    expect(markup).toContain('data-find-map-loading-drawer=""')
    expect(markup).toContain("min-h-[336px]")
    expect(markup).toContain("rounded-t-[28px]")
    expect(markup).toContain("Find organizations and resources")
    expect(markup).toContain("Loading resources…")
    expect(markup).toContain('aria-busy="true"')
    expect(markup).toContain("motion-reduce:animate-none")
    expect(markup).not.toContain('data-slot="skeleton"')
    expect(markup.match(/animate-spin/g)).toHaveLength(1)
  })

  it("coarsens location before weather requests", () => {
    expect(
      buildFindMapWeatherCell({ latitude: 41.8781, longitude: -87.6298 })
    ).toEqual({ latitude: 41.9, longitude: -87.65 })
    expect(
      parseFindMapWeatherCell({ latitude: 41.9, longitude: -87.65 })
    ).toEqual({ latitude: 41.9, longitude: -87.65 })
    expect(
      parseFindMapWeatherCell({ latitude: 41.8781, longitude: -87.6298 })
    ).toBeNull()
  })

  it("rejects cross-format and oversized weather proxy requests", async () => {
    const { POST } = await import("@/app/api/public/find/weather/route")
    const unsupported = await POST(
      new Request("http://localhost/api/public/find/weather", {
        body: "{}",
        headers: { "Content-Type": "text/plain" },
        method: "POST",
      })
    )
    const oversized = await POST(
      new Request("http://localhost/api/public/find/weather", {
        body: "{}",
        headers: {
          "Content-Length": "257",
          "Content-Type": "application/json",
        },
        method: "POST",
      })
    )
    const chunkedOversized = await POST(
      new Request("http://localhost/api/public/find/weather", {
        body: JSON.stringify({ padding: "x".repeat(257) }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })
    )

    expect(unsupported.status).toBe(415)
    expect(unsupported.headers.get("x-content-type-options")).toBe("nosniff")
    expect(oversized.status).toBe(413)
    expect(chunkedOversized.status).toBe(413)
  })

  it("normalizes current and legacy NWS heat events", () => {
    expect(normalizeNwsHeatEvent("Heat Advisory")).toBe("Heat Advisory")
    expect(normalizeNwsHeatEvent("Excessive Heat Warning")).toBe(
      "Extreme Heat Warning"
    )
    expect(normalizeNwsHeatEvent("Wind Advisory")).toBeNull()
  })

  it("accepts a current NWS forecast cycle without trusting an old grid", () => {
    const now = Date.parse("2026-08-28T17:30:00.000Z")

    expect(
      resolveNwsGridFreshness(
        { properties: { updateTime: "2026-08-28T12:00:00.000Z" } },
        now
      )
    ).toBe("fresh")
    expect(
      resolveNwsGridFreshness(
        { properties: { updateTime: "2026-08-28T11:00:00.000Z" } },
        now
      )
    ).toBe("stale")
  })

  it("uses the nearest recent NWS observation for the displayed temperature", async () => {
    const now = Date.now()
    const currentTime = new Date(now - 10 * 60 * 1000).toISOString()
    const intervalStart = new Date(now - 60 * 60 * 1000).toISOString()
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.includes("/points/40.05,-80.05")) {
        return Response.json({
          properties: {
            forecastGridData: "https://api.weather.gov/gridpoints/TST/1,2",
            observationStations:
              "https://api.weather.gov/gridpoints/TST/1,2/stations",
            relativeLocation: {
              properties: { city: "Test City", state: "PA" },
            },
            timeZone: "America/New_York",
          },
        })
      }
      if (url.includes("/alerts/active")) {
        return Response.json({ features: [] })
      }
      if (url.endsWith("/gridpoints/TST/1,2")) {
        return Response.json({
          properties: {
            temperature: {
              uom: "wmoUnit:degC",
              values: [{ validTime: `${intervalStart}/PT3H`, value: 20 }],
            },
            updateTime: currentTime,
          },
        })
      }
      if (url.endsWith("/gridpoints/TST/1,2/stations")) {
        return Response.json({
          features: [{ properties: { stationIdentifier: "KTST" } }],
        })
      }
      if (url.includes("/stations/KTST/observations/latest")) {
        return Response.json({
          properties: {
            temperature: { unitCode: "wmoUnit:degC", value: 25 },
            timestamp: currentTime,
          },
        })
      }
      return new Response(null, { status: 404 })
    })
    vi.stubGlobal("fetch", fetchMock)

    const response = await fetchFindMapWeather({
      latitude: 40.05,
      longitude: -80.05,
    })

    expect(response).toMatchObject({
      signal: "none",
      snapshot: {
        temperatureFahrenheit: 77,
        temperatureSource: "observation",
      },
    })
    expect(fetchMock).toHaveBeenCalledTimes(5)
  })

  it("does not follow non-NWS provider links", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.includes("/points/40.10,-80.10")) {
        return Response.json({
          properties: {
            forecastGridData: "https://example.com/grid",
            observationStations: "https://example.com/stations",
          },
        })
      }
      if (url.includes("/alerts/active")) {
        return Response.json({ features: [] })
      }
      return new Response(null, { status: 404 })
    })
    vi.stubGlobal("fetch", fetchMock)

    const response = await fetchFindMapWeather({
      latitude: 40.1,
      longitude: -80.1,
    })

    expect(response).toEqual({ signal: "unknown", snapshot: null })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls.map(([url]) => String(url))).not.toContain(
      "https://example.com/grid"
    )
  })

  it("builds compact weather data and detects two forecast heat hours", () => {
    const now = Date.parse("2026-08-27T12:00:00.000Z")
    const response = buildFindMapWeatherResponse({
      alerts: { features: [] },
      alertsAvailable: true,
      freshness: "fresh",
      now,
      point: {
        properties: {
          relativeLocation: {
            properties: { city: "Chicago", state: "IL" },
          },
          timeZone: "America/Chicago",
        },
      },
      grid: {
        properties: {
          updateTime: "2026-08-27T11:45:00.000Z",
          temperature: {
            values: [{ validTime: "2026-08-27T12:00:00Z/PT2H", value: 38 }],
          },
          heatIndex: {
            values: [{ validTime: "2026-08-27T12:00:00Z/PT2H", value: 38 }],
          },
          maxTemperature: {
            values: [{ validTime: "2026-08-27T06:00:00Z/PT18H", value: 39 }],
          },
          minTemperature: {
            values: [{ validTime: "2026-08-27T06:00:00Z/PT18H", value: 24 }],
          },
        },
      },
    })

    expect(response).toMatchObject({
      signal: "forecast_threshold",
      snapshot: {
        city: "Chicago",
        state: "IL",
        temperatureFahrenheit: 100,
        highFahrenheit: 102,
        lowFahrenheit: 75,
        temperatureSource: "forecast",
      },
    })
    const markup = renderToStaticMarkup(
      createElement(FindMapWeatherCard, { weather: response.snapshot })
    )
    expect(markup).toContain("100°")
    expect(markup).not.toContain("Chicago, IL")
    expect(markup).not.toContain("H 102° L 75°")
    expect(markup).toContain(
      'aria-label="Current forecast temperature: 100 degrees."'
    )
    expect(markup).toContain('role="status"')

    expect(markup).toContain("pointer-events-auto")
    expect(markup).toContain("size-10")
    expect(markup).toContain("sm:size-11")
    expect(markup).toContain("rounded-xl")
    expect(markup).toContain("first:pt-0")
    expect(markup).toContain('data-weather-temperature-length="4"')
    expect(markup).toContain('data-weather-temperature-source="forecast"')
    expect(markup).toContain("text-xs sm:text-sm")

    const singleDigitMarkup = renderToStaticMarkup(
      createElement(FindMapWeatherCard, {
        weather: response.snapshot
          ? { ...response.snapshot, temperatureFahrenheit: 7 }
          : null,
      })
    )
    expect(singleDigitMarkup).toContain("7°")
    expect(singleDigitMarkup).toContain('data-weather-temperature-length="2"')
    expect(singleDigitMarkup).toContain("text-sm")
  })

  it("prefers a recent observation without requiring place or daily ranges", () => {
    const now = Date.parse("2026-08-27T12:00:00.000Z")
    const response = buildFindMapWeatherResponse({
      alerts: { features: [] },
      alertsAvailable: true,
      freshness: "fresh",
      grid: {
        properties: {
          updateTime: "2026-08-27T11:45:00.000Z",
          temperature: {
            uom: "wmoUnit:degC",
            values: [{ validTime: "2026-08-27T12:00:00Z/PT2H", value: 38 }],
          },
        },
      },
      now,
      observation: {
        properties: {
          temperature: { unitCode: "wmoUnit:degC", value: 26 },
          timestamp: "2026-08-27T11:50:00.000Z",
        },
      },
      point: { properties: {} },
    })

    expect(response).toEqual({
      signal: "forecast_threshold",
      snapshot: {
        freshness: "fresh",
        signal: "forecast_threshold",
        temperatureFahrenheit: 79,
        temperatureSource: "observation",
        updatedAt: "2026-08-27T11:50:00.000Z",
      },
    })
    const markup = renderToStaticMarkup(
      createElement(FindMapWeatherCard, { weather: response.snapshot })
    )
    expect(markup).toContain(
      'aria-label="Current observed temperature: 79 degrees."'
    )
    expect(markup).toContain('data-weather-temperature-source="observation"')
  })

  it("rejects stale observations and malformed or non-actual heat alerts", () => {
    const now = Date.parse("2026-08-27T12:00:00.000Z")
    const response = buildFindMapWeatherResponse({
      alerts: {
        features: [
          {
            properties: {
              ends: "2026-08-27T14:00:00.000Z",
              event: "Heat Advisory",
              messageType: "Alert",
              onset: "2026-08-27T10:00:00.000Z",
              status: "Exercise",
            },
          },
        ],
      },
      alertsAvailable: true,
      freshness: "fresh",
      grid: {
        properties: {
          updateTime: "2026-08-27T11:45:00.000Z",
          temperature: {
            values: [{ validTime: "2026-08-27T12:00:00Z/PT2H", value: 20 }],
          },
        },
      },
      now,
      observation: {
        properties: {
          temperature: { unitCode: "wmoUnit:degC", value: 31 },
          timestamp: "2026-08-27T09:00:00.000Z",
        },
      },
      point: { properties: {} },
    })

    expect(response).toMatchObject({
      signal: "none",
      snapshot: {
        temperatureFahrenheit: 68,
        temperatureSource: "forecast",
      },
    })
  })

  it("accepts only active actual heat alerts", () => {
    const now = Date.parse("2026-08-27T12:00:00.000Z")
    const response = buildFindMapWeatherResponse({
      alerts: {
        features: [
          {
            properties: {
              ends: "2026-08-27T14:00:00.000Z",
              event: "Heat Advisory",
              messageType: "Alert",
              onset: "2026-08-27T10:00:00.000Z",
              status: "Actual",
            },
          },
        ],
      },
      alertsAvailable: true,
      freshness: "stale",
      grid: null,
      now,
      observation: {
        properties: {
          temperature: { unitCode: "wmoUnit:degC", value: 30 },
          timestamp: "2026-08-27T11:45:00.000Z",
        },
      },
      point: { properties: {} },
    })

    expect(response.signal).toBe("official_alert")
    expect(response.snapshot?.temperatureSource).toBe("observation")
  })

  it("validates weather responses and bounds retry scheduling", () => {
    expect(
      parseFindMapWeatherResponse({
        signal: "none",
        snapshot: {
          freshness: "fresh",
          signal: "none",
          temperatureFahrenheit: 72,
          temperatureSource: "observation",
          updatedAt: "2026-08-27T12:00:00.000Z",
        },
      })
    ).toMatchObject({ snapshot: { temperatureFahrenheit: 72 } })
    expect(
      parseFindMapWeatherResponse({
        signal: "none",
        snapshot: { temperatureFahrenheit: "72" },
      })
    ).toBeNull()
    expect(
      parseFindMapWeatherResponse({
        signal: "none",
        snapshot: {
          freshness: "fresh",
          signal: "threshold",
          temperatureFahrenheit: 72,
          temperatureSource: "forecast",
          updatedAt: "2026-08-27T12:00:00.000Z",
        },
      })
    ).toBeNull()
    expect(resolveFindMapWeatherRetryDelay(1)).toBe(15_000)
    expect(resolveFindMapWeatherRetryDelay(2)).toBe(30_000)
    expect(resolveFindMapWeatherRetryDelay(4)).toBe(120_000)
    expect(resolveFindMapWeatherRetryDelay(20)).toBe(120_000)
    expect(FIND_MAP_WEATHER_REFRESH_MS).toBe(600_000)
  })

  it("does not use a stale forecast to boost cooling resources", () => {
    const now = Date.parse("2026-08-28T17:30:00.000Z")
    const response = buildFindMapWeatherResponse({
      alerts: { features: [] },
      alertsAvailable: true,
      freshness: "stale",
      now,
      point: {
        properties: {
          relativeLocation: {
            properties: { city: "Chicago", state: "IL" },
          },
          timeZone: "America/Chicago",
        },
      },
      grid: {
        properties: {
          updateTime: "2026-08-28T05:00:00.000Z",
          temperature: {
            values: [{ validTime: "2026-08-28T17:00:00Z/PT2H", value: 38 }],
          },
          heatIndex: {
            values: [{ validTime: "2026-08-28T17:00:00Z/PT2H", value: 38 }],
          },
          maxTemperature: {
            values: [{ validTime: "2026-08-28T06:00:00Z/PT18H", value: 39 }],
          },
          minTemperature: {
            values: [{ validTime: "2026-08-28T06:00:00Z/PT18H", value: 24 }],
          },
        },
      },
    })

    expect(response.signal).toBe("unknown")
    expect(response.snapshot?.freshness).toBe("stale")

    const markup = renderToStaticMarkup(
      createElement(FindMapWeatherCard, { weather: response.snapshot })
    )
    expect(markup).toContain("100°")
    expect(markup).not.toContain("Chicago, IL")
    expect(markup).not.toContain("H 102° L 75°")
    expect(markup).toContain('data-weather-freshness="stale"')
    expect(markup).toContain("Weather data may be delayed.")
    expect(markup).toContain("Current forecast temperature")
    expect(markup).toContain("size-10")
  })
})
