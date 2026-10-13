"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { guestProfileFieldsSchema, guestProfilePreviewSchema, type GuestProfileFields, type GuestProfilePreview } from "../lib/guest-profile"
import { FiscalOptionalProfileAuth } from "./fiscal-optional-profile-auth"
import { FiscalProfileSelection } from "./fiscal-profile-selection"
import { usePublicFiscalNavigation } from "./use-public-fiscal-navigation"
import { FiscalPublicLeaveDialog } from "./fiscal-public-draft-status"

const empty: GuestProfileFields = { name: "", description: "", email: "", phone: "" }
async function post(body: object) {
  const response = await fetch("/api/public/fiscal-sponsorship/profile", { method: "POST", credentials: "same-origin", cache: "no-store",
    signal: AbortSignal.timeout(15000), headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const data = await response.json()
  return { response, data }
}
export function FiscalOptionalProfile({ reference }: { reference: string }) {
  const router = useRouter()
  const [state, setState] = useState<"loading" | "auth" | "error" | "preview" | "linked">("loading")
  const [preview, setPreview] = useState<GuestProfilePreview | null>(null)
  const [values, setValues] = useState(empty)
  const [selected, setSelected] = useState<Partial<Record<keyof GuestProfileFields, boolean>>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState("")
  const [working, setWorking] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const pending = useRef<object | null>(null)
  const busy = useRef(false)
  const form = useRef<HTMLFormElement>(null)
  const navigation = usePublicFiscalNavigation(state !== "linked" && (Object.values(selected).some(Boolean) || uncertain || working))
  const load = useCallback(async () => {
    setState("loading"); setMessage("")
    try {
      const { response, data } = await post({ operation: "preview", reference })
      if (response.status === 401) { setState("auth"); return }
      if (!response.ok) { setMessage(data.error ?? "Couldn’t load your profile. Try again."); setState("error"); return }
      if (data.state === "linked") { setState("linked"); return }
      const next = guestProfilePreviewSchema.parse(data)
      setPreview(next); setValues(next.suggestions); setSelected({}); setErrors({}); setState("preview")
    } catch { setMessage("Couldn’t load your profile. Your application is still submitted."); setState("error") }
  }, [reference])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!Object.keys(errors).length) return
    form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, [errors])
  const save = async () => {
    if (busy.current || !preview) return
    if (!pending.current) {
      const fields = preview.isPublic ? {} : Object.fromEntries(Object.entries(values).filter(([key]) => selected[key as keyof GuestProfileFields]))
      const parsed = guestProfileFieldsSchema.safeParse(fields)
      if (!parsed.success) { setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]))); return }
      pending.current = { operation: "save", reference, requestId: crypto.randomUUID(), version: preview.version, fields: parsed.data }
    }
    busy.current = true; setWorking(true); setMessage(""); setErrors({})
    try {
      const { response, data } = await post(pending.current)
      if (response.status >= 500) throw new Error("uncertain")
      if (!response.ok) {
        pending.current = null; setUncertain(false); setMessage(data.error ?? "Unable to save your profile.")
        if (response.status === 409) setState("error")
        if (response.status === 401) setState("auth")
        return
      }
      if (data.state !== "linked") throw new Error("invalid_ack")
      pending.current = null; setUncertain(false); setState("linked")
    } catch { setUncertain(true); setMessage("We couldn’t confirm the save. Retry to check the same request; your application is already submitted.") }
    finally { busy.current = false; setWorking(false) }
  }
  const openProfile = async () => {
    setWorking(true); setMessage("")
    try {
      const { response, data } = await post({ operation: "open", reference })
      if (!response.ok || data.state !== "opened") { setMessage(data.error ?? "Couldn’t open your profile. Try again."); return }
      router.push("/organization/profile")
    } catch { setMessage("Couldn’t open your profile. Your saved details are unchanged.") }
    finally { setWorking(false) }
  }
  return <section className="mx-auto w-full max-w-lg px-4 py-8" aria-labelledby="profile-import-title">
    <FiscalPublicLeaveDialog open={navigation.destination !== null} onCancel={navigation.cancel} onLeave={navigation.leave} />
    <h1 id="profile-import-title" className="text-2xl font-normal tracking-tight">{state === "linked" ? "Application linked" : "Keep your details"}</h1>
    <p className="mt-1 text-sm leading-6 text-muted-foreground">{state === "linked" ? "Your organization profile is linked to this application. Your application is still under review."
      : "Optionally reuse your application in a free organization profile. Verify your application email first; signup and profile saving won’t affect review."}</p>
    {state === "loading" && <p role="status" className="mt-3 text-sm">Loading profile…</p>}
    {state === "auth" && <FiscalOptionalProfileAuth reference={reference} onAuthenticated={() => { void load() }} />}
    {state === "preview" && preview && <form ref={form} noValidate onSubmit={(event) => { event.preventDefault(); void save() }}>
      <fieldset disabled={working || uncertain} className="min-w-0">
        <FiscalProfileSelection preview={preview} values={values} selected={selected} errors={errors}
          onSelect={(key, checked) => setSelected((current) => ({ ...current, [key]: checked }))}
          onChange={(key, value) => setValues((current) => ({ ...current, [key]: value }))} />
      </fieldset>
      <Button type="submit" disabled={working} className="mt-4 min-h-11 rounded-full shadow-none">{working ? "Saving…" : uncertain ? "Retry save" : Object.values(selected).some(Boolean) ? "Save to profile" : "Link without copying"}</Button>
    </form>}
    <p role="status" aria-live="polite" className="mt-3 text-sm text-muted-foreground">{message}</p>
    {state === "error" && <Button variant="outline" onClick={() => { void load() }} className="mt-2 min-h-11 rounded-full shadow-none">Reload preview</Button>}
    {state === "linked" && <p className="mt-3 text-sm text-muted-foreground">You can close this page. Publishing your profile is a separate choice.</p>}
    {state === "linked" && <Button onClick={() => { void openProfile() }} disabled={working} className="mt-3 min-h-11 rounded-full shadow-none">{working ? "Opening profile…" : "Open organization profile"}</Button>}
    {state !== "linked" && <Button asChild variant="link" className="mt-3 min-h-11 px-0"><Link href="/documentation/fiscal-sponsorship">Not now</Link></Button>}
  </section>
}
