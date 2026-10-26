"use client"

import { useEffect, useRef, useState } from "react"
import type { CompanionSnapshot, CompanionToolArguments, CompanionToolName, CompanionTransport } from "../types"

type Operation = { name: CompanionToolName; args: CompanionToolArguments }

export function useCompanionSession(initialSnapshot: CompanionSnapshot, transport: CompanionTransport) {
  const [snapshot, setSnapshot] = useState(initialSnapshot)
  const [answers, setAnswers] = useState(initialSnapshot.draft.answers)
  const [content, setContent] = useState(initialSnapshot.document.content)
  const [pending, setPending] = useState<CompanionToolName | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState("")
  const lastOperation = useRef<Operation | null>(null)
  const inFlight = useRef(false)
  const answersDirty = snapshot.lesson.fields.some((field) => (answers[field.name] ?? "") !== (snapshot.draft.answers[field.name] ?? ""))
  const documentDirty = content !== snapshot.document.content
  const dirty = answersDirty || documentDirty

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
      // Authoritative snapshots update saved state; local edits survive unrelated operations and refreshes.
      setSnapshot(result.snapshot)
      if (operation.name === "companion_save_draft") {
        setAnswers((current) => snapshot.lesson.fields.every((field) => (current[field.name] ?? "") === (operation.args.answers?.[field.name] ?? "")) ? result.snapshot.draft.answers : current)
      } else if (!answersDirty) setAnswers(result.snapshot.draft.answers)
      if (operation.name === "companion_save_document") {
        setContent((current) => current === operation.args.content ? result.snapshot.document.content : current)
      } else if (!documentDirty) setContent(result.snapshot.document.content)
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
