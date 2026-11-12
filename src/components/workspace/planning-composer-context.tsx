"use client"
import { createContext, useContext, useRef, useState, type ReactNode } from "react"

type Intent = { kind: "objective" | "opportunity"; submit: (title: string) => Promise<boolean>; maxLength: number }
type PlanningComposer = {
  intent: Intent | null; draft: string; pending: boolean; focusVersion: number
  choose: (intent: Intent) => void; clear: () => void; setDraft: (value: string) => void
  submit: () => Promise<boolean>
}
const Context = createContext<PlanningComposer | null>(null)
export const usePlanningComposer = () => useContext(Context)

/** Local command draft; existing feature owners retain all creation authority. */
export function PlanningComposerProvider({ children }: { children: ReactNode }) {
  const [intent, setIntent] = useState<Intent | null>(null)
  const [draft, setDraft] = useState("")
  const [pending, setPending] = useState(false)
  const [focusVersion, setFocusVersion] = useState(0)
  const busy = useRef(false)
  const clear = () => { if (!busy.current) { setIntent(null); setDraft(""); setFocusVersion(value => value + 1) } }
  const choose = (next: Intent) => { if (!busy.current) { setIntent(next); setFocusVersion(value => value + 1) } }
  const submit = async () => {
    const title = draft.trim()
    if (busy.current || !intent || !title || title.length > intent.maxLength) return false
    busy.current = true; setPending(true)
    try {
      if (!await intent.submit(title)) return false
      setIntent(null); setDraft(""); return true
    } finally { busy.current = false; setPending(false) }
  }
  return <Context.Provider value={{ intent, draft, pending, focusVersion, choose, clear, setDraft, submit }}>{children}</Context.Provider>
}
