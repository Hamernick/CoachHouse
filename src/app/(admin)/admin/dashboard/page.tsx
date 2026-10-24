import type { Metadata } from "next"
import {
  CoachDashboardPanel,
  loadCoachDashboard,
} from "@/features/coach-dashboard"

export const metadata: Metadata = {
  title: "Coach Dashboard",
  description: "Review assigned organizations, progress, and coaching activity.",
}


export default async function CoachDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>
}) {
  const params = await searchParams
  const input = await loadCoachDashboard(
    params.scope === "all" ? "all" : "assigned"
  )
  return <CoachDashboardPanel input={input} />
}
