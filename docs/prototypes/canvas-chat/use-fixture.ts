import { useCallback, useEffect, useRef, useState } from "react"
import type { ComposerContextControl, ComposerContextItem, ComposerContextSelection } from "@/lib/workspace/composer-context"
export type Preview = { id: string; title: string; tasks: string[] }
export type Message = { id: string; role: "user" | "assistant"; text: string; preview?: Preview }
const KEY = "coach-house:canvas-chat-prototype:v1"
export type SavedCard = Preview & { position: { x: number; y: number } }
export function useFixture() {
  const [cards, setCards] = useState<SavedCard[]>(() => { try { return JSON.parse(localStorage.getItem(KEY) ?? "[]") } catch { return [] } })
  const [messages, setMessages] = useState<Message[]>([]), [draft, setDraft] = useState("")
  const [selected, setSelected] = useState<ComposerContextSelection[]>([]), [pending, setPending] = useState(false)
  const [notice, setNotice] = useState("")
  const current = useRef(selected); current.current = selected
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  const set = (items: ComposerContextSelection[]) => { current.current = items; setSelected(items) }
  const search = useCallback(async (query: string) => ({ items: [
      { id: "person:alex", revision: "1", title: "Alex Morgan", group: "People", available: true },
      { id: "document:mission", revision: "1", title: "Our mission", group: "Documents", available: true },
      ...cards.map(card => ({ id: `particle:${card.id}`, revision: "1", title: card.title, group: "Particles" as const, available: true })),
    ].filter(item => item.title.toLowerCase().includes(query.toLowerCase())) as ComposerContextItem[], unavailable: [] }), [cards])
  const context: ComposerContextControl = { selected, search,
    select(item) { const found = current.current.find(x => x.id === item.id); if (found) return found
      if (current.current.length >= 10) throw Error("Choose up to 10 context items.")
      const value = { ...item, token: `@{${item.title}}` }; set([...current.current, value]); return value },
    remove: id => set(current.current.filter(item => item.id !== id)), reconcile: set,
  }
  const send = (value: string) => {
    if (!value.trim() || pending) return
    const text = value.replace(/@\{([^}]+)\}/g, "$1"), id = crypto.randomUUID()
    setMessages(old => [...old, { id, role: "user", text }]); setDraft(""); set([]); setPending(true)
    timer.current = setTimeout(() => {
      const title = text.length > 70 ? `${text.slice(0, 67)}…` : text
      setMessages(old => [...old, { id: `${id}-reply`, role: "assistant", text: "Here’s a starting point. Adjust it on the canvas when you’re ready.", preview: { id, title, tasks: ["Define the outcome and success criteria", "Assign the next steps with your team", "Review progress and decide what comes next"] } }]); setPending(false)
    }, 1100)
  }
  const add = (preview: Preview, position: SavedCard["position"]) => {
    setCards(old => {
      if (old.some(card => card.id === preview.id)) return old
      const next = [...old, { ...preview, position }]
      try { localStorage.setItem(KEY, JSON.stringify(next)); setNotice("Added to this prototype’s canvas") }
      catch { setNotice("Added for this session; browser storage is unavailable") }
      return next
    })
  }
  const move = (id: string, position: SavedCard["position"]) => setCards(old => {
    const next = old.map(card => card.id === id ? { ...card, position } : card)
    try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { setNotice("Position kept for this session only") }
    return next
  })
  return { cards, messages, draft, setDraft, context, pending, send, add, move, notice }
}
