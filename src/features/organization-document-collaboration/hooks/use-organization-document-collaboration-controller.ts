"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { BudgetTableRow } from "@/lib/modules"
import { normalizeRoadmapBudgetRows, roadmapBudgetRowsEqual } from "@/lib/roadmap/budget"
import type { Editor } from "@tiptap/core"
import { collab, getVersion, receiveTransaction, sendableSteps } from "@tiptap/pm/collab"
import { documentAcknowledgesState } from "../lib/acknowledgement"
import { documentCursorsPlugin, documentCursorsKey } from "../lib/cursors"
import { syncDocumentOverHttp, documentPresenceOverHttp } from "../lib/transport"
import { documentFailurePolicy, documentFailureStatus, type DocumentPersistenceStatus } from "../lib/editor-state"
import { readDocumentDraft, storeDocumentDraft, removeDocumentDraft, type StoredDocumentDraft } from "../lib/draft-storage"
import { Step } from "@tiptap/pm/transform"
import { backgroundRetryDelay, startBackgroundPolling } from "@/lib/background-polling"
import { documentPollingInterval, documentPresenceInterval } from "../lib/polling"
import { loadOrganizationDocumentVersions } from "../server/actions"
import type { DocumentScope, DocumentSyncResult, DocumentParticipant, DocumentTransport } from "../types"

export const defaultDocumentTransport: DocumentTransport = { sync: syncDocumentOverHttp, presence: documentPresenceOverHttp, leave: async (scope, clientId) => { await documentPresenceOverHttp({ ...scope, clientId, version: 0, leave: true }) }, versions: loadOrganizationDocumentVersions }

type Loaded = Exclude<DocumentSyncResult, { error: string }>
export function useOrganizationDocumentCollaborationController(scope: DocumentScope, userId: string, transport = defaultDocumentTransport, canEdit = true) {
  const [clientId] = useState(() => `${userId}:${crypto.randomUUID()}`)
  const lifetime = useRef<AbortController | null>(null)
  const openSequence = useRef(0)
  const opening = useRef<AbortController | null>(null)
  const [accessDenied, setAccessDenied] = useState(false)
  const [accessRevoked, setAccessRevoked] = useState(false)
  const [draftWarning, setDraftWarning] = useState<string | null>(null)
  const [recovery, setRecovery] = useState<StoredDocumentDraft | null>(null)
  const [presenceUnavailable, setPresenceUnavailable] = useState(false)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [savedSection, setSavedSection] = useState<Loaded["section"] | null>(null)
  const initializing = useRef(false)
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState<DocumentPersistenceStatus>("Connecting…")
  const [error, setError] = useState<string | null>(null)
  const [participants, setParticipants] = useState<DocumentParticipant[]>([])
  const participantsRef = useRef(participants)
  participantsRef.current = participants
  const editorRef = useRef<Editor | null>(null)
  const generation = useRef<string | null>(null)
  const busy = useRef(false)
  const syncTask = useRef<Promise<boolean | undefined> | null>(null)
  const failures = useRef(0)
  const retryAt = useRef(0)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const mounted = useRef(true)
  const lastSaved = useRef<Loaded | null>(null)
  const blocked = useRef(false)
  const scopeRef = useRef(scope)
  scopeRef.current = scope
  const dirty = useRef(false)
  const budgetDraft = useRef<{ base: BudgetTableRow[]; next: BudgetTableRow[] } | null>(null)
  const [budgetConflict, setBudgetConflict] = useState<BudgetTableRow[] | null>(null)
  const [budgetRows, setBudgetRows] = useState<BudgetTableRow[]>([])

  const acceptSection = useCallback((result: Loaded) => {
    lastSaved.current = result
    setSavedSection(previous => previous?.lastUpdated === result.section.lastUpdated
      && previous?.content === result.section.content
      && roadmapBudgetRowsEqual(previous?.budgetRows ?? [], result.section.budgetRows ?? []) ? previous : result.section)
  }, [])

  const persistDraft = useCallback(() => {
    const editor = editorRef.current
    if (!editor || editor.isDestroyed) return
    const draft: StoredDocumentDraft = { schema: 1, actorId: userId, ...scopeRef.current, clientId,
      generation: generation.current, version: generation.current ? getVersion(editor.state) : 0,
      savedAt: Date.now(), content: editor.getHTML(), budgetRows: budgetDraft.current?.next ?? lastSaved.current?.section.budgetRows ?? [] }
    let stored = false
    try { stored = storeDocumentDraft(window.localStorage, draft) } catch { /* Storage may be disabled. */ }
    let uploading = false
    editor.state.doc.descendants(node => { if (node.type.name === "image" && (node.attrs.uploading || String(node.attrs.src).startsWith("blob:"))) uploading = true })
    setDraftWarning(!stored ? "This browser cannot keep a recovery copy. Keep this editor open or download your changes."
      : uploading ? "Keep this editor open until the image upload finishes. Unfinished uploads cannot be recovered after closing." : null)
  }, [clientId, userId])

  const discardRecovery = useCallback(() => {
    if (recovery) { try { removeDocumentDraft(window.localStorage, recovery) } catch { /* Explicit discard only. */ } }
    setRecovery(null)
  }, [recovery])

  const open = useCallback(async () => {
    const sequence = ++openSequence.current
    opening.current?.abort()
    opening.current = new AbortController()
    const signal = lifetime.current ? AbortSignal.any([lifetime.current.signal, opening.current.signal]) : opening.current.signal
    setError(null)
    setStatus("Connecting…")
    try {
      const result = await transport.sync({ ...scopeRef.current, clientId, version: 0 }, signal)
      if (!mounted.current || signal?.aborted || sequence !== openSequence.current) return
      if ("error" in result) { setError(result.error); setStatus("Not connected"); return }
      if (result.userId !== userId) { setAccessDenied(true); setAccessRevoked(true); setError("Your account changed. Reopen this document."); return }
      setAccessDenied(result.capabilities?.canEdit === false)
      setAccessRevoked(false)
      setBudgetRows(result.section.budgetRows ?? [])
      setLoaded(result)
      acceptSection(result)
    } catch {
      if (mounted.current && !signal?.aborted && sequence === openSequence.current) { setError("Unable to open the live document. Try again."); setStatus("Not connected") }
    }
  }, [acceptSection, clientId, transport, userId])

  useEffect(() => {
    mounted.current = true
    const controller = new AbortController()
    lifetime.current = controller
    try { setRecovery(readDocumentDraft(window.localStorage, userId, scopeRef.current, clientId)) } catch { /* Recovery is optional. */ }
    const openedScope = scopeRef.current
    void open()
    return () => {
      mounted.current = false
      controller.abort()
      void transport.leave(openedScope, clientId).catch(() => {})
    }
  }, [clientId, open, transport, userId])

  const onReady = useCallback(async (editor: Editor) => {
    if (!loaded || initializing.current || (editorRef.current === editor && generation.current)) return
    initializing.current = true
    const signal = lifetime.current?.signal
    const sequence = openSequence.current
    editorRef.current = editor
    try {
      let result = loaded
      if (!result.session && canEdit && result.capabilities?.canEdit !== false) {
        const initialized = await transport.sync({ ...scopeRef.current, clientId, version: 0,
          initialDocument: editor.getJSON(), expectedRevision: loaded.section.lastUpdated }, signal)
        if (!mounted.current || signal?.aborted || sequence !== openSequence.current || editor.isDestroyed) return
        if ("error" in initialized) { setError(initialized.error); setStatus("Not connected"); return }
        result = initialized
      }
      if (!mounted.current || signal?.aborted || sequence !== openSequence.current || editor.isDestroyed) return
      if (result.session) {
        editor.chain().setContent(result.session.document).setMeta("addToHistory", false).run()
        editor.registerPlugin(collab({ version: result.session.version, clientID: clientId }))
        editor.registerPlugin(documentCursorsPlugin())
        generation.current = result.session.generation
      } else if (!canEdit || result.capabilities?.canEdit === false) {
        editor.chain().setContent(result.section.content).setMeta("addToHistory", false).run()
      } else if (canEdit) { setError("Unable to start editing safely."); setStatus("Not connected"); return }
      acceptSection(result)
      setParticipants(result.participants)
      setError(null)
      setReady(true)
      setStatus("Saved")
    } catch {
      if (mounted.current && !signal?.aborted && sequence === openSequence.current) { setError("Unable to connect the editor. Try again."); setStatus("Not connected") }
    } finally { initializing.current = false }
  }, [acceptSection, loaded, clientId, transport, canEdit])

  const syncOnce = useCallback(async (force = false) => {
    const editor = editorRef.current
    if (!editor || editor.isDestroyed || busy.current || blocked.current) return
    if (!force && Date.now() < retryAt.current) return
    if (!generation.current) {
      if (!canEdit) await open()
      return
    }
    let uploading = false
    editor.state.doc.descendants(node => {
      if (node.type.name === "image" && (node.attrs.uploading || String(node.attrs.src).startsWith("blob:"))) uploading = true
    })
    if (uploading) { dirty.current = true; setStatus("Waiting for image upload…"); return }
    const signal = lifetime.current?.signal
    const sequence = openSequence.current
    busy.current = true
    const pending = sendableSteps(editor.state)
    if (pending || budgetDraft.current) { dirty.current = true; setStatus("Saving…") }
    const sentBudget = budgetDraft.current
    let { anchor, head } = editor.state.selection
    // Report cursor coordinates in the acknowledged document, before local steps.
    for (const step of [...(pending?.steps ?? [])].reverse()) {
      const inverse = step.getMap().invert()
      anchor = inverse.map(anchor); head = inverse.map(head)
    }
    try {
      const result = await transport.sync({ ...scopeRef.current, clientId,
        generation: generation.current, version: getVersion(editor.state),
        budget: sentBudget ?? undefined,
        steps: pending?.steps.slice(0, 200).map(step => step.toJSON()),
        selection: { anchor, head, version: getVersion(editor.state) },
      }, signal)
      if (!mounted.current || signal?.aborted || sequence !== openSequence.current || editor.isDestroyed) return
      if ("error" in result) {
        retryAt.current = Date.now() + backgroundRetryDelay(5000, ++failures.current)
        const policy = documentFailurePolicy(result.code)
        if (policy.reopenIfClean && !sendableSteps(editor.state) && !budgetDraft.current) {
          setReady(false); setLoaded(null); editorRef.current = null; generation.current = null
          await open()
          return
        }
        setError(result.error)
        setStatus(documentFailureStatus(result.code, Boolean(sendableSteps(editor.state) || budgetDraft.current)))
        if (policy.blocked) blocked.current = true
        if (policy.accessDenied) { setAccessDenied(true); setAccessRevoked(true) }
        if (result.code === "budget_conflict") setBudgetConflict(result.savedBudgetRows ?? [])
        return false
      }
      if (result.userId !== userId) { setAccessDenied(true); setAccessRevoked(true); blocked.current = true; setError("Your account changed. Your local copy is retained."); return }
      setAccessDenied(result.capabilities?.canEdit === false)
      setAccessRevoked(false)
      const session = result.session
      if (!session || session.generation !== generation.current) {
        blocked.current = true
        setStatus("Not saved")
        persistDraft()
        setError("Document changed. Your unsaved edits are retained here.")
        return
      }
      const version = getVersion(editor.state)
      const offset = version - (session.version - session.steps.length)
      const incoming = session.steps.slice(offset)
      if (incoming.length) {
        editor.view.dispatch(receiveTransaction(editor.state,
          incoming.map(item => Step.fromJSON(editor.schema, item.step)),
          incoming.map(item => item.clientId)))
      }
      const cursors = participantsRef.current.filter(person => person.session_id !== clientId).map(person => {
        if (!person.selection || person.selection.version > session.version || person.selection.version < session.version - session.steps.length) return { ...person, selection: null }
        let { anchor, head } = person.selection
        const maps = session.steps.slice(person.selection.version - (session.version - session.steps.length))
          .map(item => Step.fromJSON(editor.schema, item.step).getMap())
        maps.push(...(sendableSteps(editor.state)?.steps.map(step => step.getMap()) ?? []))
        for (const map of maps) { anchor = map.map(anchor); head = map.map(head) }
        return { ...person, selection: { anchor, head, version: getVersion(editor.state) } }
      })
      editor.view.dispatch(editor.state.tr.setMeta(documentCursorsKey, cursors))
      if (sentBudget && roadmapBudgetRowsEqual(result.section.budgetRows ?? [], sentBudget.next)) {
        if (budgetDraft.current === sentBudget) budgetDraft.current = null
        else if (budgetDraft.current) budgetDraft.current = { ...budgetDraft.current, base: result.section.budgetRows ?? [] }
      }
      if (!budgetDraft.current) setBudgetRows(result.section.budgetRows ?? [])
      dirty.current = Boolean(sendableSteps(editor.state) || budgetDraft.current)
      if (!dirty.current && !documentAcknowledgesState(editor.state, session, result.section.content)) {
        dirty.current = true
        blocked.current = true
        persistDraft()
        setStatus("Not saved")
        setError("The saved document does not match your edits. Your local copy is retained; download it before reopening.")
        return false
      }
      acceptSection(result)
      if (!dirty.current) {
        try { removeDocumentDraft(window.localStorage, { actorId: userId, ...scopeRef.current, clientId }) } catch { /* Keep acknowledged content if removal fails. */ }
        setDraftWarning(null)
      } else persistDraft()
      setError(null)
      failures.current = 0; retryAt.current = 0
      setStatus(dirty.current ? "Saving…" : "Saved")
      return true
    } catch {
      retryAt.current = Date.now() + backgroundRetryDelay(5000, ++failures.current)
      if (mounted.current && !signal?.aborted && sequence === openSequence.current) {
        setStatus(sendableSteps(editor.state) || budgetDraft.current ? "Offline · edits retained" : "Not connected")
        setError("Connection interrupted. Keep this editor open; syncing will retry automatically.")
      }
      return false
    } finally { busy.current = false }
  }, [acceptSection, canEdit, clientId, open, transport, persistDraft, userId])

  // Navigation and the debounce must await the same in-flight acknowledgement.
  const sync = useCallback((force = false) => {
    if (syncTask.current) return syncTask.current
    const task = syncOnce(force).finally(() => { syncTask.current = null })
    syncTask.current = task
    return task
  }, [syncOnce])

  const flush = useCallback(async () => {
    clearTimeout(saveTimer.current)
    if (!ready) return !dirty.current
    const editor = editorRef.current
    if (!editor || editor.isDestroyed) return false
    if (!generation.current) return !canEdit || accessDenied
    if (blocked.current) return !dirty.current && !sendableSteps(editor.state) && !budgetDraft.current
    // Drain queued batches and edits made while a prior request was in flight.
    for (let batch = 0; batch < 20; batch++) {
      if (!sendableSteps(editor.state) && !budgetDraft.current && !dirty.current) return true
      if (await sync(true) !== true || !mounted.current || editor.isDestroyed) return false
    }
    return false
  }, [accessDenied, canEdit, ready, sync])

  const scheduleSave = useCallback(() => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => void sync(), 400)
  }, [sync])

  useEffect(() => {
    const editor = editorRef.current
    if (!ready || !editor) return
    const changed = () => {
      if (!generation.current || !sendableSteps(editor.state)) return
      dirty.current = true
      persistDraft()
      setStatus("Saving…")
      scheduleSave()
    }
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty.current || sendableSteps(editor.state) || budgetDraft.current) { event.preventDefault(); event.returnValue = "" }
    }
    editor.on("transaction", changed)
    window.addEventListener("beforeunload", warn)
    // Sync owns backoff for both foreground saves and background retries.
    // Do not feed its failures into a second exponential backoff.
    const stopPolling = startBackgroundPolling({ run: async () => { await sync() }, immediate: false,
      intervalMs: () => documentPollingInterval(dirty.current, participantsRef.current.some(person => person.session_id !== clientId), retryAt.current),
      enabled: () => !blocked.current && (document.visibilityState === "visible" || dirty.current) })
    return () => {
      clearTimeout(saveTimer.current); stopPolling()
      editor.off("transaction", changed)
      window.removeEventListener("beforeunload", warn)
    }
  }, [clientId, ready, sync, persistDraft, scheduleSave])

  useEffect(() => {
    if (!ready || !transport.presence || accessRevoked) return
    const controller = new AbortController()
    const poll = async () => {
      if (controller.signal.aborted) return
      try {
        if (document.visibilityState === "visible") {
          const editor = editorRef.current
          const selection = canEdit && !accessDenied && editor && generation.current && !sendableSteps(editor.state)
            ? { anchor: editor.state.selection.anchor, head: editor.state.selection.head, version: getVersion(editor.state) } : null
          const result = await transport.presence!({ ...scopeRef.current, clientId, version: 0, selection }, controller.signal)
          if (controller.signal.aborted) return
          if ("error" in result) { setPresenceUnavailable(true); setParticipants([]); return false }
          setPresenceUnavailable(false); setParticipants(result.participants)
          return true
        }
      } catch { if (!controller.signal.aborted) { setPresenceUnavailable(true); setParticipants([]) }; return false }
    }
    const stopPolling = startBackgroundPolling({ run: poll,
      intervalMs: () => documentPresenceInterval(participantsRef.current.some(person => person.session_id !== clientId)) })
    return () => { controller.abort(); stopPolling() }
  }, [accessDenied, accessRevoked, canEdit, clientId, ready, transport])

  const retry = useCallback(async () => {
    if (blocked.current) return
    if (!ready) {
      // A failed bootstrap never has local editable work to overwrite.
      setLoaded(null)
      editorRef.current = null
      generation.current = null
      await open()
    } else await sync(true)
  }, [open, ready, sync])

  const changeBudgetRows = (rows: BudgetTableRow[]) => {
    rows = normalizeRoadmapBudgetRows(rows)
    budgetDraft.current = { base: budgetDraft.current?.base ?? lastSaved.current?.section.budgetRows ?? [], next: rows }
    setBudgetRows(rows); dirty.current = true; persistDraft(); setStatus("Saving…"); scheduleSave()
  }
  const resolveBudgetConflict = (keepMine: boolean) => {
    if (!budgetConflict) return
    if (keepMine && budgetDraft.current) budgetDraft.current = { base: budgetConflict, next: budgetDraft.current.next }
    else { budgetDraft.current = null; setBudgetRows(budgetConflict) }
    setBudgetConflict(null); blocked.current = false; setError(null)
    void sync(true)
  }
  return { recovery, discardRecovery, persistDraft, draftWarning, presenceUnavailable, accessDenied, budgetConflict, resolveBudgetConflict, loaded, ready, error, status, participants, onReady, sync, flush, retry, blocked: blocked.current, editorRef, dirty, savedSection, budgetRows, changeBudgetRows }
}
