"use client"

export type ReactGrabPlugin = {
  name: string
  hooks?: {
    onActivate?: () => void
    onDeactivate?: () => void
    onElementSelect?: (element: Element) => boolean | void | Promise<boolean>
    transformCopyContent?: (
      content: string,
      elements: Element[]
    ) => string | Promise<string>
  }
}

export type ReactGrabSourceInfo = {
  file?: string | null
  line?: number | null
  column?: number | null
  importSource?: string | null
  componentName?: string | null
}

export type ReactGrabStackFrame = {
  component?: string | null
  displayName?: string | null
  name?: string | null
  source?: string | null
}

export type ReactGrabApi = {
  isActive?: () => boolean
  copyElement: (elements: Element | Element[]) => Promise<boolean>
  registerPlugin: (plugin: ReactGrabPlugin) => void
  unregisterPlugin: (name: string) => void
  getSource?: (element: Element) => Promise<unknown> | unknown
  getStackContext?: (element: Element) => Promise<unknown> | unknown
  getDisplayName?: (element: Element) => string | null | undefined
}

export type ReactGrabResolutionTrace = {
  selectedTag: string
  selectedClasses: string
  resolvedOwnerId: string | null
  resolvedOwnerComponent: string | null
  resolvedOwnerSource: string | null
  resolutionMode:
    | "direct-anchor"
    | "linked-surface"
    | "legacy-fallback"
    | "none"
}

export type ReactGrabElementMetadata = {
  ownerId: string | null
  component: string | null
  source: string | null
  slot: string | null
  surfaceKind: string | null
  canonicalOwnerSource: string | null
  canonicalOwnerReason: string | null
  currentWrongOwnerSource: string | null
  currentWrongOwnerReason: string | null
  tokenSource: string | null
  primitiveImport: string | null
  notes: string | null
  className: string
}

export type ReactGrabSelectionContext = {
  selectedElement: Element
  selectedSurfaceElement: Element
  targetElement: Element | null
  trace: ReactGrabResolutionTrace
}
