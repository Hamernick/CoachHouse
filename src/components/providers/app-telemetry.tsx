"use client"

import dynamic from "next/dynamic"
import { filterPrivateTelemetry } from "@/lib/telemetry-privacy"

const Analytics = dynamic(() => import("@vercel/analytics/next").then((module) => module.Analytics), { ssr: false })
const SpeedInsights = dynamic(() => import("@vercel/speed-insights/next").then((module) => module.SpeedInsights), { ssr: false })

export function AppTelemetry() {
  return (
    <>
      <Analytics beforeSend={filterPrivateTelemetry} />
      <SpeedInsights sampleRate={0.5} beforeSend={filterPrivateTelemetry} />
    </>
  )
}
