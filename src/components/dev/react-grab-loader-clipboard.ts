"use client"

import { buildReactGrabClipboardReport } from "@/components/dev/react-grab-clipboard-report"
import { getReactGrabDebugSurfaceRecord } from "@/components/dev/react-grab-debug-surface"

import {
  type ReactGrabApi,
  type ReactGrabSelectionContext,
  hasExplicitReactGrabMetadata,
  readReactGrabElementMetadata,
  resolveReactGrabSemanticTarget,
  resolveReactGrabSelectedSurfaceElement,
  resolveReactGrabSourceInfo,
  resolveReactGrabStackChain,
  resolveReactGrabSurfaceLocation,
  toImportPath,
  uniqueStrings,
} from "./react-grab-loader-resolution"

function sanitizeReactGrabCopyContent(content: string) {
  return content.replace(/\sdata-react-grab-[a-z-]+="[^"]*"/g, "")
}

export async function buildReactGrabClipboardOutput({
  api,
  content,
  elements,
  selectionContext,
}: {
  api: ReactGrabApi
  content: string
  elements: Element[]
  selectionContext: ReactGrabSelectionContext | null
}) {
  const selectedSurfaceElement =
    selectionContext?.selectedSurfaceElement ??
    elements[0] ??
    selectionContext?.selectedElement ??
    null
  const targetElement =
    selectionContext?.targetElement ??
    (selectedSurfaceElement
      ? resolveReactGrabSemanticTarget(selectedSurfaceElement)
      : null) ??
    elements[0] ??
    null

  if (!selectedSurfaceElement && !targetElement) {
    return sanitizeReactGrabCopyContent(content)
  }

  const selectedSurfaceMetadata =
    readReactGrabElementMetadata(selectedSurfaceElement)
  const ownerMetadata = readReactGrabElementMetadata(targetElement)
  const ownerId = selectedSurfaceMetadata.ownerId ?? ownerMetadata.ownerId ?? null
  const selectedSurfaceHasExplicitMetadata =
    hasExplicitReactGrabMetadata(selectedSurfaceElement)
  const debugRecord =
    ownerId && selectedSurfaceHasExplicitMetadata
      ? getReactGrabDebugSurfaceRecord({
          ownerId,
          component:
            selectedSurfaceMetadata.component ?? ownerMetadata.component ?? null,
          slot: selectedSurfaceMetadata.slot ?? ownerMetadata.slot ?? null,
          surfaceKind:
            selectedSurfaceMetadata.surfaceKind ??
            ownerMetadata.surfaceKind ??
            null,
          source: selectedSurfaceMetadata.source ?? null,
          strict: true,
        })
      : null
  const selectedSourceInfo = await resolveReactGrabSourceInfo(
    api,
    selectedSurfaceElement,
  )
  const ownerSourceInfo = await resolveReactGrabSourceInfo(api, targetElement)
  const stackChain = await resolveReactGrabStackChain(api, selectedSurfaceElement)
  const displayName =
    api.getDisplayName?.(selectedSurfaceElement ?? targetElement ?? elements[0]!) ??
    null
  const surfaceComponent =
    selectedSurfaceMetadata.component ??
    displayName ??
    selectedSourceInfo?.componentName ??
    ownerMetadata.component ??
    "Unknown"
  const surfaceSource =
    selectedSurfaceMetadata.source ?? selectedSourceInfo?.file ?? null
  const primitiveImport =
    debugRecord?.primitiveImport ??
    selectedSurfaceMetadata.primitiveImport ??
    selectedSourceInfo?.importSource ??
    toImportPath(surfaceSource)
  const classAssemblyFile = debugRecord?.classAssemblyFile ?? surfaceSource
  const tokenSource =
    debugRecord?.tokenSource ?? selectedSurfaceMetadata.tokenSource ?? null
  const finalClassName =
    debugRecord?.className ?? selectedSurfaceMetadata.className ?? ""
  const chainValues = uniqueStrings([
    ...stackChain,
    ownerMetadata.component,
    surfaceComponent,
  ])
  return buildReactGrabClipboardReport({
    surfaceComponent,
    slot: selectedSurfaceMetadata.slot ?? ownerMetadata.slot ?? "unknown",
    surfaceKind:
      selectedSurfaceMetadata.surfaceKind ??
      ownerMetadata.surfaceKind ??
      "unknown",
    importSource: primitiveImport,
    sourceLocation: resolveReactGrabSurfaceLocation({
      selectedSurfaceSource: surfaceSource,
      selectedSourceInfo,
    }),
    ownerId,
    ownerComponent: ownerMetadata.component,
    ownerSource: ownerMetadata.source ?? ownerSourceInfo?.file ?? null,
    classAssemblyFile,
    tokenSource,
    canonicalOwnerSource:
      debugRecord?.canonicalOwnerFile ??
      selectedSurfaceMetadata.canonicalOwnerSource ??
      ownerMetadata.canonicalOwnerSource,
    canonicalOwnerReason:
      debugRecord?.canonicalOwnerReason ??
      selectedSurfaceMetadata.canonicalOwnerReason ??
      ownerMetadata.canonicalOwnerReason,
    currentWrongOwnerSource:
      debugRecord?.currentWrongOwnerFile ??
      selectedSurfaceMetadata.currentWrongOwnerSource ??
      ownerMetadata.currentWrongOwnerSource,
    currentWrongOwnerReason:
      debugRecord?.currentWrongOwnerReason ??
      selectedSurfaceMetadata.currentWrongOwnerReason ??
      ownerMetadata.currentWrongOwnerReason,
    finalClassName,
    chainValues,
    notes: uniqueStrings([debugRecord?.notes, selectedSurfaceMetadata.notes, ownerMetadata.notes]).join("\n") || null,
  })
}
