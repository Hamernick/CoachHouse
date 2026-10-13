import type { Particle, ParticleType } from "../types"
import { createParticle, particleRegistry } from "./particle-registry"
import { particleSchema } from "./particle-schema"
import { calculateParticleExpression } from "./particle-calculation"

export type PresetFields = {
  when: string
  body: string
  lines: string
  minutes: string
  total: string
  people: string
  currency: string
  options: string
  hex: string
  expression: string
}
export type PresetField = {
  key: keyof PresetFields
  label: string
  input?: "datetime-local" | "number" | "textarea" | "text"
}
export type ParticlePreset = {
  id: string
  label: string
  hint: string
  type: ParticleType
  fields: readonly PresetField[]
}
const core: readonly ParticleType[] = [
  "objective",
  "activity",
  "calendar",
  "people",
  "decision",
  "metric",
  "workflow",
  "finance",
]
export const PARTICLE_PRESETS: readonly ParticlePreset[] = [
  ...core.map((type) => ({
    id: type,
    label: particleRegistry[type].label,
    hint: `Create ${particleRegistry[type].label.toLowerCase()}`,
    type,
    fields: [],
  })),
  {
    id: "event",
    label: "Event",
    hint: "Plan a gathering",
    type: "activity",
    fields: [
      {
        key: "when",
        label: "Starts at (your local time)",
        input: "datetime-local",
      },
    ],
  },
  {
    id: "message",
    label: "Say hi",
    hint: "Draft an email",
    type: "calendar",
    fields: [{ key: "body", label: "Message draft", input: "textarea" }],
  },
  {
    id: "list",
    label: "Checklist",
    hint: "Turn steps into a workflow",
    type: "workflow",
    fields: [
      { key: "lines", label: "Steps (one per line)", input: "textarea" },
    ],
  },
  {
    id: "timer",
    label: "Timer",
    hint: "Make time for focused work",
    type: "activity",
    fields: [{ key: "minutes", label: "Minutes", input: "number" }],
  },
  {
    id: "split",
    label: "Split a bill",
    hint: "Calculate an equal share",
    type: "activity",
    fields: [
      { key: "total", label: "Total", input: "number" },
      { key: "people", label: "People", input: "number" },
      { key: "currency", label: "Currency code" },
    ],
  },
  {
    id: "poll",
    label: "Poll",
    hint: "Record a choice",
    type: "decision",
    fields: [
      { key: "options", label: "Options (one per line)", input: "textarea" },
    ],
  },
  {
    id: "color",
    label: "Color",
    hint: "Keep a color reference",
    type: "activity",
    fields: [{ key: "hex", label: "Hex color" }],
  },
  {
    id: "sum",
    label: "Calculate",
    hint: "Save a calculation",
    type: "activity",
    fields: [{ key: "expression", label: "Expression" }],
  },
]
export const DEFAULT_PRESET_FIELDS: PresetFields = {
  when: "",
  body: "",
  lines: "",
  minutes: "25",
  total: "0",
  people: "2",
  currency: "USD",
  options: "Yes\nNot yet",
  hex: "#34a853",
  expression: "",
}
export function particlePresetQuery(text: string): string | null {
  const value = text.trimStart()
  if (!value.startsWith("/")) return null
  const query = value.slice(1).trim()
  return /^(commands|particles)$/i.test(query) ? "" : query
}
export function filterParticlePresets(query: string) {
  const search = query.trim().toLowerCase()
  return PARTICLE_PRESETS.filter((item) =>
    `${item.id} ${item.label} ${item.hint} ${item.type}`
      .toLowerCase()
      .includes(search)
  )
}
export function buildParticlePreset(
  preset: ParticlePreset,
  input: {
    id: string
    workspaceId: string
    now: string
    title: string
    description: string
    fields: PresetFields
  }
): Particle {
  const base = {
    ...createParticle(preset.type, input),
    title: input.title.trim(),
    description: input.description,
  }
  const f = input.fields
  const lines = (value: string) =>
    value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
  const numeric = (value: string) => (value.trim() ? Number(value) : NaN)
  let result: Particle = base
  if (base.type === "activity") {
    const widget =
      preset.id === "timer"
        ? {
            kind: "timer" as const,
            seconds: numeric(f.minutes) * 60,
            endsAt: null,
          }
        : preset.id === "split"
          ? {
              kind: "split" as const,
              total: numeric(f.total),
              people: numeric(f.people),
              currency: f.currency.trim().toUpperCase(),
            }
          : preset.id === "color"
            ? { kind: "color" as const, hex: f.hex.trim() }
            : preset.id === "sum"
              ? {
                  kind: "calculate" as const,
                  expression: f.expression.trim(),
                  result: calculateParticleExpression(f.expression),
                }
              : preset.id === "event"
                ? {
                    kind: "event" as const,
                    startsAt: f.when ? new Date(f.when).toISOString() : null,
                  }
                : undefined
    result = {
      ...base,
      data: {
        ...base.data,
        template: preset.id === "event" ? "event" : "task",
        ...(widget ? { widget } : {}),
      },
    }
  }
  if (preset.id === "list" && base.type === "workflow")
    result = {
      ...base,
      data: {
        steps: lines(f.lines).map((title, order) => ({
          id: crypto.randomUUID(),
          title,
          order,
          status: "backlog",
        })),
      },
    }
  if (preset.id === "poll" && base.type === "decision")
    result = {
      ...base,
      data: {
        ...base.data,
        outcomes: lines(f.options).map((label, index) => ({
          id: `option-${index + 1}`,
          label,
        })),
      },
    }
  if (preset.id === "message" && base.type === "calendar")
    result = {
      ...base,
      data: {
        entries: [
          {
            id: crypto.randomUUID(),
            title: base.title,
            content: f.body,
            channels: ["email"],
            contentType: "email",
            delivery: "manual",
            scheduledAt: null,
            publishedAt: null,
            cta: "",
            status: "draft",
            order: 0,
          },
        ],
      },
    }
  return particleSchema.parse(result)
}
