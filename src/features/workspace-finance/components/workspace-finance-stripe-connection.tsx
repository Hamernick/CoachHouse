"use client"

import { useState, useTransition } from "react"
import { siStripe } from "@/lib/brand-icons"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

import type {
  WorkspaceFinanceRecordInput,
  WorkspaceFinanceStripeConnectionInput,
} from "../types"
import { formatWorkspaceFinanceSyncFreshness } from "../lib/sync-freshness"

const RECORD_TYPES = [
  { value: "donation", label: "Donations" },
  { value: "grant", label: "Grants" },
  { value: "earned_revenue", label: "Earned revenue" },
  { value: "other_income", label: "Other income" },
] as const

function accountLabel(accountId: string | null | undefined) {
  if (!accountId) return "Read-only source"
  return `Read-only source · Account ••••${accountId.slice(-4)}`
}

export function WorkspaceFinanceStripeConnection({
  connection,
  onSynced,
}: {
  connection: WorkspaceFinanceStripeConnectionInput
  onSynced: (input: {
    records: WorkspaceFinanceRecordInput[]
    syncedAt: string
  }) => void
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState(
    connection.lastSyncedAt ?? null
  )
  const [syncStatus, setSyncStatus] = useState(connection.lastSyncStatus)
  const [pending, startTransition] = useTransition()

  function sync() {
    setSyncStatus("running")
    startTransition(async () => {
      try {
        const response = await fetch(
          "/api/account/finance-connections/stripe/sync",
          { method: "POST" }
        )
        const result = (await response.json()) as {
          error?: string
          imported?: number
          records?: WorkspaceFinanceRecordInput[]
          syncedAt?: string
        }
        if (!response.ok || !result.records || !result.syncedAt) {
          throw new Error(result.error || "Stripe could not be synced.")
        }
        setLastSyncedAt(result.syncedAt)
        setSyncStatus("succeeded")
        onSynced({ records: result.records, syncedAt: result.syncedAt })
        toast.success(
          result.imported
            ? `${result.imported} Stripe record${result.imported === 1 ? "" : "s"} added`
            : "Stripe is up to date"
        )
      } catch (error) {
        setSyncStatus("failed")
        toast.error(
          error instanceof Error ? error.message : "Stripe could not be synced."
        )
      }
    })
  }

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="border-border/70 bg-muted/60 flex size-10 shrink-0 items-center justify-center rounded-lg border">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            focusable="false"
            className="size-5 shrink-0 text-[#635bff]"
          >
            <path fill="currentColor" d={siStripe.path} />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">Stripe</span>
          <span className="text-muted-foreground block truncate text-xs">
            {connection.state === "connected"
              ? accountLabel(connection.accountId)
              : "Read-only transaction sync"}
          </span>
          {connection.state === "connected" ? (
            <span
              aria-live="polite"
              className="text-muted-foreground mt-0.5 block truncate text-xs"
            >
              {formatWorkspaceFinanceSyncFreshness({
                lastSyncedAt,
                status: syncStatus,
              })}
            </span>
          ) : null}
        </span>

        {connection.state === "connected" ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-11 sm:h-8"
            disabled={pending}
            onClick={sync}
          >
            {pending ? "Syncing…" : "Sync"}
          </Button>
        ) : connection.state === "not_connected" ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-11 sm:h-8"
            onClick={() => setDialogOpen(true)}
          >
            Connect
          </Button>
        ) : (
          <Badge variant="secondary" className="font-normal">
            {connection.state === "not_configured"
              ? "Setup needed"
              : "Unavailable"}
          </Badge>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect Stripe</DialogTitle>
            <DialogDescription>
              Choose how incoming Stripe payments appear. Stripe remains the
              payment processor; Coach House only reads and displays records.
            </DialogDescription>
          </DialogHeader>
          <form
            action="/api/account/finance-connections/stripe/start"
            method="post"
            className="grid gap-5"
          >
            <fieldset className="grid gap-3">
              <legend className="text-sm font-medium">Incoming payments</legend>
              <RadioGroup
                name="defaultRecordType"
                defaultValue="donation"
                className="grid gap-2"
              >
                {RECORD_TYPES.map((type) => (
                  <Label
                    key={type.value}
                    htmlFor={`stripe-record-type-${type.value}`}
                    className="hover:bg-muted/50 flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 font-normal"
                  >
                    <RadioGroupItem
                      id={`stripe-record-type-${type.value}`}
                      value={type.value}
                    />
                    {type.label}
                  </Label>
                ))}
              </RadioGroup>
            </fieldset>
            <p className="text-muted-foreground text-xs leading-5">
              The first sync reads up to 90 days. Fees and refunds stay separate
              from incoming funding.
            </p>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Continue to Stripe</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
