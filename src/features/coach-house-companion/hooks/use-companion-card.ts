"use client"

import { useEffect, useRef, useState } from "react"
import type { CompanionProposal, CompanionSnapshot, CompanionToolArguments, CompanionTransport } from "../types"
import { reconcileCompanionSnapshot } from "./companion-reconciliation"

export function companionProposalKey(proposal: CompanionProposal) {
  return JSON.stringify([proposal.organizationId, proposal.documentId, proposal.expectedRevision, proposal.content])
}

type SaveAttempt = { key: string; args: CompanionToolArguments }

export function useCompanionCard(initialSnapshot: CompanionSnapshot, proposal: CompanionProposal | undefined, transport: CompanionTransport) {
  const [snapshot, setSnapshot] = useState(initialSnapshot)
  const [currentProposal, setCurrentProposal] = useState(proposal)
  const [dismissedKey, setDismissedKey] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState("")
  const attempt = useRef<SaveAttempt | null>(null)
  const inFlight = useRef(false)
  const key = currentProposal ? companionProposalKey(currentProposal) : null
  const alreadySaved = currentProposal && snapshot.document.revision > currentProposal.expectedRevision && snapshot.document.content === currentProposal.content
  const activeProposal = currentProposal && key !== dismissedKey && !alreadySaved ? currentProposal : null
  const matches = !activeProposal || (activeProposal.organizationId === snapshot.organization.id && activeProposal.documentId === snapshot.document.id)

  useEffect(() => { setSnapshot((current) => reconcileCompanionSnapshot(current, initialSnapshot)) }, [initialSnapshot])
  // Unrelated tool results omit proposal; they must not discard a review awaiting a decision.
  useEffect(() => { if (proposal) setCurrentProposal(proposal) }, [proposal])

  async function save(retry = false) {
    if (inFlight.current || !activeProposal || !matches || !key) return
    const operation = retry && attempt.current?.key === key ? attempt.current : {
      key,
      args: { organizationId: activeProposal.organizationId, content: activeProposal.content, expectedRevision: activeProposal.expectedRevision, requestId: crypto.randomUUID(), confirmed: true },
    }
    inFlight.current = true
    attempt.current = operation
    setPending(true)
    setError(null)
    try {
      const result = await transport("companion_save_document", operation.args)
      if (result.snapshot.organization.id !== operation.args.organizationId || result.snapshot.document.id !== activeProposal.documentId || result.snapshot.document.revision <= activeProposal.expectedRevision || result.snapshot.document.content !== operation.args.content) {
        throw new Error("The response did not confirm this document change. Retry to verify the same save.")
      }
      setSnapshot((current) => reconcileCompanionSnapshot(current, result.snapshot))
      setDismissedKey(operation.key)
      setNotice(result.message)
      attempt.current = null
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The change could not be saved. Your proposal is still available.")
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  return { snapshot, activeProposal, matches, pending, error, notice, save,
    canRetry: Boolean(error && attempt.current?.key === key),
    dismiss: () => { if (!pending && key) { setDismissedKey(key); setError(null) } },
  }
}
