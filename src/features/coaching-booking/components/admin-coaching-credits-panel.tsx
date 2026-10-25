"use client"
import { CoachingCreditHistory } from "./coaching-credit-history"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type {
  CoachingCreditPanelData,
  IssueCreditsAction,
  LoadCreditPanelAction,
  ManageStaffCoachingAction,
} from "../credit-types"
import { CoachingCreditIssueForm } from "./coaching-credit-issue-form"

function dateLabel(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

export function AdminCoachingCreditsPanel({
  initialData,
  loadAction,
  issueAction,
  manageAction,
}: {
  initialData: CoachingCreditPanelData
  loadAction: LoadCreditPanelAction
  issueAction: IssueCreditsAction
  manageAction: ManageStaffCoachingAction
}) {
  const [data, setData] = useState(initialData)
  const [issuing, setIssuing] = useState(false)
  const [issueOpen, setIssueOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<{
    id: string
    action: "cancel" | "completed" | "no_show"
  } | null>(null)
  function load(userId?: string, older = false) {
    startTransition(async () => {
      setError(null)
      const last = data.history.at(-1)
      try {
        const result = await loadAction({
          orgId: data.orgId,
          userId,
          before: older && last ? `${last.created_at}|${last.id}` : undefined,
        })
        if (!result.ok) {
          setError(result.error)
          return
        }
        setData(
          older
            ? {
                ...result.data,
                history: [...data.history, ...result.data.history],
              }
            : result.data
        )
        if (!older) setIssueOpen(false)
      } catch {
        setError("Unable to load coaching credits.")
      }
    })
  }
  return (
    <section
      className="border-border bg-card/80 min-w-0 space-y-3 rounded-lg border p-4"

    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Coaching credits</h2>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending || issuing}
          onClick={() => load(data.selectedUserId ?? undefined)}
        >
          Refresh
        </Button>
      </div>
      {data.error ? (
        <p role="alert" className="text-muted-foreground text-xs">
          {data.error}
        </p>
      ) : (
        <>
          <Label htmlFor={`credit-person-${data.orgId}`}>Person</Label>
          <Select
            value={data.selectedUserId ?? ""}
            disabled={pending || issueOpen}
            onValueChange={(id) => load(id)}
          >
            <SelectTrigger
              id={`credit-person-${data.orgId}`}
              className="w-full"
            >
              <SelectValue placeholder="Choose a person" />
            </SelectTrigger>
            <SelectContent>
              {data.people.map((person) => (
                <SelectItem key={person.id} value={person.id}>
                  {person.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground truncate text-xs">
            {
              data.people.find((person) => person.id === data.selectedUserId)
                ?.email
            }
          </p>
          <div className="flex items-baseline gap-2" aria-live="polite">
            <span className="text-2xl font-semibold tabular-nums">
              {data.account?.available ?? 0}
            </span>
            <span className="text-muted-foreground text-xs">
              available · 1 credit per 45-minute session
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={pending || issuing || !data.selectedUserId}
              onClick={() => setIssueOpen(!issueOpen)}
              aria-expanded={issueOpen}
            >
              {issueOpen ? "Close form" : "Issue credits"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setHistoryOpen(!historyOpen)}
              aria-expanded={historyOpen}
            >
              History
            </Button>
          </div>
          {issueOpen && data.selectedUserId ? (
            <CoachingCreditIssueForm
              key={data.selectedUserId}
              orgId={data.orgId}
              userId={data.selectedUserId}
              issueAction={issueAction}
              onPendingChange={setIssuing}
              onIssued={(next) => {
                setData(next)
                setIssueOpen(false)
              }}
            />
          ) : null}
          {historyOpen ? (
            <CoachingCreditHistory
              data={data}
              pending={pending}
              onLoadMore={() => load(data.selectedUserId ?? undefined, true)}
            />
          ) : null}
          {data.bookings.length ? (
            <details className="border-t pt-3 text-xs">
              <summary className="cursor-pointer font-medium">
                Coaching meetings ({data.bookings.length})
              </summary>
              <div className="space-y-3 pt-3">
                {data.bookings.map((booking) => (
                  <div key={booking.id} className="space-y-2">
                    <p>{dateLabel(booking.starts_at)}</p>
                    <div className="flex flex-wrap gap-1">
                      {Date.parse(booking.starts_at) <= Date.now() ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pending || issuing}
                            onClick={() =>
                              setConfirmation({
                                id: booking.id,
                                action: "completed",
                              })
                            }
                          >
                            Completed
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pending || issuing}
                            onClick={() =>
                              setConfirmation({
                                id: booking.id,
                                action: "no_show",
                              })
                            }
                          >
                            No-show
                          </Button>
                        </>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending || issuing}
                        onClick={() =>
                          setConfirmation({ id: booking.id, action: "cancel" })
                        }
                      >
                        Coach cancel
                      </Button>
                    </div>
                    {booking.calendar_pending_action ? (
                      <p className="text-muted-foreground">
                        Calendar update pending.
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </>
      )}
      {error ? (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
      <AlertDialog
        open={!!confirmation}
        onOpenChange={(open) => {
          if (!open && !pending) setConfirmation(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmation?.action === "cancel"
                ? "Cancel this coaching meeting?"
                : "Record this meeting outcome?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation?.action === "cancel"
                ? "The participant’s reserved credit will be restored. The coach calendar will be updated."
                : "The credit stays used. This outcome will be recorded in the participant’s history."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error ? (
            <p role="alert" className="text-destructive text-xs">
              {error}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending || issuing}>
              Keep meeting
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={pending || issuing}
              onClick={(event) => {
                event.preventDefault()
                if (!confirmation) return
                startTransition(async () => {
                  setError(null)
                  try {
                    const result = await manageAction({
                      orgId: data.orgId,
                      bookingId: confirmation.id,
                      action: confirmation.action,
                      reason:
                        confirmation.action === "cancel"
                          ? "Canceled by coach."
                          : "Outcome recorded by staff.",
                    })
                    if (!result.ok) {
                      setError(result.error)
                      return
                    }
                    setData(result.data)
                    setConfirmation(null)
                    toast.success("Coaching meeting updated.")
                  } catch {
                    setError("Unable to update meeting.")
                  }
                })
              }}
            >
              {pending ? "Saving…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
