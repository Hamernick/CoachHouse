"use client"

import { useEffect, useRef, useState } from "react"
import type { Editor } from "@tiptap/core"
import { quoteSelectionAssistance, readDocumentAssistance, stopDocumentAssistance } from "../actions"
import { captureTextSelection, replaceTextSelection, selectionIsCurrent, type CapturedTextSelection } from "../lib/text-selection"
import type { AiDocumentProposal, AiDocumentTarget, AiStreamPart } from "../types"
import { aiCreditBalance } from "@/features/ai-credits/client"

type Quote = Awaited<ReturnType<typeof quoteSelectionAssistance>>
export function useSelectionAssistance(editor: Editor) {
  const [selection, setSelection] = useState<CapturedTextSelection | null>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [proposal, setProposal] = useState<AiDocumentProposal | null>(null)
  const [prompt, setPrompt] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const [applied, setApplied] = useState(false)
  const [preview, setPreview] = useState("")
  const [stale, setStale] = useState(false)
  const run = useRef<{ id: string; target: AiDocumentTarget } | null>(null)
  const applying = useRef(false)
  const epoch = useRef(0)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => { epoch.current++; controller.current?.abort() }, [editor])
  useEffect(() => {
    const update = () => setStale(Boolean(selection && !selectionIsCurrent(editor, selection)))
    editor.on("transaction", update)
    return () => { editor.off("transaction", update) }
  }, [editor, selection])
  async function begin() {
    if (selection) return
    const captured = captureTextSelection(editor)
    if (!captured) return
    setSelection(captured); setError(""); setStale(false)
    const version = ++epoch.current
    try { const next = await quoteSelectionAssistance(); if (epoch.current === version) setQuote(next) }
    catch (cause) { if (epoch.current === version) setError(cause instanceof Error ? cause.message : "AI assistance is unavailable.") }
  }
  function discard() {
    if (pending || (run.current && (!proposal || ["running", "reserved", "reconciling"].includes(proposal.status)))) return
    epoch.current++; setSelection(null); setQuote(null); setProposal(null); setPrompt(""); setPreview(""); setError(""); setApplied(false); run.current = null
  }
  async function recover() {
    if (!run.current) return
    const version = epoch.current
    try {
      const result = await readDocumentAssistance(run.current.id, run.current.target)
      if (epoch.current === version) { setProposal(result); setError("") }
    } catch (cause) { if (epoch.current === version) setError(cause instanceof Error ? cause.message : "Unable to recover this request.") }
  }
  async function stop() {
    const current = run.current
    if (!current) return
    try { await stopDocumentAssistance(current.id, current.target); controller.current?.abort(); await recover() }
    catch { setError("Unable to confirm cancellation. Check status before trying again.") }
  }
  async function submit() {
    if (!selection || !quote || pending || !prompt.trim() || applied) return
    if (!selectionIsCurrent(editor, selection)) { setError("The document changed. Discard this request and select the text again."); return }
    if (run.current && (!proposal || ["reserved", "running", "reconciling"].includes(proposal.status))) { setError("Check status before starting another request."); return }
    if (aiCreditBalance(quote.account).available < quote.maximumCredits) { setError("Not enough credits. Your request is still here."); return }
    const previous = proposal
    const target = { ...quote.scope, sectionId: `selection:${selection.id}`, title: "Selected text", revision: selection.id }
    const id = crypto.randomUUID(), version = epoch.current
    run.current = { id, target }; controller.current = new AbortController()
    setPending(true); setError(""); setPreview(""); setProposal(null)
    const current = () => version === epoch.current
    try {
      const response = await fetch("/api/workspace/ai/document", { method: "POST", signal: controller.current.signal,
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, target, prompt,
          selection: { from: selection.from, to: selection.to, html: selection.html },
          maximumCredits: quote.maximumCredits, tariffVersion: quote.tariffVersion,
          ...(previous?.status === "succeeded" ? { reviseRunId: previous.id } : {}) }) })
      if (response.headers.get("content-type")?.includes("application/json")) {
        const body = await response.json()
        if (!current()) return
        if (!response.ok) {
          if (body.reserved === false) { run.current = previous ? { id: previous.id, target } : null; setProposal(previous) }
          throw new Error(body.error ?? "Unable to start this request.")
        }
        setProposal(body.proposal); return
      }
      if (!response.ok || !response.body) throw new Error("Unable to start this request.")
      const reader = response.body.getReader(), decoder = new TextDecoder()
      let buffer = "", terminal = false
      while (true) {
        const { value, done } = await reader.read()
        if (!current()) return
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let newline: number
        while ((newline = buffer.indexOf("\n")) >= 0) {
          const part = JSON.parse(buffer.slice(0, newline)) as AiStreamPart
          buffer = buffer.slice(newline + 1)
          if (part.type === "text") setPreview(text => text + part.text)
          if (part.type === "proposal") { terminal = true; setProposal(part.proposal) }
          if (part.type === "error") { terminal = true; setError(part.message) }
        }
      }
      if (!terminal) throw new Error("Connection interrupted. Check status before trying again.")
    } catch (cause) { if (current()) setError(cause instanceof Error && cause.name !== "AbortError" ? cause.message : "Request stopped. Check status to confirm its charge.") }
    finally { if (current()) { setPending(false); controller.current = null; try { const next = await quoteSelectionAssistance(); if (current()) {
          if (next.scope.userId !== target.userId || next.scope.organizationId !== target.organizationId) { setQuote(null); setError("Your organization changed. Discard this request and select the text again.") }
          else setQuote(next)
        } } catch { if (current()) setQuote(null) } } }
  }
  async function apply() {
    if (!proposal || !selection || applied || pending || !run.current || applying.current) return
    applying.current = true
    const version = epoch.current
    try {
      // Reauthorize before exposing a proposal through the actual editor/save owner.
      const verified = await readDocumentAssistance(proposal.id, run.current.target)
      if (version !== epoch.current) return
      if (verified.status !== "succeeded" || verified.target.revision !== selection.id ||
          verified.selection?.from !== selection.from || verified.selection?.to !== selection.to ||
          !replaceTextSelection(editor, selection, verified.content)) throw new Error("The document changed. Your suggestion is retained; select the text again before applying.")
      setApplied(true); setError("")
    } catch (cause) { if (version === epoch.current) setError(cause instanceof Error ? cause.message : "Unable to apply this suggestion.") }
    finally { applying.current = false }
  }
  return { selection, quote, proposal, prompt, setPrompt, error, pending, applied, preview, stale,
    begin, discard, submit, apply, stop, recover, unresolved: Boolean(run.current && (!proposal || ["running", "reserved", "reconciling"].includes(proposal.status))) }
}
