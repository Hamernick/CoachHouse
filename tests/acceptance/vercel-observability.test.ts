import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

describe("Vercel observability wiring", () => {
  it("mounts first-party page analytics and speed insights in the root layout", () => {
    const layoutSource = readFileSync("src/app/layout.tsx", "utf8")
    const telemetrySource = readFileSync("src/components/providers/app-telemetry.tsx", "utf8")
    const packageSource = readFileSync("package.json", "utf8")

    expect(packageSource).toContain('"@vercel/analytics"')
    expect(packageSource).toContain('"@vercel/speed-insights"')
    expect(telemetrySource).toContain('import("@vercel/analytics/next")')
    expect(telemetrySource).toContain('import("@vercel/speed-insights/next")')
    expect(layoutSource).toContain("<AppTelemetry />")
    expect(telemetrySource).toContain("<Analytics beforeSend={filterPrivateTelemetry} />")
    expect(telemetrySource).toContain("<SpeedInsights sampleRate={0.5} beforeSend={filterPrivateTelemetry} />")
  })

  it("registers OpenTelemetry on Vercel or with explicit OTLP exporters", () => {
    const instrumentationSource = readFileSync("src/instrumentation.ts", "utf8")
    const packageSource = readFileSync("package.json", "utf8")

    expect(packageSource).toContain('"@vercel/otel"')
    expect(instrumentationSource).toContain('process.env.VERCEL === "1"')
    expect(instrumentationSource).toContain("OTEL_EXPORTER_OTLP_ENDPOINT")
    expect(instrumentationSource).toContain("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT")
    expect(instrumentationSource).toContain("registerOTel")
  })

  it("documents cost guardrails and the activation-monitor fallback", () => {
    const runbookSource = readFileSync("docs/OBSERVABILITY.md", "utf8")

    expect(runbookSource).toContain("Web Analytics")
    expect(runbookSource).toContain("Speed Insights")
    expect(runbookSource).toContain("sampleRate={0.5}")
    expect(runbookSource).toContain("Runtime logs")
    expect(runbookSource).toContain("OpenTelemetry")
    expect(runbookSource).toContain("activation-monitor")
    expect(runbookSource).toContain("Do not add Vercel Web Analytics custom events")
  })
})
