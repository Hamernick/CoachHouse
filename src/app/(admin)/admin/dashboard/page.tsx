import {
  CoachDashboardPanel,
  loadCoachDashboard,
} from "@/features/coach-dashboard"

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
