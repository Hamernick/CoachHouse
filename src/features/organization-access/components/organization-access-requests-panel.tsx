"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"

import ArrowRightIcon from "lucide-react/dist/esm/icons/arrow-right"
import CheckIcon from "lucide-react/dist/esm/icons/check"
import XIcon from "lucide-react/dist/esm/icons/x"

import { formatDate } from "@/components/account-settings/sections/organization-access-manager-helpers"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { toast } from "@/lib/toast"
import { cn } from "@/lib/utils"
import type { OrganizationAccessRequest } from "../types"

type RespondToOrganizationAccessRequestResult =
  | { ok: true; orgId: string; status: "accepted" | "declined" }
  | { error: string }

type OrganizationAccessRequestAction = (
  requestId: string,
) => Promise<RespondToOrganizationAccessRequestResult>

function resolveStatusLabel(status: OrganizationAccessRequest["status"]) {
  if (status === "accepted") return "Accepted"
  if (status === "declined") return "Declined"
  if (status === "expired") return "Expired"
  if (status === "revoked") return "Revoked"
  return "Pending"
}

function resolveStatusTone(status: OrganizationAccessRequest["status"]) {
  if (status === "accepted") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
  if (status === "declined") return "border-amber-500/30 bg-amber-500/10 text-amber-700"
  if (status === "expired" || status === "revoked") {
    return "border-border/60 bg-muted/60 text-muted-foreground"
  }
  return "border-sky-500/30 bg-sky-500/10 text-sky-700"
}

function resolveRoleLabel(role: OrganizationAccessRequest["role"]) {
  if (role === "admin") return "Admin"
  if (role === "staff") return "Editor"
  if (role === "board") return "Viewer"
  if (role === "member") return "Member"
  return "Owner"
}

export function OrganizationAccessRequestsPanel({
  initialRequests,
  acceptRequestAction,
  declineRequestAction,
  highlightedRequestId = null,
  successHref = "/workspace?joined=1",
  emptyHref = "/workspace",
  emptyLabel = "Go to workspace",
}: {
  initialRequests: OrganizationAccessRequest[]
  acceptRequestAction: OrganizationAccessRequestAction
  declineRequestAction: OrganizationAccessRequestAction
  highlightedRequestId?: string | null
  successHref?: string
  emptyHref?: string
  emptyLabel?: string
}) {
  const [requests, setRequests] = useState(initialRequests)
  const [isPending, startTransition] = useTransition()

  const sortedRequests = useMemo(
    () =>
      [...requests].sort((left, right) =>
        left.id === highlightedRequestId ? -1 : right.id === highlightedRequestId ? 1 : 0,
      ),
    [highlightedRequestId, requests],
  )

  const handleRespond = (
    requestId: string,
    nextStatus: "accepted" | "declined",
  ) => {
    startTransition(async () => {
      const result =
        nextStatus === "accepted"
          ? await acceptRequestAction(requestId)
          : await declineRequestAction(requestId)

      if ("error" in result) {
        toast.error(result.error)
        return
      }

      setRequests((current) =>
        current.map((request) =>
          request.id === requestId
            ? {
                ...request,
                status: result.status,
                respondedAt: new Date().toISOString(),
              }
            : request,
        ),
      )

      toast.success(
        result.status === "accepted"
          ? "Organization access accepted"
          : "Organization access declined",
      )

      if (result.status === "accepted") {
        // The old workspace scopes client fetches, including router navigation.
        // Start a new document so the accepted organization cookie takes effect.
        window.location.assign(successHref)
      }
    })
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 md:px-6">
      <Card className="border-border/70 bg-background/70">
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-wide"
            >
              Account
            </Badge>
            <Badge
              variant="secondary"
              className="rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-wide"
            >
              Access requests
            </Badge>
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl">Review organization access</CardTitle>
            <CardDescription className="max-w-2xl text-sm leading-6">
              Existing Coach House users accept or decline organization access here. Requests stay tied to your account, so you do not need a second invite link.
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      {sortedRequests.length === 0 ? (
        <Card className="border-dashed border-border/70 bg-background/50">
          <CardContent className="flex flex-col items-start gap-4 p-6">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">No pending access requests</p>
              <p className="text-sm leading-6 text-muted-foreground">
                When another organization invites your existing account, the request will appear here and inside notifications.
              </p>
            </div>
            <Button asChild>
              <Link href={emptyHref}>
                {emptyLabel}
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {sortedRequests.map((request) => {
            const isRequestPending = request.status === "pending"
            return (
              <Card
                key={request.id}
                className={cn(
                  "border-border/70 bg-background/80",
                  highlightedRequestId === request.id &&
                    "border-sky-500/40 shadow-[0_0_0_1px_rgba(14,165,233,0.15)]",
                )}
              >
                <CardHeader className="gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={resolveStatusTone(request.status)}>
                      {resolveStatusLabel(request.status)}
                    </Badge>
                    <Badge variant="secondary" className="rounded-full">
                      {resolveRoleLabel(request.role)}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-lg">
                      {request.organizationName ?? "Coach House organization"}
                    </CardTitle>
                    <CardDescription className="text-sm leading-6">
                      {request.inviterName
                        ? `${request.inviterName} requested access for your account.`
                        : "A Coach House teammate requested access for your account."}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <div className="grid gap-2 text-sm text-muted-foreground">
                    <p>
                      Email:{" "}
                      <span className="font-medium text-foreground">
                        {request.inviteeEmail}
                      </span>
                    </p>
                    <p>Requested: {formatDate(request.createdAt)}</p>
                    <p>Expires: {formatDate(request.expiresAt)}</p>
                  </div>

                  {isRequestPending ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        disabled={isPending || !isRequestPending}
                        onClick={() => handleRespond(request.id, "accepted")}
                      >
                        <CheckIcon data-icon="inline-start" />
                        Accept access
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isPending || !isRequestPending}
                        onClick={() => handleRespond(request.id, "declined")}
                      >
                        <XIcon data-icon="inline-start" />
                        Decline
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      This request has already been {request.status}.
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
