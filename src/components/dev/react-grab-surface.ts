"use client"

export type ReactGrabOwnerDescriptor = {
  ownerId: string
  component: string
  source: string
  slot?: string
  variant?: string
  canonicalOwnerSource?: string
  canonicalOwnerReason?: string
  currentWrongOwnerSource?: string
  currentWrongOwnerReason?: string
  tokenSource?: string
  primitiveImport?: string
  notes?: string
}

export type ReactGrabLinkedSurfaceDescriptor = {
  ownerId: string
  component: string
  source: string
  slot?: string
  surfaceKind: "trigger" | "content" | "indicator" | "portal" | "root"
  canonicalOwnerSource?: string
  canonicalOwnerReason?: string
  currentWrongOwnerSource?: string
  currentWrongOwnerReason?: string
  tokenSource?: string
  primitiveImport?: string
  notes?: string
}

function withOptionalStringProps(
  base: Record<string, string>,
  optional: Record<string, string | undefined>
) {
  const next = { ...base }

  for (const [key, value] of Object.entries(optional)) {
    if (!value) continue
    next[key] = value
  }

  return next
}

export function getReactGrabOwnerProps(descriptor: ReactGrabOwnerDescriptor) {
  return withOptionalStringProps(
    {
      "data-react-grab-anchor": descriptor.component,
      "data-react-grab-owner-id": descriptor.ownerId,
      "data-react-grab-owner-component": descriptor.component,
      "data-react-grab-owner-source": descriptor.source,
      // Keep legacy linkage during the migration window.
      "data-react-grab-link-id": descriptor.ownerId,
    },
    {
      "data-react-grab-owner-slot": descriptor.slot,
      "data-react-grab-owner-variant": descriptor.variant,
      "data-react-grab-canonical-owner-source": descriptor.canonicalOwnerSource,
      "data-react-grab-canonical-owner-reason": descriptor.canonicalOwnerReason,
      "data-react-grab-current-wrong-owner-source":
        descriptor.currentWrongOwnerSource,
      "data-react-grab-current-wrong-owner-reason":
        descriptor.currentWrongOwnerReason,
      "data-react-grab-token-source": descriptor.tokenSource,
      "data-react-grab-primitive-import": descriptor.primitiveImport,
      "data-react-grab-notes": descriptor.notes,
    }
  )
}

export function getReactGrabLinkedSurfaceProps(
  descriptor: ReactGrabLinkedSurfaceDescriptor
) {
  return withOptionalStringProps(
    {
      "data-react-grab-link-id": descriptor.ownerId,
      "data-react-grab-surface-component": descriptor.component,
      "data-react-grab-surface-source": descriptor.source,
      "data-react-grab-surface-kind": descriptor.surfaceKind,
    },
    {
      "data-react-grab-surface-slot": descriptor.slot,
      "data-react-grab-canonical-owner-source": descriptor.canonicalOwnerSource,
      "data-react-grab-canonical-owner-reason": descriptor.canonicalOwnerReason,
      "data-react-grab-current-wrong-owner-source":
        descriptor.currentWrongOwnerSource,
      "data-react-grab-current-wrong-owner-reason":
        descriptor.currentWrongOwnerReason,
      "data-react-grab-token-source": descriptor.tokenSource,
      "data-react-grab-primitive-import": descriptor.primitiveImport,
      "data-react-grab-notes": descriptor.notes,
    }
  )
}

// Inspection policy is separate from ownership: leaves remain selectable while
// their normal runtime behavior stays under their original component's control.
export function getReactGrabInspectionProps(
  mode: "granular" | "preview" | "overlay"
) {
  if (mode === "overlay") return { "data-react-grab-preview-overlay": "true" }
  return {
    "data-react-grab-granular": "true",
    ...(mode === "preview" ? { "data-react-grab-preview": "true" } : {}),
  }
}
