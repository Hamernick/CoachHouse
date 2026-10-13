"use client"

import type { ComponentType } from "react"
import FacebookIcon from "lucide-react/dist/esm/icons/facebook"
import HeartIcon from "lucide-react/dist/esm/icons/heart"
import InstagramIcon from "lucide-react/dist/esm/icons/instagram"
import LinkedinIcon from "lucide-react/dist/esm/icons/linkedin"
import MailIcon from "lucide-react/dist/esm/icons/mail"
import PhoneIcon from "lucide-react/dist/esm/icons/phone"
import TwitterIcon from "lucide-react/dist/esm/icons/twitter"

import {
  formatFullOrganizationLocation,
  normalizeOrganizationLocationFields,
} from "@/lib/location/organization-location"
import type { PublicMapOrganization } from "@/lib/queries/public-map-index"
import { buildPublicMapResourceLinks } from "@/lib/public-map/resource-links"
import type { PublicMapOrganizationResourceLink } from "@/lib/public-map/resource-links"
import { stripHtml } from "@/lib/markdown/convert"

export type PublicMapSocialKey = keyof Pick<
  PublicMapOrganization,
  "twitter" | "facebook" | "linkedin" | "instagram"
>

export type OrganizationDetailIcon = ComponentType<{
  className?: string
  "aria-hidden"?: boolean
}>

export type OrganizationDetailSocialLink = {
  key: PublicMapSocialKey
  label: string
  href: string
}

export type OrganizationDetailActionLink = {
  key: string
  label: string
  icon: OrganizationDetailIcon
} & (
  | {
      kind: "link"
      href: string
      external: boolean
    }
  | {
      kind: "copy"
      value: string
    }
)

export type OrganizationDetailStoryField = {
  label: string
  value: string
}

export type OrganizationDetailContactRow = {
  label: string
  value: string
}

const SOCIAL_FIELDS: Array<{
  label: string
  key: PublicMapSocialKey
}> = [
  { label: "Twitter / X", key: "twitter" },
  { label: "Facebook", key: "facebook" },
  { label: "LinkedIn", key: "linkedin" },
  { label: "Instagram", key: "instagram" },
]

export const SOCIAL_ICON_MAP: Record<
  PublicMapSocialKey,
  OrganizationDetailIcon
> = {
  twitter: TwitterIcon,
  facebook: FacebookIcon,
  linkedin: LinkedinIcon,
  instagram: InstagramIcon,
}

export function normalizeHref(value: string | null | undefined) {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export function normalizeText(value: string | null | undefined) {
  if (typeof value !== "string") return ""
  return value.trim()
}

export function normalizeImageSrc(value: string | null | undefined) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (
    /^https?:\/\//i.test(trimmed) ||
    /^data:/i.test(trimmed) ||
    trimmed.startsWith("/")
  ) {
    return trimmed
  }
  if (trimmed.startsWith("//")) return `https:${trimmed}`
  return `https://${trimmed}`
}

export function buildInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "O"
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase()
  return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toUpperCase()
}

export function truncateAtWordBoundary(value: string, maxLength: number) {
  if (value.length <= maxLength) return value
  const sliced = value.slice(0, maxLength)
  const boundary = sliced.lastIndexOf(" ")
  const core = boundary > 0 ? sliced.slice(0, boundary) : sliced
  return `${core.trimEnd()}...`
}

export function formatLocation(organization: PublicMapOrganization) {
  return formatFullOrganizationLocation({
    city: organization.city,
    state: organization.state,
    country: organization.country,
  })
}

export function formatAddressLines(organization: PublicMapOrganization) {
  const normalizedLocation = normalizeOrganizationLocationFields({
    street: organization.addressStreet,
    city: organization.city,
    state: organization.state,
    postal: organization.addressPostal,
    country: organization.country,
  })
  const street = normalizeText(normalizedLocation.street)
  const locality = [
    normalizedLocation.city,
    normalizedLocation.state,
    normalizedLocation.postal,
  ].filter((entry) => entry.length > 0)
  const country = normalizeText(normalizedLocation.country)
  const fallback = normalizeText(organization.address)

  const lines: string[] = []
  if (street) lines.push(street)
  if (locality.length > 0) lines.push(locality.join(", "))
  if (country) lines.push(country)
  if (lines.length === 0 && fallback) {
    lines.push(
      ...fallback
        .split(/\n+/)
        .map((segment) => segment.trim())
        .filter(Boolean)
    )
  }
  return lines
}

export function buildBrandPalette(organization: PublicMapOrganization) {
  const palette = new Set<string>()
  const primary = normalizeText(organization.brandPrimary)
  if (primary) palette.add(primary)
  for (const color of organization.brandColors) {
    const normalized = normalizeText(color)
    if (!normalized) continue
    palette.add(normalized)
  }
  return Array.from(palette)
}

export function resolveAboutText(organization: PublicMapOrganization) {
  return (
    normalizeText(organization.description) ||
    normalizeText(organization.tagline) ||
    normalizeText(organization.mission) ||
    "This organization is publicly listed in the Coach House map index."
  )
}

export function resolveBrandKitDownloadHref(
  organization: PublicMapOrganization
) {
  if (!organization.brandKitAvailable || !organization.publicSlug) return null
  return `/api/public/organizations/${organization.publicSlug}/brand-kit`
}

export function buildSocialLinks(
  organization: PublicMapOrganization
): OrganizationDetailSocialLink[] {
  return SOCIAL_FIELDS.map((field) => ({
    key: field.key,
    label: field.label,
    href: normalizeHref(organization[field.key]),
  })).filter((entry): entry is OrganizationDetailSocialLink =>
    Boolean(entry.href)
  )
}

export function buildStoryFields(
  organization: PublicMapOrganization
): OrganizationDetailStoryField[] {
  return [
    { label: "Origin story", value: normalizeText(organization.originStory) },
    {
      label: "Need",
      value: normalizeText(organization.needStatement),
    },
    { label: "Mission", value: normalizeText(organization.mission) },
    { label: "Vision", value: normalizeText(organization.vision) },
    { label: "Values", value: normalizeText(organization.values) },
    {
      label: "Theory of change",
      value: normalizeText(organization.theoryOfChange),
    },
  ].filter((field) => hasRenderableNarrativeContent(field.value))
}

export function hasRenderableNarrativeContent(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return false
  return stripHtml(trimmed).trim().length > 0 || /<img\b/i.test(trimmed)
}

export function buildContactRows(
  organization: PublicMapOrganization
): OrganizationDetailContactRow[] {
  return [
    { label: "Contact", value: normalizeText(organization.contactName) },
    { label: "Email", value: normalizeText(organization.email) },
    { label: "Phone", value: normalizeText(organization.phone) },
  ].filter((entry) => entry.value.length > 0)
}

export function buildResourceLinks(
  organization: PublicMapOrganization
): PublicMapOrganizationResourceLink[] {
  return buildPublicMapResourceLinks(organization)
}

export function buildActionLinks(
  organization: PublicMapOrganization
): OrganizationDetailActionLink[] {
  const donateHref = normalizeHref(organization.donateUrl)
  const email = normalizeText(organization.email)
  const phone = normalizeText(organization.phone)

  const actions: Array<OrganizationDetailActionLink | null> = [
    email
      ? {
          key: "email",
          kind: "link",
          label: "Email",
          href: `mailto:${email}`,
          external: false,
          icon: MailIcon,
        }
      : null,
    phone
      ? {
          key: "call",
          kind: "copy",
          label: "Call",
          value: phone,
          icon: PhoneIcon,
        }
      : null,
    donateHref
      ? {
          key: "donate",
          kind: "link",
          label: "Donate",
          href: donateHref,
          external: true,
          icon: HeartIcon,
        }
      : null,
  ]

  return actions.filter(
    (action): action is OrganizationDetailActionLink => action !== null
  )
}
