export const FUNDRAISING_PERIODS = [
  { value: "monthly", label: "Monthly" },
  { value: "annually", label: "Annually" },
  { value: "total", label: "Total" },
] as const

export type FundraisingPeriod = (typeof FUNDRAISING_PERIODS)[number]["value"]
export type FundraisingGoal = { amountCents: number | null; period: FundraisingPeriod }

export function isFundraisingPeriod(value: unknown): value is FundraisingPeriod {
  return FUNDRAISING_PERIODS.some((option) => option.value === value)
}

export function parseFundraisingAmount(value: string): number | null {
  const text = value.trim()
  if (!/^\$?\s*(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text)) return null
  const cents = Math.round(Number(text.replace(/[$,\s]/g, "")) * 100)
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null
}

export function readFundraisingGoal(metadata: unknown): FundraisingGoal | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null
  const goal = (metadata as Record<string, unknown>).fundraisingGoal
  if (!goal || typeof goal !== "object" || Array.isArray(goal)) return null
  const { amountCents, period } = goal as Record<string, unknown>
  if (!isFundraisingPeriod(period)) return null
  if (amountCents !== null && (typeof amountCents !== "number" || !Number.isSafeInteger(amountCents) || amountCents <= 0)) return null
  return { amountCents: amountCents as number | null, period }
}

export function hasFundraisingGoal(metadata: unknown) {
  return Boolean(metadata && typeof metadata === "object" && !Array.isArray(metadata)
    && Object.hasOwn(metadata, "fundraisingGoal"))
}
