"use client"

import "./picker.css"
import { GoogleDrivePickerError } from "../lib/picker-error"

type PickerDocument = { id?: string; name?: string }
type PickerData = { action?: string; docs?: PickerDocument[] }
type PickerInstance = { setVisible: (visible: boolean) => void }
type PickerBuilder = {
  addView: (view: unknown) => PickerBuilder
  enableFeature: (feature: string) => PickerBuilder
  setAppId: (appId: string) => PickerBuilder
  setCallback: (callback: (data: PickerData) => void) => PickerBuilder
  setDeveloperKey: (key: string) => PickerBuilder
  setOAuthToken: (token: string) => PickerBuilder
  build: () => PickerInstance
}
type PickerNamespace = {
  Action: { PICKED: string; CANCEL: string }
  Feature: { MULTISELECT_ENABLED: string }
  ViewId: { DOCS: string }
  DocsView: new (viewId: string) => unknown
  PickerBuilder: new () => PickerBuilder
}

type PickerWindow = Window & {
  gapi?: {
    load: (
      api: string,
      options: {
        callback: () => void
        onerror: () => void
        timeout: number
        ontimeout: () => void
      }
    ) => void
  }
  google?: { picker?: PickerNamespace }
}

let pickerScriptPromise: Promise<void> | null = null

function loadPickerScript() {
  const pickerWindow = window as PickerWindow
  if (pickerWindow.gapi && pickerWindow.google?.picker) {
    return Promise.resolve()
  }
  if (pickerScriptPromise) return pickerScriptPromise

  pickerScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-google-picker="true"]'
    )
    const script = existing ?? document.createElement("script")
    let settled = false
    const cleanup = () => {
      window.clearTimeout(timeout)
      script.removeEventListener("load", loadPicker)
      script.removeEventListener("error", fail)
    }
    const fail = () => {
      if (settled) return
      settled = true
      cleanup()
      script.remove()
      reject(new GoogleDrivePickerError())
    }
    const ready = () => {
      if (settled) return
      if (!pickerWindow.google?.picker) {
        fail()
        return
      }
      settled = true
      cleanup()
      resolve()
    }
    const loadPicker = () => {
      if (settled) return
      if (!pickerWindow.gapi) {
        fail()
        return
      }
      try {
        pickerWindow.gapi.load("picker", {
          callback: ready,
          onerror: fail,
          timeout: 15000,
          ontimeout: fail,
        })
      } catch {
        fail()
      }
    }
    const timeout = window.setTimeout(fail, 15000)
    if (pickerWindow.gapi) {
      loadPicker()
      return
    }
    script.addEventListener("load", loadPicker, { once: true })
    script.addEventListener("error", fail, { once: true })
    if (!existing) {
      script.src = "https://apis.google.com/js/api.js"
      script.async = true
      script.dataset.googlePicker = "true"
      document.head.append(script)
    }
  }).catch((error) => {
    pickerScriptPromise = null
    throw error
  })

  return pickerScriptPromise
}

export async function pickGoogleDriveFileReferences(
  multiple = false
): Promise<Array<{ id: string; name: string }>> {
  const response = await fetch("/api/integrations/google-drive/picker-token", {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  }).catch(() => {
    throw new GoogleDrivePickerError()
  })
  const token = (await response.json().catch(() => null)) as {
    accessToken?: unknown
    developerKey?: unknown
    appId?: unknown
    code?: unknown
  } | null
  if (!response.ok) throw new GoogleDrivePickerError(token?.code)
  if (
    typeof token?.accessToken !== "string" ||
    !token.accessToken ||
    typeof token.developerKey !== "string" ||
    !token.developerKey ||
    typeof token.appId !== "string" ||
    !token.appId
  )
    throw new GoogleDrivePickerError()
  const { accessToken, developerKey, appId } = token
  await loadPickerScript()
  const picker = (window as PickerWindow).google?.picker
  if (!picker) throw new Error("Google Drive could not open. Try again.")
  return new Promise((resolve) => {
    const builder = new picker.PickerBuilder()
      .addView(new picker.DocsView(picker.ViewId.DOCS))
      .setAppId(appId)
      .setDeveloperKey(developerKey)
      .setOAuthToken(accessToken)
      .setCallback((data) => {
        if (data.action === picker.Action.CANCEL) resolve([])
        if (data.action === picker.Action.PICKED)
          resolve(
            (data.docs ?? [])
              .filter((document): document is { id: string; name?: string } => Boolean(document.id))
              .map((document) => ({ id: document.id, name: document.name?.trim() || "Drive file" }))
          )
      })
    if (multiple) builder.enableFeature(picker.Feature.MULTISELECT_ENABLED)
    builder.build().setVisible(true)
  })
}

export async function pickGoogleDriveFiles(multiple = false): Promise<string[]> {
  return (await pickGoogleDriveFileReferences(multiple)).map((file) => file.id)
}
