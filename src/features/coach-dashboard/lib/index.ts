export function buildActivityDays(timestamps: string[], now: Date) {
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  )
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - 364)
  start.setUTCDate(start.getUTCDate() - start.getUTCDay())
  const counts = new Map<string, number>()
  const key = (date: Date) =>
    `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`
  for (const value of timestamps) {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime()) && date >= start && date <= now)
      counts.set(key(date), (counts.get(key(date)) ?? 0) + 1)
  }
  const days: { date: string; count: number; future: boolean }[] = []
  for (
    let day = new Date(start);
    day <= end || day.getUTCDay() !== 0;
    day.setUTCDate(day.getUTCDate() + 1)
  ) {
    days.push({
      date: `${day.getUTCFullYear()}-${String(day.getUTCMonth() + 1).padStart(2, "0")}-${String(day.getUTCDate()).padStart(2, "0")}`,
      count: counts.get(key(day)) ?? 0,
      future: day > end,
    })
  }
  return days
}
