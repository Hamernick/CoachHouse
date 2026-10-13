"use client"

import { useEffect, useState } from "react"
import { RollingNumber } from "@/components/ui/rolling-number"

const numberFormat = new Intl.NumberFormat("en-US")
const format = (value: number) => numberFormat.format(value)
let pendingCount: Promise<number> | undefined

function loadCountOnce() {
  // Share one request across Strict Mode effects and homepage remounts.
  pendingCount ??= fetch("/api/public/resource-map/summary", { signal: AbortSignal.timeout(8000) })
    .then(async (response) => {
      if (!response.ok) throw new Error("Resource count unavailable")
      const { count } = await response.json() as { count: number }
      if (!Number.isSafeInteger(count) || count <= 0) throw new Error("Invalid resource count")
      return count
    })
  return pendingCount
}

function AnimatedCount({ count }: { count: number }) {
  const [value, setValue] = useState(0)
  useEffect(() => { setValue(count) }, [count])
  return <RollingNumber value={value} format={format} damping={20} />
}

export function HomeResourceRollingCount({ reducedMotion }: { reducedMotion: boolean }) {
  const [count, setCount] = useState<number | null>(null)
  useEffect(() => {
    let active = true
    void loadCountOnce().then((value) => { if (active) setCount(value) }).catch(() => {})
    return () => { active = false }
  }, [])

  if (count === null) return <>Find resources in your area.</>
  const formatted = format(count)
  return <>
    <span className="sr-only">Find over {formatted} resources.</span>
    <span aria-hidden="true">
      Find over{" "}
      <span className="inline-grid tabular-nums">
        <span className="invisible col-start-1 row-start-1">{formatted}</span>
        <span className="col-start-1 row-start-1">
          {reducedMotion ? formatted : <AnimatedCount count={count} />}
        </span>
      </span>{" "}
      resources.
    </span>
  </>
}
