import { BRAND_FONT_OPTIONS as DOCUMENTATION_FONTS } from "@/features/nonprofit-documentation"
import type {
  BrandTypographyConfig,
  BrandTypographySlot,
  BrandTypographyTracking,
  OrgProfile,
} from "@/lib/organization/org-profile-brand-types"

export type {
  BrandTypographyConfig,
  BrandTypographyTracking,
} from "@/lib/organization/org-profile-brand-types"

export type BrandFontCategory = "Sans Serif" | "Serif" | "Monospace"

export type BrandFontOption = {
  id: string
  label: string
  category: BrandFontCategory
}

export type BrandTypographyPreset = {
  id: string
  label: string
  headingFontLabel: string
  bodyFontLabel: string
  preview: string
  typography: BrandTypographyConfig
}

export type BrandThemePreset = {
  id: string
  label: string
  description: string
  swatches: string[]
  primaryColor: string
  supportingColors: string[]
  accentPresetId: string
  typographyPresetId: string
}

export type BrandAccentPreset = {
  id: string
  label: string
  color: string
  swatches: string[]
}

export const BRAND_FONT_OPTIONS: BrandFontOption[] = [
  { id: "geist", label: "Geist", category: "Sans Serif" },
  { id: "karla", label: "Karla", category: "Sans Serif" },
  { id: "inter", label: "Inter", category: "Sans Serif" },
  { id: "inter-tight", label: "Inter Tight", category: "Sans Serif" },
  { id: "mona-sans", label: "Mona Sans", category: "Sans Serif" },
  { id: "roboto", label: "Roboto", category: "Sans Serif" },
  { id: "space-grotesk", label: "Space Grotesk", category: "Sans Serif" },
  { id: "ibm-plex-sans", label: "IBM Plex Sans", category: "Sans Serif" },
  { id: "public-sans", label: "Public Sans", category: "Sans Serif" },
  { id: "source-sans-3", label: "Source Sans 3", category: "Sans Serif" },
  { id: "work-sans", label: "Work Sans", category: "Sans Serif" },
  { id: "satoshi", label: "Satoshi", category: "Sans Serif" },
  { id: "alegreya-sans", label: "Alegreya Sans", category: "Sans Serif" },
  { id: "fraunces", label: "Fraunces", category: "Serif" },
  { id: "cormorant-garamond", label: "Cormorant Garamond", category: "Serif" },
  { id: "geist-mono", label: "Geist Mono", category: "Monospace" },
  { id: "ibm-plex-mono", label: "IBM Plex Mono", category: "Monospace" },
]

export const BRAND_FONT_OPTION_MAP = new Map(
  BRAND_FONT_OPTIONS.map((option) => [option.label, option]),
)

export const BRAND_FONT_WEIGHT_OPTIONS = ["300", "400", "500", "600", "700", "800"] as const

export const BRAND_TRACKING_OPTIONS: Array<{
  value: BrandTypographyTracking
  label: string
}> = [
  { value: "tighter", label: "Tighter" },
  { value: "tight", label: "Tight" },
  { value: "normal", label: "Normal" },
  { value: "wide", label: "Wide" },
  { value: "wider", label: "Wider" },
]

export const DEFAULT_BRAND_TYPOGRAPHY_PRESET_ID = "civic-sans"
export const DEFAULT_BRAND_THEME_PRESET_ID = "default"

function createSlot(
  family: string,
  weight: string,
  tracking: BrandTypographyTracking,
): BrandTypographySlot {
  return { family, weight, tracking }
}

function createTypography(
  headings: BrandTypographySlot,
  body: BrandTypographySlot,
  codeFamily: string,
): BrandTypographyConfig {
  return {
    headings,
    body,
    code: {
      family: codeFamily,
    },
  }
}

export const BRAND_TYPOGRAPHY_PRESETS: BrandTypographyPreset[] = [
  {
    id: "civic-sans",
    label: "Civic Sans",
    headingFontLabel: "Satoshi",
    bodyFontLabel: "Geist",
    preview: "Clear, modern, and institutional.",
    typography: createTypography(
      createSlot("Satoshi", "700", "tight"),
      createSlot("Geist", "400", "normal"),
      "Geist Mono",
    ),
  },
  {
    id: "editorial-serif",
    label: "Editorial Serif",
    headingFontLabel: "Cormorant Garamond",
    bodyFontLabel: "Source Sans 3",
    preview: "Formal headlines with a readable body.",
    typography: createTypography(
      createSlot("Cormorant Garamond", "700", "tight"),
      createSlot("Source Sans 3", "400", "normal"),
      "Geist Mono",
    ),
  },
  {
    id: "modern-grotesk",
    label: "Modern Grotesk",
    headingFontLabel: "Space Grotesk",
    bodyFontLabel: "IBM Plex Sans",
    preview: "Sharp, product-forward, and contemporary.",
    typography: createTypography(
      createSlot("Space Grotesk", "600", "normal"),
      createSlot("IBM Plex Sans", "400", "normal"),
      "IBM Plex Mono",
    ),
  },
  {
    id: "humanist",
    label: "Humanist",
    headingFontLabel: "Alegreya Sans",
    bodyFontLabel: "Public Sans",
    preview: "Warm, accessible, and community-oriented.",
    typography: createTypography(
      createSlot("Alegreya Sans", "700", "normal"),
      createSlot("Public Sans", "400", "normal"),
      "Geist Mono",
    ),
  },
  {
    id: "technical",
    label: "Technical",
    headingFontLabel: "IBM Plex Sans",
    bodyFontLabel: "IBM Plex Sans",
    preview: "Operational, system-oriented, and precise.",
    typography: createTypography(
      createSlot("IBM Plex Sans", "600", "wide"),
      createSlot("IBM Plex Sans", "400", "normal"),
      "IBM Plex Mono",
    ),
  },
  {
    id: "warm-classic",
    label: "Warm Classic",
    headingFontLabel: "Fraunces",
    bodyFontLabel: "Work Sans",
    preview: "Friendly, editorial, and grounded.",
    typography: createTypography(
      createSlot("Fraunces", "600", "tight"),
      createSlot("Work Sans", "400", "normal"),
      "Geist Mono",
    ),
  },
]

export const BRAND_TYPOGRAPHY_PRESET_MAP = new Map(
  BRAND_TYPOGRAPHY_PRESETS.map((preset) => [preset.id, preset]),
)

export const BRAND_THEME_PRESETS: BrandThemePreset[] = [
  {
    id: "default",
    label: "Default",
    description: "Balanced grayscale with a neutral civic accent.",
    swatches: ["#E7E5E4", "#A8A29E", "#292524"],
    primaryColor: "#57534E",
    supportingColors: ["#E7E5E4", "#D6D3D1", "#A8A29E", "#292524"],
    accentPresetId: "amber",
    typographyPresetId: "civic-sans",
  },
  {
    id: "bourbon",
    label: "Bourbon",
    description: "Warm caramel tones with a grounded editorial feel.",
    swatches: ["#9A3412", "#78350F", "#1C1917"],
    primaryColor: "#9A3412",
    supportingColors: ["#FED7AA", "#FDBA74", "#78350F", "#1C1917"],
    accentPresetId: "orange",
    typographyPresetId: "warm-classic",
  },
  {
    id: "catppuccin",
    label: "Catppuccin",
    description: "Soft mauves and blues for a polished, calm identity.",
    swatches: ["#C4B5FD", "#93C5FD", "#312E81"],
    primaryColor: "#8B5CF6",
    supportingColors: ["#E9D5FF", "#C4B5FD", "#93C5FD", "#312E81"],
    accentPresetId: "violet",
    typographyPresetId: "civic-sans",
  },
  {
    id: "desert-mirage",
    label: "Desert Mirage",
    description: "Muted clay and sage colors with a spacious editorial palette.",
    swatches: ["#F59E0B", "#FCA5A5", "#57534E"],
    primaryColor: "#D97706",
    supportingColors: ["#FDE68A", "#FDBA74", "#FCA5A5", "#57534E"],
    accentPresetId: "amber",
    typographyPresetId: "editorial-serif",
  },
  {
    id: "focus",
    label: "Focus",
    description: "High-contrast indigo with a product-style edge.",
    swatches: ["#7C3AED", "#312E81", "#0F172A"],
    primaryColor: "#7C3AED",
    supportingColors: ["#DDD6FE", "#A78BFA", "#312E81", "#0F172A"],
    accentPresetId: "purple",
    typographyPresetId: "modern-grotesk",
  },
  {
    id: "ghibli",
    label: "Ghibli",
    description: "Soft moss, wheat, and warm greens for community-focused brands.",
    swatches: ["#CA8A04", "#BEF264", "#365314"],
    primaryColor: "#A16207",
    supportingColors: ["#FEF08A", "#D9F99D", "#BEF264", "#365314"],
    accentPresetId: "green",
    typographyPresetId: "humanist",
  },
  {
    id: "monokai",
    label: "Monokai",
    description: "Vivid neon set anchored by charcoal neutrals.",
    swatches: ["#F43F5E", "#67E8F9", "#3F3F46"],
    primaryColor: "#F43F5E",
    supportingColors: ["#FDA4AF", "#67E8F9", "#A3E635", "#3F3F46"],
    accentPresetId: "rose",
    typographyPresetId: "technical",
  },
  {
    id: "neon-dreams",
    label: "Neon Dreams",
    description: "Electric magenta and cyan for bold, digital-forward brands.",
    swatches: ["#C026D3", "#22D3EE", "#1E1B4B"],
    primaryColor: "#C026D3",
    supportingColors: ["#F5D0FE", "#E879F9", "#22D3EE", "#1E1B4B"],
    accentPresetId: "fuchsia",
    typographyPresetId: "modern-grotesk",
  },
  {
    id: "neon-void",
    label: "Neon Void",
    description: "Dark graphite with lime energy and strong contrast.",
    swatches: ["#D9F99D", "#111827", "#030712"],
    primaryColor: "#84CC16",
    supportingColors: ["#ECFCCB", "#D9F99D", "#374151", "#030712"],
    accentPresetId: "lime",
    typographyPresetId: "technical",
  },
  {
    id: "nimble",
    label: "Nimble",
    description: "Clean blue and gray tones with a crisp utilitarian feel.",
    swatches: ["#3B82F6", "#94A3B8", "#1E293B"],
    primaryColor: "#2563EB",
    supportingColors: ["#BFDBFE", "#93C5FD", "#94A3B8", "#1E293B"],
    accentPresetId: "blue",
    typographyPresetId: "civic-sans",
  },
  {
    id: "pumpkin-spice",
    label: "Pumpkin Spice",
    description: "Autumnal oranges with cocoa grounding.",
    swatches: ["#FB923C", "#FDBA74", "#7C2D12"],
    primaryColor: "#EA580C",
    supportingColors: ["#FED7AA", "#FDBA74", "#FDBA74", "#7C2D12"],
    accentPresetId: "orange",
    typographyPresetId: "warm-classic",
  },
  {
    id: "skyline",
    label: "Skyline",
    description: "Sky blues and slate tones for optimistic clarity.",
    swatches: ["#60A5FA", "#818CF8", "#1E3A8A"],
    primaryColor: "#2563EB",
    supportingColors: ["#DBEAFE", "#93C5FD", "#818CF8", "#1E3A8A"],
    accentPresetId: "sky",
    typographyPresetId: "civic-sans",
  },
  {
    id: "starbucks",
    label: "Starbucks",
    description: "Deep green with supportive earthy neutrals.",
    swatches: ["#047857", "#065F46", "#1F2937"],
    primaryColor: "#047857",
    supportingColors: ["#A7F3D0", "#6EE7B7", "#065F46", "#1F2937"],
    accentPresetId: "emerald",
    typographyPresetId: "humanist",
  },
  {
    id: "vercel",
    label: "Vercel",
    description: "Black and white minimalism with crisp contrast.",
    swatches: ["#FAFAFA", "#A3A3A3", "#171717"],
    primaryColor: "#171717",
    supportingColors: ["#FAFAFA", "#E5E5E5", "#A3A3A3", "#404040"],
    accentPresetId: "yellow",
    typographyPresetId: "technical",
  },
]

export const BRAND_THEME_PRESET_MAP = new Map(
  BRAND_THEME_PRESETS.map((preset) => [preset.id, preset]),
)

export const BRAND_ACCENT_PRESETS: BrandAccentPreset[] = [
  { id: "amber", label: "Amber", color: "#F59E0B", swatches: ["#F59E0B", "#292524"] },
  { id: "blue", label: "Blue", color: "#2563EB", swatches: ["#2563EB", "#1E293B"] },
  { id: "cyan", label: "Cyan", color: "#06B6D4", swatches: ["#06B6D4", "#164E63"] },
  { id: "emerald", label: "Emerald", color: "#10B981", swatches: ["#10B981", "#064E3B"] },
  { id: "fuchsia", label: "Fuchsia", color: "#C026D3", swatches: ["#C026D3", "#581C87"] },
  { id: "green", label: "Green", color: "#65A30D", swatches: ["#65A30D", "#365314"] },
  { id: "indigo", label: "Indigo", color: "#4F46E5", swatches: ["#4F46E5", "#312E81"] },
  { id: "lime", label: "Lime", color: "#84CC16", swatches: ["#84CC16", "#365314"] },
  { id: "orange", label: "Orange", color: "#EA580C", swatches: ["#EA580C", "#7C2D12"] },
  { id: "pink", label: "Pink", color: "#EC4899", swatches: ["#EC4899", "#831843"] },
  { id: "purple", label: "Purple", color: "#7C3AED", swatches: ["#7C3AED", "#4C1D95"] },
  { id: "red", label: "Red", color: "#EF4444", swatches: ["#EF4444", "#7F1D1D"] },
  { id: "rose", label: "Rose", color: "#F43F5E", swatches: ["#F43F5E", "#881337"] },
  { id: "sky", label: "Sky", color: "#0EA5E9", swatches: ["#0EA5E9", "#0C4A6E"] },
  { id: "teal", label: "Teal", color: "#14B8A6", swatches: ["#14B8A6", "#134E4A"] },
  { id: "violet", label: "Violet", color: "#8B5CF6", swatches: ["#8B5CF6", "#4C1D95"] },
  { id: "yellow", label: "Yellow", color: "#EAB308", swatches: ["#EAB308", "#713F12"] },
]

export const BRAND_ACCENT_PRESET_MAP = new Map(
  BRAND_ACCENT_PRESETS.map((preset) => [preset.id, preset]),
)

function isTrackingValue(value: unknown): value is BrandTypographyTracking {
  return (
    value === "tighter" ||
    value === "tight" ||
    value === "normal" ||
    value === "wide" ||
    value === "wider"
  )
}

function cloneTypography(config: BrandTypographyConfig): BrandTypographyConfig {
  return {
    headings: { ...config.headings },
    body: { ...config.body },
    code: { ...config.code },
  }
}

export function resolveBrandTypographyPreset(presetId: string | null | undefined) {
  if (!presetId) return null
  return BRAND_TYPOGRAPHY_PRESET_MAP.get(presetId) ?? null
}

export function resolveBrandThemePreset(presetId: string | null | undefined) {
  if (!presetId) return null
  return BRAND_THEME_PRESET_MAP.get(presetId) ?? null
}

export function resolveBrandAccentPreset(presetId: string | null | undefined) {
  if (!presetId) return null
  return BRAND_ACCENT_PRESET_MAP.get(presetId) ?? null
}

export function createBrandTypographyFromPreset(
  presetId: string | null | undefined,
): BrandTypographyConfig {
  const preset =
    resolveBrandTypographyPreset(presetId) ??
    resolveBrandTypographyPreset(DEFAULT_BRAND_TYPOGRAPHY_PRESET_ID)

  return cloneTypography(preset?.typography ?? BRAND_TYPOGRAPHY_PRESETS[0]!.typography)
}

export function sanitizeBrandTypographyConfig(
  config: BrandTypographyConfig | null | undefined,
  presetId?: string | null,
): BrandTypographyConfig {
  const fallback = createBrandTypographyFromPreset(presetId)
  if (!config || typeof config !== "object") return fallback

  const headingsFamily = (BRAND_FONT_OPTION_MAP.has(config.headings?.family ?? "") || DOCUMENTATION_FONTS.some(font => font.value === config.headings?.family))
    ? config.headings.family
    : fallback.headings.family
  const headingsWeight = BRAND_FONT_WEIGHT_OPTIONS.includes(
    (config.headings?.weight ?? "") as (typeof BRAND_FONT_WEIGHT_OPTIONS)[number],
  )
    ? config.headings.weight
    : fallback.headings.weight
  const headingsTracking = isTrackingValue(config.headings?.tracking)
    ? config.headings.tracking
    : fallback.headings.tracking
  const bodyFamily = (BRAND_FONT_OPTION_MAP.has(config.body?.family ?? "") || DOCUMENTATION_FONTS.some(font => font.value === config.body?.family))
    ? config.body.family
    : fallback.body.family
  const bodyWeight = BRAND_FONT_WEIGHT_OPTIONS.includes(
    (config.body?.weight ?? "") as (typeof BRAND_FONT_WEIGHT_OPTIONS)[number],
  )
    ? config.body.weight
    : fallback.body.weight
  const bodyTracking = isTrackingValue(config.body?.tracking)
    ? config.body.tracking
    : fallback.body.tracking
  const codeFamily = BRAND_FONT_OPTION_MAP.has(config.code?.family ?? "")
    ? config.code.family
    : fallback.code.family

  return {
    headings: {
      family: headingsFamily,
      weight: headingsWeight,
      tracking: headingsTracking,
    },
    body: {
      family: bodyFamily,
      weight: bodyWeight,
      tracking: bodyTracking,
    },
    code: {
      family: codeFamily,
    },
  }
}

export function resolveBrandTypographyConfig(
  profile: Pick<OrgProfile, "brandTypography" | "brandTypographyPresetId">,
): BrandTypographyConfig {
  return sanitizeBrandTypographyConfig(
    profile.brandTypography,
    profile.brandTypographyPresetId,
  )
}

export function resolveBrandFontOption(family: string | null | undefined) {
  if (!family) return null
  return BRAND_FONT_OPTION_MAP.get(family) ?? null
}

export function resolveTypographyTrackingLabel(value: BrandTypographyTracking) {
  return BRAND_TRACKING_OPTIONS.find((option) => option.value === value)?.label ?? "Normal"
}
