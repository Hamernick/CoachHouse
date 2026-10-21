"use client"

import { useEffect } from "react"
import { setReactGrabInspectionActive } from "./react-grab-preview"
import reactGrabPackage from "react-grab/package.json"

import {
  createReactGrabClipboardTransformer,
  createReactGrabSemanticSelectionHandler,
  type ReactGrabApi,
  type ReactGrabPlugin,
  resolveReactGrabSemanticTarget,
} from "@/components/dev/react-grab-loader-support"

const REACT_GRAB_RUNTIME_ID = "react-grab-runtime"
const REACT_GRAB_OPENCODE_ID = "react-grab-opencode"
const REACT_GRAB_PLUGIN_NAME = "coachhouse-semantic-targeting"
const REACT_GRAB_RUNTIME_SRC = buildReactGrabRuntimeSrc()
const REACT_GRAB_OPENCODE_SRC =
  "https://unpkg.com/@react-grab/opencode@0.1.29/dist/client.global.js"

declare global {
  interface Window {
    __REACT_GRAB__?: ReactGrabApi
  }
}

export {
  createReactGrabClipboardTransformer,
  createReactGrabSemanticSelectionHandler,
  resolveReactGrabSemanticTarget,
}

export function buildReactGrabRuntimeSrc(version = reactGrabPackage.version) {
  return `https://unpkg.com/react-grab@${version}/dist/index.global.js`
}

function registerReactGrabSemanticPlugin({
  traceSelections = false,
}: {
  traceSelections?: boolean
} = {}) {
  const api = window.__REACT_GRAB__
  if (!api) return

  const plugin: ReactGrabPlugin = {
    name: REACT_GRAB_PLUGIN_NAME,
    hooks: {
      onActivate: () => setReactGrabInspectionActive(true),
      onDeactivate: () => setReactGrabInspectionActive(false),
      onElementSelect: createReactGrabSemanticSelectionHandler({
        copyElement: api.copyElement,
        onResolved: traceSelections
          ? (trace) => {
              if (trace.resolutionMode === "none") return
              console.info("[react-grab]", trace)
            }
          : undefined,
      }),
      transformCopyContent: createReactGrabClipboardTransformer({ api }),
    },
  }

  api.unregisterPlugin(REACT_GRAB_PLUGIN_NAME)
  api.registerPlugin(plugin)
  setReactGrabInspectionActive(api.isActive?.() ?? false)
}

function ensureScript({
  id,
  src,
  crossOrigin,
  onLoad,
}: {
  id: string
  src: string
  crossOrigin?: "anonymous" | "use-credentials"
  onLoad?: () => void
}) {
  const existing = document.getElementById(id) as HTMLScriptElement | null
  if (existing) {
    if (existing.dataset.loaded === "1") {
      onLoad?.()
    } else if (onLoad) {
      existing.addEventListener("load", onLoad, { once: true })
    }
    return
  }

  const script = document.createElement("script")
  script.id = id
  script.src = src
  script.async = true
  if (crossOrigin) {
    script.crossOrigin = crossOrigin
  }
  script.dataset.reactGrab = "1"
  script.addEventListener(
    "load",
    () => {
      script.dataset.loaded = "1"
      onLoad?.()
    },
    { once: true }
  )

  document.head.appendChild(script)
}

export function ReactGrabLoader() {
  useEffect(() => {
    const explicitFlag = process.env.NEXT_PUBLIC_ENABLE_REACT_GRAB
    const explicitOpenCodeFlag =
      process.env.NEXT_PUBLIC_ENABLE_REACT_GRAB_OPENCODE
    const host = window.location.hostname
    const isLocalHost =
      host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0"
    const searchParams = new URLSearchParams(window.location.search)
    const isEmbedMode = searchParams.get("embed") === "1"
    const urlEnable =
      searchParams.get("reactGrab") === "1" ||
      searchParams.get("react-grab") === "1"
    const urlDisable =
      searchParams.get("reactGrab") === "0" ||
      searchParams.get("react-grab") === "0"
    const openCodeUrlEnable =
      searchParams.get("reactGrabOpenCode") === "1" ||
      searchParams.get("react-grab-opencode") === "1"
    const openCodeUrlDisable =
      searchParams.get("reactGrabOpenCode") === "0" ||
      searchParams.get("react-grab-opencode") === "0"
    const storageKey = "coachhouse:react-grab-enabled"
    const openCodeStorageKey = "coachhouse:react-grab-opencode-enabled"
    const persisted =
      typeof window !== "undefined"
        ? window.localStorage.getItem(storageKey)
        : null
    const autoLocalDevLoad =
      process.env.NODE_ENV === "development" || isLocalHost
    const allowNonDevRuntime =
      process.env.NODE_ENV === "development" || isLocalHost

    if (urlEnable) {
      window.localStorage.setItem(storageKey, "1")
    } else if (urlDisable) {
      window.localStorage.setItem(storageKey, "0")
    }
    if (openCodeUrlEnable) {
      window.localStorage.setItem(openCodeStorageKey, "1")
    } else if (openCodeUrlDisable) {
      window.localStorage.setItem(openCodeStorageKey, "0")
    }

    const shouldLoad = (() => {
      if (!allowNonDevRuntime) return false
      if (explicitFlag === "0") return false
      if (explicitFlag === "1") return true
      if (urlDisable) return false
      if (urlEnable) return true
      if (persisted === "0") return false
      if (persisted === "1") return true
      return autoLocalDevLoad
    })()
    const shouldLoadOpenCode = (() => {
      if (!allowNonDevRuntime) return false
      if (explicitOpenCodeFlag === "0") return false
      if (explicitOpenCodeFlag === "1") return true
      if (openCodeUrlDisable) return false
      if (openCodeUrlEnable) return true
      return false
    })()

    if (!shouldLoad) return
    if (isEmbedMode) return
    if (window.top !== window.self) return

    const shouldTraceSelections =
      process.env.NEXT_PUBLIC_ENABLE_REACT_GRAB_TRACE === "1"
    const handleInit = () => {
      registerReactGrabSemanticPlugin({
        traceSelections: shouldTraceSelections,
      })
    }

    window.addEventListener("react-grab:init", handleInit)

    ensureScript({
      id: REACT_GRAB_RUNTIME_ID,
      src: REACT_GRAB_RUNTIME_SRC,
      crossOrigin: "anonymous",
      onLoad: () => {
        registerReactGrabSemanticPlugin({
          traceSelections: shouldTraceSelections,
        })
        if (!shouldLoadOpenCode) {
          const existingOpenCodeScript = document.getElementById(
            REACT_GRAB_OPENCODE_ID
          )
          existingOpenCodeScript?.remove()
          return
        }
        ensureScript({
          id: REACT_GRAB_OPENCODE_ID,
          src: REACT_GRAB_OPENCODE_SRC,
        })
      },
    })

    return () => {
      window.removeEventListener("react-grab:init", handleInit)
      window.__REACT_GRAB__?.unregisterPlugin(REACT_GRAB_PLUGIN_NAME)
      setReactGrabInspectionActive(false)
    }
  }, [])

  return null
}
