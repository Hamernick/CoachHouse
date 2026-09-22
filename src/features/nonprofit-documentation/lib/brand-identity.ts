import type { BrandIdentityColor, BrandIdentityDraft } from "../types"
import { BRAND_FONT_OPTIONS, brandFontStack } from "./brand-fonts"

export const BRAND_IDENTITY_PATH =
  "/documentation/tools/brand-identity" as const

export const BRAND_IDENTITY_STORAGE_KEY =
  "coach-house:documentation:brand-identity:v1"

export const BRAND_IDENTITY_SECTIONS = [
  { id: "foundation", label: "Foundation" },
  { id: "marks", label: "Marks" },
  { id: "color-palette", label: "Color palette" },
  { id: "typography", label: "Typography" },
  { id: "applications", label: "Applications" },
  { id: "exports", label: "Exports" },
] as const

export const DEFAULT_BRAND_IDENTITY_DRAFT: BrandIdentityDraft = {
  version: 1,
  organizationName: "Your nonprofit",
  tagline: "A clear promise to the community you serve.",
  introduction:
    "Describe who you serve, what changes because of your work, and how your organization should feel to the people who encounter it.",
  purpose:
    "Create a consistent identity that helps people recognize, understand, and trust the organization.",
  audience:
    "Community members, volunteers, donors, partners, and public agencies.",
  actionables: ["Donate", "Volunteer", "Apply"],
  logoGuidance:
    "Keep the logo clear, legible, and unchanged. Leave open space around it and use the strongest available contrast.",
  colors: [
    {
      id: "canvas",
      role: "Background",
      name: "",
      value: "#F3F0E8",
      proportion: 50,
    },
    {
      id: "brand",
      role: "Primary",
      name: "",
      value: "#214E3B",
      proportion: 30,
    },
    {
      id: "utility",
      role: "Secondary",
      name: "",
      value: "#FFFFFF",
      proportion: 10,
    },
    {
      id: "ink",
      role: "Text",
      name: "",
      value: "#111310",
      proportion: 10,
    },
  ],
  headingFont: "System Sans",
  bodyFont: "System Sans",
  baseSize: 16,
  typeRatio: 1.25,
  campaignHeadline: "Local action. Lasting change.",
  campaignBody:
    "Invite your community into one clear next step, using language that is specific, respectful, and easy to act on.",
  updatedAt: "",
}

const HEX_PATTERN = /^#?([\da-f]{3}|[\da-f]{6})$/i

const LEGACY_DEFAULT_COLOR_NAMES: Record<BrandIdentityColor["id"], string[]> = {
  canvas: ["Community cream", "Warm canvas"],
  brand: ["Mission green"],
  utility: ["White"],
  ink: ["Ink"],
}

export function brandColorLabel(color: BrandIdentityColor) {
  const customName = color.name.trim()
  return customName ? `${color.role} — ${customName}` : color.role
}

export function normalizeHex(value: string, fallback = "#000000") {
  const trimmed = value.trim()
  if (!HEX_PATTERN.test(trimmed)) return fallback
  const raw = trimmed.replace("#", "")
  const expanded =
    raw.length === 3
      ? raw
          .split("")
          .map((character) => `${character}${character}`)
          .join("")
      : raw
  return `#${expanded.toUpperCase()}`
}

export function hexToRgb(value: string) {
  const hex = normalizeHex(value).slice(1)
  return {
    red: Number.parseInt(hex.slice(0, 2), 16),
    green: Number.parseInt(hex.slice(2, 4), 16),
    blue: Number.parseInt(hex.slice(4, 6), 16),
  }
}

export function rgbLabel(value: string) {
  const { red, green, blue } = hexToRgb(value)
  return `${red}, ${green}, ${blue}`
}

function linearize(channel: number) {
  const normalized = channel / 255
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(value: string) {
  const { red, green, blue } = hexToRgb(value)
  return (
    0.2126 * linearize(red) +
    0.7152 * linearize(green) +
    0.0722 * linearize(blue)
  )
}

export function contrastRatio(foreground: string, background: string) {
  const first = relativeLuminance(foreground)
  const second = relativeLuminance(background)
  const lighter = Math.max(first, second)
  const darker = Math.min(first, second)
  return (lighter + 0.05) / (darker + 0.05)
}

export function contrastRating(ratio: number) {
  if (ratio >= 7) return "AAA"
  if (ratio >= 4.5) return "AA"
  return "Fail"
}

export function foregroundFor(background: string) {
  return contrastRatio("#111310", background) >=
    contrastRatio("#FFFFFF", background)
    ? "#111310"
    : "#FFFFFF"
}

export function typeScale(baseSize: number, ratio: number) {
  return {
    display: baseSize * ratio ** 4,
    h1: baseSize * ratio ** 3,
    h2: baseSize * ratio ** 2,
    h3: baseSize * ratio,
    body: baseSize,
    caption: baseSize / ratio,
  }
}

export function normalizeProportions(colors: BrandIdentityColor[]) {
  const total = colors.reduce((sum, color) => sum + color.proportion, 0)
  if (total <= 0) return colors.map((color) => ({ ...color, proportion: 25 }))
  return colors.map((color) => ({
    ...color,
    proportion: Number(((color.proportion / total) * 100).toFixed(2)),
  }))
}

export function sanitizeBrandDraft(value: unknown): BrandIdentityDraft {
  if (!value || typeof value !== "object") return DEFAULT_BRAND_IDENTITY_DRAFT
  const candidate = value as Partial<BrandIdentityDraft>
  const colors = Array.isArray(candidate.colors)
    ? DEFAULT_BRAND_IDENTITY_DRAFT.colors.map((fallback) => {
        const saved = candidate.colors?.find(
          (color) => color.id === fallback.id
        )
        return {
          ...fallback,
          ...(saved ?? {}),
          role: fallback.role,
          name: LEGACY_DEFAULT_COLOR_NAMES[fallback.id].includes(
            saved?.name ?? ""
          )
            ? ""
            : (saved?.name ?? fallback.name),
          value: normalizeHex(saved?.value ?? fallback.value, fallback.value),
          proportion: Math.max(
            0,
            Number(saved?.proportion ?? fallback.proportion)
          ),
        }
      })
    : DEFAULT_BRAND_IDENTITY_DRAFT.colors

  return {
    ...DEFAULT_BRAND_IDENTITY_DRAFT,
    ...candidate,
    version: 1,
    actionables: DEFAULT_BRAND_IDENTITY_DRAFT.actionables.map(
      (fallback, index) => {
        const saved = Array.isArray(candidate.actionables)
          ? candidate.actionables[index]
          : undefined
        return typeof saved === "string" ? saved : fallback
      }
    ) as BrandIdentityDraft["actionables"],
    colors,
    headingFont: BRAND_FONT_OPTIONS.some(
      (option) => option.value === candidate.headingFont
    )
      ? candidate.headingFont!
      : DEFAULT_BRAND_IDENTITY_DRAFT.headingFont,
    bodyFont: BRAND_FONT_OPTIONS.some(
      (option) => option.value === candidate.bodyFont
    )
      ? candidate.bodyFont!
      : DEFAULT_BRAND_IDENTITY_DRAFT.bodyFont,
    baseSize: Math.min(20, Math.max(14, Number(candidate.baseSize ?? 16))),
    typeRatio: Math.min(
      1.5,
      Math.max(1.125, Number(candidate.typeRatio ?? 1.25))
    ),
  }
}

export function buildBrandTokens(draft: BrandIdentityDraft) {
  const scale = typeScale(draft.baseSize, draft.typeRatio)
  const colorLines = draft.colors.map(
    (color) => `  --brand-${color.id}: ${normalizeHex(color.value)};`
  )
  return [
    ":root {",
    ...colorLines,
    `  --brand-font-heading: ${brandFontStack(draft.headingFont)};`,
    `  --brand-font-body: ${brandFontStack(draft.bodyFont)};`,
    `  --brand-type-base: ${draft.baseSize}px;`,
    `  --brand-type-ratio: ${draft.typeRatio};`,
    `  --brand-type-display: ${scale.display.toFixed(2)}px;`,
    `  --brand-type-h1: ${scale.h1.toFixed(2)}px;`,
    `  --brand-type-h2: ${scale.h2.toFixed(2)}px;`,
    `  --brand-type-h3: ${scale.h3.toFixed(2)}px;`,
    `  --brand-type-caption: ${scale.caption.toFixed(2)}px;`,
    "}",
    "",
  ].join("\n")
}
