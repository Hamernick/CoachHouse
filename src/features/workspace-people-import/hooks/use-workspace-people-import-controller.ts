"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { OrgPerson } from "@/actions/people"
import { useWorkspaceEditorStatus } from "@/components/workspace/workspace-editor-status"
import type { PersonCategory } from "@/lib/people/categories"
import {
  defaultImportMapping,
  mappedContacts,
  parsePeopleImport,
  parsePastedPeople,
  planPeopleImport,
  MAX_PEOPLE_IMPORT_BYTES,
} from "../lib"
import {
  listPeopleImports,
  undoWorkspacePeopleImport,
} from "../server/history-actions"
import type { PeopleImportSummary } from "@/lib/people/import-history"
import { importWorkspacePeople } from "../server/actions"
import type { ImportDecision, ImportMapping, ImportSource } from "../types"

export function useWorkspacePeopleImportController({
  people,
  organizationId,
  canEdit,
  onImported,
}: {
  people: OrgPerson[]
  organizationId: string
  canEdit: boolean
  onImported: (people: OrgPerson[]) => void
}) {
  const router = useRouter()
  const [pastedText, setPastedText] = useState("")
  const [entryOpen, setEntryOpen] = useState(false)
  const [imports, setImports] = useState<PeopleImportSummary[]>([])
  const [undoBatchId, setUndoBatchId] = useState<string>()
  const batchId = useRef<string>("")
  const [source, setSource] = useState<ImportSource | null>(null)
  const [mapping, setMapping] = useState<ImportMapping>(() =>
    defaultImportMapping([])
  )
  const [decisions, setDecisions] = useState<Record<number, ImportDecision>>({})
  const [category, setCategory] = useState<PersonCategory>("supporters")
  const [filename, setFilename] = useState("")
  const [pending, setPending] = useState(false)
  const [reading, setReading] = useState(false)
  const [error, setError] = useState("")
  const [receipt, setReceipt] = useState("")
  const locked = useRef(false),
    generation = useRef(0)
  const rows = useMemo(
    () =>
      source
        ? mappedContacts(source, mapping).map((contact, index) => ({
            row: index + 1,
            contact,
            decision: decisions[index + 1] ?? { kind: "auto" as const },
          }))
        : [],
    [source, mapping, decisions]
  )
  const preview = useMemo(
    () => planPeopleImport(people, rows, category),
    [people, rows, category]
  )
  useWorkspaceEditorStatus({
    label: "People import",
    pending,
    dirty: false,
    error: false,
  })
  useEffect(() => {
    if (!pending) return
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", guard)
    return () => window.removeEventListener("beforeunload", guard)
  }, [pending])
  useEffect(
    () => () => {
      generation.current++
    },
    []
  )
  async function refreshHistory() {
    const current = generation.current
    try {
      const result = await listPeopleImports(organizationId)
      if (current !== generation.current) return
      if ("error" in result) setError(result.error)
      else setImports(result.imports)
    } catch {
      if (current === generation.current)
        setError("Could not load recent imports.")
    }
  }
  function openImporter(text = "") {
    if (!canEdit || locked.current) return
    if (new TextEncoder().encode(text).length > MAX_PEOPLE_IMPORT_BYTES) {
      setError("Paste up to 1 MB at a time.")
      return
    }
    generation.current++
    setPastedText(text)
    setReading(false)
    setEntryOpen(true)
    setSource(null)
    setError("")
    setReceipt("")
    void refreshHistory()
  }
  function startReview(next: ImportSource, label: string) {
    batchId.current = crypto.randomUUID()
    setSource(next)
    setEntryOpen(false)
    setMapping(defaultImportMapping(next.headers))
    setDecisions({})
    setFilename(label)
    setUndoBatchId(undefined)
  }
  function readPaste(text: string, hasHeaders = true) {
    if (!canEdit || locked.current) return
    generation.current++
    setError("")
    setReceipt("")
    setReading(false)
    try {
      startReview(parsePastedPeople(text, hasHeaders), "Pasted rows")
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not read the pasted rows."
      )
    }
  }
  async function undo(id: string) {
    if (!canEdit || locked.current) return
    const current = generation.current
    locked.current = true
    setPending(true)
    setError("")
    try {
      const result = await undoWorkspacePeopleImport({
        organizationId,
        batchId: id,
      })
      if (current !== generation.current) return
      if ("error" in result) {
        setError(result.error)
        return
      }
      onImported(result.people)
      setReceipt(
        `${result.archived} contacts archived · ${result.restored} fields restored · ${result.protectedCount} later changes preserved`
      )
      setUndoBatchId(undefined)
      batchId.current = crypto.randomUUID()
      await refreshHistory()
      router.refresh()
    } catch {
      if (current === generation.current)
        setError("Could not confirm undo. Retry is safe.")
    } finally {
      locked.current = false
      setPending(false)
    }
  }
  async function readFile(file: File) {
    if (!canEdit || locked.current) return
    const current = ++generation.current
    setError("")
    setReceipt("")
    setReading(true)
    try {
      if (file.size > MAX_PEOPLE_IMPORT_BYTES)
        throw new Error("Choose a file smaller than 1 MB.")
      const next = parsePeopleImport(await file.text(), file.name)
      if (current !== generation.current) return
      startReview(next, file.name.slice(0, 160))
    } catch (failure) {
      if (current === generation.current)
        setError(
          failure instanceof Error
            ? failure.message
            : "Could not read this file."
        )
    } finally {
      if (current === generation.current) setReading(false)
    }
  }
  function close() {
    if (locked.current) return
    generation.current++
    setSource(null)
    setEntryOpen(false)
    setError("")
    setReceipt("")
    setReading(false)
  }
  async function commit() {
    if (
      !canEdit ||
      locked.current ||
      !source ||
      !(preview.added || preview.filled)
    )
      return
    const current = generation.current
    locked.current = true
    setPending(true)
    setError("")
    try {
      const invalid = new Set(
        preview.entries
          .filter((entry) => entry.outcome === "invalid")
          .map((entry) => entry.row)
      )
      const result = await importWorkspacePeople({
        organizationId,
        batchId: batchId.current,
        source: { kind: source.format, label: filename },
        category,
        rows: rows.filter((row) => !invalid.has(row.row)),
      })
      if (current !== generation.current) return
      if ("error" in result) {
        setError(result.error)
        return
      }
      onImported(result.people)
      setUndoBatchId(result.batchId)
      batchId.current = crypto.randomUUID()
      setReceipt(
        `${result.added} added · ${result.filled} enriched · ${result.skipped + invalid.size} skipped${result.review ? ` · ${result.review} need review` : ""}`
      )
      router.refresh()
    } catch {
      if (current !== generation.current) return
      setError(
        "Could not confirm the import. Your review is still here; retry is safe."
      )
    } finally {
      locked.current = false
      setPending(false)
    }
  }
  return {
    entryOpen,
    pastedText,
    openImporter,
    readPaste,
    imports,
    undo,
    undoBatchId,
    source,
    mapping,
    setMapping,
    decisions,
    setDecisions,
    category,
    setCategory,
    filename,
    pending,
    reading,
    error,
    setError,
    receipt,
    preview,
    readFile,
    close,
    commit,
  }
}
