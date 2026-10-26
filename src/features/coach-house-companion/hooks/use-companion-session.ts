"use client"

import { useEffect, useRef, useState, type SetStateAction } from "react"
import type { CompanionSnapshot, CompanionToolArguments, CompanionToolName, CompanionTransport } from "../types"
import { reconcileCompanionState, type CompanionLocalState, type CompanionOperation } from "./companion-reconciliation"

export function useCompanionSession(initialSnapshot: CompanionSnapshot, transport: CompanionTransport) {
  const [local, setLocal] = useState<CompanionLocalState>({ snapshot: initialSnapshot, answers: initialSnapshot.draft.answers, content: initialSnapshot.document.content })
  const { snapshot, answers, content } = local
  const setAnswers = (value: SetStateAction<Record<string, string>>) => setLocal((current) => ({ ...current, answers: typeof value === "function" ? value(current.answers) : value }))
  const setContent = (value: SetStateAction<string>) => setLocal((current) => ({ ...current, content: typeof value === "function" ? value(current.content) : value }))
  const [pending, setPending] = useState<CompanionToolName | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState("")
  const lastOperation = useRef<CompanionOperation | null>(null)
  const inFlight = useRef(false)
  const answersDirty = snapshot.lesson.fields.some((field) => (answers[field.name] ?? "") !== (snapshot.draft.answers[field.name] ?? ""))
  const documentDirty = content !== snapshot.document.content
  const dirty = answersDirty || documentDirty

  useEffect(() => {
    setLocal((current) => reconcileCompanionState(current, initialSnapshot))
  }, [initialSnapshot])

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  async function run(name: CompanionToolName, args: Partial<CompanionToolArguments> = {}, retry = false) {
    if (inFlight.current) return false
    inFlight.current = true
    setPending(name)
    setError(null)
    const operation = retry && lastOperation.current ? lastOperation.current : {
      name,
      args: { ...args, organizationId: snapshot.organization.id, ...(name === "companion_get_session" ? {} : { requestId: crypto.randomUUID() }) },
    }
    lastOperation.current = operation
    try {
      const result = await transport(operation.name, operation.args)
      setLocal((current) => reconcileCompanionState(current, result.snapshot, operation))
      setNotice(operation.name === "companion_get_session" && dirty ? "Latest saved state loaded. Your unsaved edits are preserved; review before saving." : result.message)
      lastOperation.current = null
      return true
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The action could not finish. Your edits are still here. Retry or load the latest saved state.")
      return false
    } finally {
      inFlight.current = false
      setPending(null)
    }
  }

  return {
    snapshot, answers, setAnswers, content, setContent, pending, error, notice, answersDirty, documentDirty, dirty,
    run,
    retry: () => lastOperation.current ? run(lastOperation.current.name, {}, true) : Promise.resolve(false),
    refresh: () => run("companion_get_session"),
    saveDraft: () => run("companion_save_draft", { expectedRevision: snapshot.draft.revision, answers }),
    saveDocument: () => run("companion_save_document", { expectedRevision: snapshot.document.revision, content, confirmed: true }),
    submit: () => run("companion_submit_assignment", { expectedRevision: snapshot.draft.revision, confirmed: true }),
  }
}

export type CompanionSession = ReturnType<typeof useCompanionSession>
