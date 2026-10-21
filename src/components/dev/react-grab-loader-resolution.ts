"use client"

import {
  hasExplicitReactGrabMetadata,
  readElementAttribute,
} from "./react-grab-loader-metadata"
import type { ReactGrabResolutionTrace } from "./react-grab-loader-types"

export {
  hasExplicitReactGrabMetadata,
  readElementAttribute,
  readReactGrabElementMetadata,
  toImportPath,
  uniqueStrings,
} from "./react-grab-loader-metadata"
export {
  resolveReactGrabSourceInfo,
  resolveReactGrabStackChain,
  resolveReactGrabSurfaceLocation,
} from "./react-grab-loader-source"
export type {
  ReactGrabApi,
  ReactGrabElementMetadata,
  ReactGrabPlugin,
  ReactGrabResolutionTrace,
  ReactGrabSelectionContext,
  ReactGrabSourceInfo,
} from "./react-grab-loader-types"

const REACT_GRAB_EXPLICIT_OWNER_OR_LINK_SELECTOR =
  "[data-react-grab-link-id], [data-react-grab-owner-id]"
const REACT_GRAB_EXPLICIT_SURFACE_SELECTOR = [
  "[data-react-grab-surface-component]",
  "[data-react-grab-surface-source]",
  "[data-react-grab-surface-slot]",
  "[data-react-grab-surface-kind]",
].join(", ")
const REACT_GRAB_SLOT_SELECTOR = "[data-slot]"

function querySurfaceElement(element: Element | null, selector: string) {
  return typeof element?.querySelector === "function"
    ? element.querySelector(selector)
    : null
}

function closestSurfaceElement(element: Element | null, selector: string) {
  return typeof element?.closest === "function"
    ? element.closest(selector)
    : null
}

function isGranularSelection(element: Element) {
  return Boolean(
    closestSurfaceElement(element, '[data-react-grab-granular="true"]')
  )
}

export function resolveReactGrabSelectedSurfaceElement(element: Element) {
  if (isGranularSelection(element)) return element
  if (hasExplicitReactGrabMetadata(element)) {
    return element
  }

  const explicitSurface = closestSurfaceElement(
    element,
    REACT_GRAB_EXPLICIT_SURFACE_SELECTOR
  )
  if (explicitSurface) {
    return explicitSurface
  }

  if (readElementAttribute(element, "data-slot")) {
    return element
  }

  return (
    closestSurfaceElement(
      element,
      REACT_GRAB_EXPLICIT_OWNER_OR_LINK_SELECTOR
    ) ??
    querySurfaceElement(element, REACT_GRAB_EXPLICIT_OWNER_OR_LINK_SELECTOR) ??
    querySurfaceElement(element, REACT_GRAB_SLOT_SELECTOR) ??
    element
  )
}

export function buildReactGrabResolutionTrace(
  element: Element,
  target: Element | null,
  resolutionMode: ReactGrabResolutionTrace["resolutionMode"]
): ReactGrabResolutionTrace {
  return {
    selectedTag:
      typeof element.tagName === "string"
        ? element.tagName.toLowerCase()
        : "unknown",
    selectedClasses: readElementAttribute(element, "class") ?? "",
    resolvedOwnerId:
      readElementAttribute(target, "data-react-grab-owner-id") ?? null,
    resolvedOwnerComponent:
      readElementAttribute(target, "data-react-grab-owner-component") ?? null,
    resolvedOwnerSource:
      readElementAttribute(target, "data-react-grab-owner-source") ?? null,
    resolutionMode,
  }
}

export function resolveReactGrabSemanticTarget(
  element: Element
): Element | null {
  if (isGranularSelection(element)) return element
  const directAnchor = element.closest("[data-react-grab-anchor]")
  if (directAnchor) return directAnchor

  const selectedSlot = readElementAttribute(element, "data-slot")
  const explicitSurface = closestSurfaceElement(
    element,
    REACT_GRAB_EXPLICIT_SURFACE_SELECTOR
  )
  if (
    selectedSlot &&
    !hasExplicitReactGrabMetadata(element) &&
    !explicitSurface
  ) {
    return null
  }

  const linkedSurface =
    explicitSurface ??
    closestSurfaceElement(
      element,
      REACT_GRAB_EXPLICIT_OWNER_OR_LINK_SELECTOR
    ) ??
    querySurfaceElement(element, REACT_GRAB_EXPLICIT_OWNER_OR_LINK_SELECTOR)
  const ownerId =
    readElementAttribute(linkedSurface, "data-react-grab-owner-id") ??
    readElementAttribute(linkedSurface, "data-react-grab-link-id")
  if (!ownerId) return null

  return document.querySelector(
    `[data-react-grab-anchor][data-react-grab-owner-id="${ownerId}"]`
  )
}
