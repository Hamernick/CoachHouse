"use client"
import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
export function brandIdentityOwner(
  file: string,
  component: string,
  id: string,
  slot: string,
  notes?: string
) {
  const source = `src/features/nonprofit-documentation/components/brand-identity/${file}.tsx`
  return getReactGrabOwnerProps({
    ownerId: `brand-identity:${id}:${slot}`,
    component,
    source,
    canonicalOwnerSource: source,
    canonicalOwnerReason:
      "Owns this Brand Identity element and its presentation.",
    slot,
    notes,
  })
}
