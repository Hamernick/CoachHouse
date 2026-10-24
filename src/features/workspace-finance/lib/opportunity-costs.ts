import { z } from "zod"

export const opportunityCostsSchema = z.strictObject({
  currency: z.literal("USD"),
  items: z.array(z.strictObject({
    id: z.uuid(), title: z.string().trim().max(120),
    amountCents: z.number().int().min(0).max(100_000_000_000).nullable(),
    type: z.enum(["fixed", "variable"]),
  })).max(20),
}).refine(value => new Set(value.items.map(item => item.id)).size === value.items.length, "Each cost item needs a unique ID.")
export type OpportunityCosts = z.infer<typeof opportunityCostsSchema>
export function opportunityCostTotal(costs: OpportunityCosts): number | null {
  const priced = costs.items.filter(item => item.amountCents !== null)
  return priced.length ? priced.reduce((sum, item) => sum + (item.amountCents ?? 0), 0) : null
}
export function formatOpportunityCost(cents: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100)
}
export function parseOpportunityCost(value: string): number | null | undefined {
  if (!value.trim()) return null
  if (!/^\d{1,10}(?:\.\d{0,2})?$/.test(value)) return undefined
  const [whole, fraction = ""] = value.split(".")
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"))
  return cents <= 100_000_000_000 ? cents : undefined
}
