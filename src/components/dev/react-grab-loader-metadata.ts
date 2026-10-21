"use client"

import type { ReactGrabElementMetadata } from "./react-grab-loader-types"

export function readElementAttribute(element: Element | null, name: string) {
  return typeof element?.getAttribute === "function"
    ? element.getAttribute(name)
    : null
}

export function toImportPath(filePath: string | null) {
  if (!filePath?.startsWith("src/")) return null

  return `@/${filePath.slice(4).replace(/\.[^.]+$/, "")}`
}

export function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

function normalizeOptionalString(value: string | null | undefined) {
  return value && value.length > 0 ? value : null
}

function inferReactGrabSurfaceKind(slot: string | null, fallback = "root") {
  if (!slot) return fallback
  if (slot.includes("content")) return "content"
  if (slot.includes("trigger") || slot === "button") return "trigger"
  if (slot.includes("indicator")) return "indicator"
  return fallback
}

export function readReactGrabElementMetadata(
  element: Element | null,
): ReactGrabElementMetadata {
  if (!element) {
    return {
      ownerId: null,
      component: null,
      source: null,
      slot: null,
      surfaceKind: null,
      canonicalOwnerSource: null,
      canonicalOwnerReason: null,
      currentWrongOwnerSource: null,
      currentWrongOwnerReason: null,
      tokenSource: null,
      primitiveImport: null,
      notes: null,
      className: "",
    }
  }

  const particle = typeof element.closest === "function"
    ? element.closest("[data-particle-kind][data-particle-id]")
    : null
  const particleNotes = particle ? [
    `Particle type: ${readElementAttribute(particle, "data-particle-kind")}`,
    `Particle title: ${readElementAttribute(particle, "data-particle-title")}`,
    `Particle id: ${readElementAttribute(particle, "data-particle-id")}`,
    `Storage type: ${readElementAttribute(particle, "data-particle-storage-type")}`,
  ].join("\n") : null

  const slot =
    normalizeOptionalString(
      readElementAttribute(element, "data-react-grab-surface-slot") ??
        readElementAttribute(element, "data-react-grab-owner-slot"),
    ) ?? normalizeOptionalString(readElementAttribute(element, "data-slot"))

  return {
    ownerId: normalizeOptionalString(
      readElementAttribute(element, "data-react-grab-owner-id") ??
        readElementAttribute(element, "data-react-grab-link-id"),
    ),
    component: normalizeOptionalString(
      readElementAttribute(element, "data-react-grab-surface-component") ??
        readElementAttribute(element, "data-react-grab-owner-component") ??
        readElementAttribute(element, "data-slot"),
    ),
    source: normalizeOptionalString(
      readElementAttribute(element, "data-react-grab-surface-source") ??
        readElementAttribute(element, "data-react-grab-owner-source"),
    ),
    slot,
    surfaceKind:
      normalizeOptionalString(
        readElementAttribute(element, "data-react-grab-surface-kind"),
      ) ?? inferReactGrabSurfaceKind(slot, "root"),
    canonicalOwnerSource: normalizeOptionalString(
      readElementAttribute(element, "data-react-grab-canonical-owner-source"),
    ),
    canonicalOwnerReason: normalizeOptionalString(
      readElementAttribute(element, "data-react-grab-canonical-owner-reason"),
    ),
    currentWrongOwnerSource: normalizeOptionalString(
      readElementAttribute(element, "data-react-grab-current-wrong-owner-source"),
    ),
    currentWrongOwnerReason: normalizeOptionalString(
      readElementAttribute(element, "data-react-grab-current-wrong-owner-reason"),
    ),
    tokenSource: normalizeOptionalString(
      readElementAttribute(element, "data-react-grab-token-source"),
    ),
    primitiveImport: normalizeOptionalString(
      readElementAttribute(element, "data-react-grab-primitive-import"),
    ),
    notes: [readElementAttribute(element, "data-react-grab-notes"), particleNotes].filter(Boolean).join("\n") || null,
    className: readElementAttribute(element, "class") ?? "",
  }
}

export function hasExplicitReactGrabMetadata(element: Element | null) {
  if (!element) return false

  return Boolean(
    readElementAttribute(element, "data-react-grab-owner-id") ??
      readElementAttribute(element, "data-react-grab-link-id") ??
      readElementAttribute(element, "data-react-grab-owner-component") ??
      readElementAttribute(element, "data-react-grab-surface-component") ??
      readElementAttribute(element, "data-react-grab-owner-source") ??
      readElementAttribute(element, "data-react-grab-surface-source") ??
      readElementAttribute(element, "data-react-grab-owner-slot") ??
      readElementAttribute(element, "data-react-grab-surface-slot") ??
      readElementAttribute(element, "data-react-grab-surface-kind"),
  )
}
