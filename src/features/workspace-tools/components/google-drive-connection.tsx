"use client"

import LoaderCircleIcon from "lucide-react/dist/esm/icons/loader-circle"
import TriangleAlertIcon from "lucide-react/dist/esm/icons/triangle-alert"
import type { ReactNode } from "react"
import { useCallback, useEffect, useId, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/lib/toast"

import type {
  GoogleDriveConnectionSummary,
  GoogleDriveErrorCode,
} from "@/features/google-drive"

const GOOGLE_DRIVE_TOOLS_RETURN_PATH = "/workspace?drawer=tools"

type ConnectionResponse = {
  ok?: boolean
  code?: GoogleDriveErrorCode
  connection?: GoogleDriveConnectionSummary
  authorizationUrl?: string
}

function googleDriveErrorMessage(code?: GoogleDriveErrorCode) {
  switch (code) {
    case "not_configured":
      return "Google Drive is not available yet."
    case "unauthorized":
      return "Sign in again to connect Google Drive."
    case "forbidden":
      return "You do not have permission to change this connection."
    case "authorization_denied":
      return "Google Drive connection was canceled."
    case "scope_denied":
      return "Allow selected-file access to connect Google Drive."
    case "google_revoked":
    case "missing_refresh_token":
      return "Google Drive access expired. Reconnect to continue."
    case "rate_limited":
      return "Google Drive is busy. Try again shortly."
    default:
      return "Google Drive could not be reached. Try again."
  }
}

function googleDriveErrorTitle(code?: GoogleDriveErrorCode) {
  switch (code) {
    case "not_configured":
      return "Google Drive Isn’t Available"
    case "unauthorized":
      return "Your Session Expired"
    case "forbidden":
      return "Connection Changes Are Restricted"
    case "rate_limited":
      return "Google Drive Is Busy"
    default:
      return "Google Drive Couldn’t Load"
  }
}

async function readConnectionResponse(response: Response) {
  return (await response.json().catch(() => null)) as ConnectionResponse | null
}

export function GoogleDriveConnection({
  brand,
  onConnectionChange,
}: {
  brand: ReactNode
  onConnectionChange?: (connected: boolean) => void
}) {
  const connectionControlId = useId()
  const connectionDescriptionId = `${connectionControlId}-description`
  const connectionControlRef = useRef<HTMLButtonElement>(null)
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [connection, setConnection] =
    useState<GoogleDriveConnectionSummary | null>(null)
  const [loadError, setLoadError] = useState<GoogleDriveErrorCode | null>(null)
  const [loading, setLoading] = useState(true)
  const [disconnectOpen, setDisconnectOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<
    "connect" | "disconnect" | null
  >(null)

  const loadConnection = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const response = await fetch(
        "/api/integrations/google-drive/connection",
        { cache: "no-store" }
      )
      const result = await readConnectionResponse(response)
      if (!response.ok || !result?.connection) {
        throw new Error(result?.code ?? "provider_unavailable")
      }
      setConnection(result.connection)
      onConnectionChange?.(result.connection.connected)
    } catch (error) {
      const code =
        error instanceof Error
          ? (error.message as GoogleDriveErrorCode)
          : "provider_unavailable"
      setLoadError(code)
      onConnectionChange?.(false)
    } finally {
      setLoading(false)
    }
  }, [onConnectionChange])

  useEffect(() => {
    void loadConnection()
  }, [loadConnection])

  useEffect(() => {
    const outcome = searchParams.get("googleDrive")
    if (!outcome) return

    if (outcome === "connected") {
      toast.success("Google Drive connected")
    } else {
      toast.error(googleDriveErrorMessage(outcome as GoogleDriveErrorCode))
    }

    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete("googleDrive")
    router.replace(
      nextParams.size > 0 ? `${pathname}?${nextParams}` : pathname,
      { scroll: false }
    )
  }, [pathname, router, searchParams])

  async function connect() {
    setPendingAction("connect")
    try {
      const response = await fetch("/api/integrations/google-drive/connect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ returnPath: GOOGLE_DRIVE_TOOLS_RETURN_PATH }),
      })
      const result = await readConnectionResponse(response)
      if (!response.ok || !result?.authorizationUrl) {
        throw new Error(result?.code ?? "provider_unavailable")
      }
      window.location.assign(result.authorizationUrl)
    } catch (error) {
      setPendingAction(null)
      toast.error(
        googleDriveErrorMessage(
          error instanceof Error
            ? (error.message as GoogleDriveErrorCode)
            : "provider_unavailable"
        )
      )
    }
  }

  async function disconnect() {
    setPendingAction("disconnect")
    try {
      const response = await fetch(
        "/api/integrations/google-drive/disconnect",
        { method: "POST" }
      )
      const result = await readConnectionResponse(response)
      if (!response.ok || !result?.ok) {
        throw new Error(result?.code ?? "provider_unavailable")
      }
      const nextConnection: GoogleDriveConnectionSummary = {
        connected: false,
        googleEmail: null,
        status: "not_connected",
      }
      setConnection(nextConnection)
      setDisconnectOpen(false)
      setPendingAction(null)
      onConnectionChange?.(false)
      toast.success("Google Drive disconnected")
    } catch (error) {
      toast.error(
        googleDriveErrorMessage(
          error instanceof Error
            ? (error.message as GoogleDriveErrorCode)
            : "provider_unavailable"
        )
      )
      setPendingAction(null)
    }
  }

  const connected = connection?.connected === true
  const reconnectRequired =
    connection?.status === "revoked" || connection?.status === "error"

  return (
    <div className="border-border/70 overflow-hidden rounded-xl border">
      <div className="flex min-w-0 flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          {brand}
          <div className="min-w-0 flex-1" aria-live="polite">
            <p className="text-sm font-medium">Google Drive</p>
            {loading ? (
              <Skeleton className="mt-1 h-4 w-48 max-w-full" />
            ) : loadError ? (
              <p className="text-muted-foreground text-xs leading-relaxed">
                Connection status unavailable.
              </p>
            ) : connected ? (
              <>
                <p className="text-muted-foreground truncate text-xs">
                  {connection.googleEmail ?? "Connected Google account"}
                </p>
                <p
                  id={connectionDescriptionId}
                  className="text-muted-foreground mt-0.5 text-xs leading-relaxed"
                >
                  Only files you choose can be connected.
                </p>
              </>
            ) : (
              <p
                id={connectionDescriptionId}
                className="text-muted-foreground text-xs leading-relaxed"
              >
                {reconnectRequired
                  ? "Access expired. Reconnect to selected files."
                  : "Connect now; choose files later in Documents."}
              </p>
            )}
          </div>
        </div>

        <div className="flex min-h-11 shrink-0 items-center gap-2 self-start sm:ml-auto sm:min-h-0 sm:self-center">
          {loading ? (
            <Badge variant="secondary" className="gap-1.5 font-normal">
              <LoaderCircleIcon
                aria-hidden="true"
                className="size-3.5 animate-spin motion-reduce:animate-none"
              />
              Checking…
            </Badge>
          ) : loadError ? (
            <Badge variant="outline" className="font-normal">
              Needs Attention
            </Badge>
          ) : (
            <>
              <Label
                htmlFor={connectionControlId}
                className="min-h-11 cursor-pointer gap-2 sm:min-h-8"
              >
                <span className="text-muted-foreground text-xs font-normal whitespace-nowrap">
                  {pendingAction === "connect"
                    ? "Connecting…"
                    : connected
                      ? "Connected"
                      : reconnectRequired
                        ? "Reconnect"
                        : "Not connected"}
                </span>
                <Switch
                  ref={connectionControlRef}
                  id={connectionControlId}
                  aria-label="Google Drive connection"
                  aria-describedby={connectionDescriptionId}
                  checked={connected}
                  disabled={pendingAction !== null}
                  onCheckedChange={(nextConnected) => {
                    if (nextConnected) {
                      void connect()
                    } else {
                      setDisconnectOpen(true)
                    }
                  }}
                />
              </Label>
              {connected ? (
                <AlertDialog
                  open={disconnectOpen}
                  onOpenChange={setDisconnectOpen}
                >
                  <AlertDialogContent
                    onCloseAutoFocus={(event) => {
                      event.preventDefault()
                      connectionControlRef.current?.focus()
                    }}
                  >
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Disconnect Google Drive?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Coach House will lose access. Connected file records
                        will require reconnection, but no files are deleted from
                        Drive.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={pendingAction !== null}>
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={pendingAction !== null}
                        onClick={(event) => {
                          event.preventDefault()
                          void disconnect()
                        }}
                      >
                        {pendingAction === "disconnect" ? (
                          <LoaderCircleIcon
                            aria-hidden="true"
                            className="size-4 animate-spin motion-reduce:animate-none"
                          />
                        ) : null}
                        {pendingAction === "disconnect"
                          ? "Disconnecting…"
                          : "Disconnect"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
            </>
          )}
        </div>
      </div>

      {loadError ? (
        <div className="px-4 pb-4">
          <Alert

            variant="destructive"
            className="border-destructive/25 bg-destructive/5 rounded-2xl shadow-xs"
          >
            <TriangleAlertIcon aria-hidden="true" />
            <AlertTitle>{googleDriveErrorTitle(loadError)}</AlertTitle>
            <AlertDescription className="gap-3">
              <p className="break-words">
                {googleDriveErrorMessage(loadError)}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-11 sm:h-8"
                onClick={() => void loadConnection()}
              >
                Try Again
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      ) : null}
    </div>
  )
}
