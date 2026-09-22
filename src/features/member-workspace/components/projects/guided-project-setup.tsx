"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { pickGoogleDriveFileReferences } from "@/features/google-drive/client"
import {
  guidedProjectSchema,
  type GuidedProjectInput,
} from "../../lib/guided-project"
import { parseScheduleDay } from "../../lib/project-schedule"
import {
  createGuidedProjectAction,
  loadGuidedProjectPeople,
} from "../../project-workflow-actions"
import type {
  MemberWorkspacePersonOption,
  MemberWorkspaceProjectOrganizationOption,
} from "../../types"
import {
  GuidedProjectBasics,
  GuidedProjectPeopleTasks,
} from "./guided-project-fields"

const STEPS = ["Project", "People & tasks", "Files", "Review"]

export function GuidedProjectSetup({
  organizations,
  onClose,
  directoryHref,
}: {
  organizations: MemberWorkspaceProjectOrganizationOption[]
  onClose: () => void
  directoryHref: string
}) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [value, setValue] = useState<GuidedProjectInput>(() => ({
    requestId: crypto.randomUUID(),
    organizationId: organizations.length === 1 ? organizations[0].orgId : "",
    name: "",
    description: "",
    outcomes: "",
    startDate: "",
    endDate: "",
    ownerId: "",
    contributorIds: [],
    tasks: [],
    files: [],
  }))
  const [people, setPeople] = useState<MemberWorkspacePersonOption[]>([])
  const [loadingPeople, setLoadingPeople] = useState(false)
  const [peopleError, setPeopleError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [picking, setPicking] = useState(false)
  const [retry, setRetry] = useState(0)
  const change = (patch: Partial<GuidedProjectInput>) => {
    setValue((current) => ({ ...current, ...patch }))
    setError(null)
  }
  useEffect(() => {
    let active = true
    setPeople([])
    setPeopleError(null)
    if (!value.organizationId) return
    setLoadingPeople(true)
    loadGuidedProjectPeople(value.organizationId)
      .then((result) => {
        if (!active) return
        if ("error" in result)
          setPeopleError(result.error ?? "Unable to load people.")
        else setPeople(result.people)
      })
      .catch(() => {
        if (active) setPeopleError("Unable to load people. Please retry.")
      })
      .finally(() => {
        if (active) setLoadingPeople(false)
      })
    return () => {
      active = false
    }
  }, [value.organizationId, retry])

  function next() {
    if (
      step === 0 &&
      (!value.organizationId ||
        !value.name.trim() ||
        parseScheduleDay(value.startDate) === null ||
        parseScheduleDay(value.endDate) === null ||
        value.endDate < value.startDate)
    ) {
      setError(
        "Choose an organization, project name, and valid start and due dates."
      )
      return
    }
    if (step > 0) {
      const parsed = guidedProjectSchema.safeParse(value)
      if (!parsed.success) {
        setError(
          parsed.error.issues[0]?.message ?? "Check the project details."
        )
        return
      }
    }
    setError(null)
    setStep((current) => current + 1)
  }
  async function pickFiles() {
    setPicking(true)
    setError(null)
    try {
      const files = await pickGoogleDriveFileReferences(true)
      change({
        files: [
          ...new Map(
            [...value.files, ...files].map((file) => [file.id, file])
          ).values(),
        ],
      })
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Google Drive could not open."
      )
    } finally {
      setPicking(false)
    }
  }
  async function create() {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const result = await createGuidedProjectAction(value)
      if ("error" in result) {
        setError(result.error)
        return
      }
      onClose()
      router.refresh()
      if (directoryHref !== "/projects") router.push(`${directoryHref}/${result.id}`)
    } catch {
      setError("Could not confirm creation. Retry safely with the same setup.")
    } finally {
      setSaving(false)
    }
  }
  const nameFor = (id?: string) =>
    people.find((person) => person.id === id)?.name ?? "Unassigned"
  return (
    <Dialog
      open
      modal={!picking}
      onOpenChange={(open) => {
        if (!open && !saving && !picking) onClose()
      }}
    >
      <DialogContent
        className="flex max-h-[85vh] flex-col sm:max-w-2xl"
        onInteractOutside={(event) => {
          if (picking || saving) event.preventDefault()
        }}
        onEscapeKeyDown={(event) => {
          if (picking || saving) event.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
          <DialogDescription>
            {step + 1} of {STEPS.length} · {STEPS[step]}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto px-1">
          {step === 0 ? (
            <GuidedProjectBasics
              value={value}
              change={change}
              organizations={organizations}
            />
          ) : null}
          {step === 1 ? (
            loadingPeople ? (
              <p role="status">Loading people…</p>
            ) : peopleError ? (
              <div role="alert">
                <p>{peopleError}</p>
                <Button
                  variant="outline"
                  onClick={() => setRetry((current) => current + 1)}
                >
                  Retry
                </Button>
              </div>
            ) : (
              <GuidedProjectPeopleTasks
                value={value}
                change={change}
                people={people}
              />
            )
          ) : null}
          {step === 2 ? (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">
                Link files from your connected Google Drive. File contents and
                sharing permissions stay in Drive.
              </p>
              <Button
                variant="outline"
                onClick={pickFiles}
                disabled={picking || value.files.length >= 30}
              >
                {picking ? "Opening Drive…" : "Add from Google Drive"}
              </Button>
              <ul className="divide-border divide-y">
                {value.files.map((file) => (
                  <li
                    key={file.id}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <span className="truncate text-sm">{file.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        change({
                          files: value.files.filter(
                            (item) => item.id !== file.id
                          ),
                        })
                      }
                      aria-label={`Remove ${file.name}`}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
              {!value.files.length ? (
                <p className="text-muted-foreground text-sm">
                  No files selected. This step is optional.
                </p>
              ) : null}
            </div>
          ) : null}
          {step === 3 ? (
            <div className="space-y-4 text-sm">
              <div>
                <h3 className="font-semibold">{value.name}</h3>
                <p className="text-muted-foreground">
                  {
                    organizations.find(
                      (org) => org.orgId === value.organizationId
                    )?.name
                  }{" "}
                  · {value.startDate} – {value.endDate}
                </p>
              </div>
              {value.description ? (
                <p className="whitespace-pre-wrap">{value.description}</p>
              ) : null}
              {value.outcomes ? (
                <div>
                  <h4 className="font-medium">Expected outcomes</h4>
                  <p className="whitespace-pre-wrap">{value.outcomes}</p>
                </div>
              ) : null}
              <div>
                <p>Owner: {nameFor(value.ownerId)}</p>
                {value.contributorIds.length ? (
                  <p>
                    Contributors: {value.contributorIds.map(nameFor).join(", ")}
                  </p>
                ) : null}
              </div>
              <div>
                <h4 className="font-medium">Tasks ({value.tasks.length})</h4>
                {value.tasks.map((task, index) => (
                  <div key={index} className="border-border border-b py-2">
                    <p>
                      {task.title} · {task.workstream}
                    </p>
                    <p className="text-muted-foreground">
                      {nameFor(task.assigneeId)} · {task.startDate} –{" "}
                      {task.endDate}
                    </p>
                  </div>
                ))}
              </div>
              <div>
                <h4 className="font-medium">Files ({value.files.length})</h4>
                {value.files.map((file) => (
                  <p key={file.id}>{file.name}</p>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
        <div className="flex justify-between gap-3 border-t pt-3">
          <Button
            variant="ghost"
            disabled={saving || picking}
            onClick={() => (step ? setStep(step - 1) : onClose())}
          >
            {step ? "Back" : "Cancel"}
          </Button>
          {step === 3 ? (
            <Button disabled={saving} onClick={create}>
              {saving ? "Creating…" : "Create project"}
            </Button>
          ) : (
            <Button
              disabled={
                picking ||
                (step === 1 && (loadingPeople || Boolean(peopleError)))
              }
              onClick={next}
            >
              Continue
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
