import { describe, expect, it } from "vitest"
import { priceAiUsage, aiCreditBalance } from "@/features/ai-credits/lib"

const rate = { version: "test",model: "fixture",inputMicrodollarsPerMillion: 2000000,
  cachedMicrodollarsPerMillion: 100000,outputMicrodollarsPerMillion: 10000000,microdollarsPerCredit: 2000 }
describe("AI credit accounting", () => {
  it("prices all output and cached input, rounding only the aggregate", () => {
    expect(priceAiUsage({ input: 6000,cachedInput: 0,output: 1500 },rate)).toEqual({ microdollars: 27000,credits: 14 })
    expect(priceAiUsage({ input: 6000,cachedInput: 1000,output: 1500 },rate)).toEqual({ microdollars: 25100,credits: 13 })
    expect(priceAiUsage({ input: 1,cachedInput: 0,output: 0 },rate)).toEqual({ microdollars: 2,credits: 1 })
  })
  it("rejects missing, impossible or unsafe usage instead of treating it as free", () => {
    for (const input of [-1,NaN,Infinity,1.5,Number.MAX_SAFE_INTEGER])
      expect(() => priceAiUsage({ input,cachedInput: 0,output: 1 },rate)).toThrow()
    expect(() => priceAiUsage({ input: 5,cachedInput: 6,output: 1 },rate)).toThrow()
    expect(() => priceAiUsage({ input: 5,cachedInput: 0,output: 1 },{...rate,microdollarsPerCredit: 0})).toThrow()
  })
  it("excludes spent and reserved credits without manufacturing an allowance percentage", () => {
    expect(aiCreditBalance({ enabled: true,history: [],lots: [
      { kind: "included",expiresAt: "2026-11-01",credits: 500,spent: 200,reserved: 100 },
      { kind: "purchased",expiresAt: null,credits: 1000,spent: 100,reserved: 0 },
    ] })).toEqual({ available: 1100,included: 200,purchased: 900,reserved: 100 })
  })
})
