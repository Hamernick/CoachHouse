"use client"

import { useState } from "react"
import InfoIcon from "lucide-react/dist/esm/icons/info"
import XIcon from "lucide-react/dist/esm/icons/x"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

export function NonprofitSourceBanner() {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  return (
    <Alert
      role="note"
      className="bg-muted/30 relative pr-12"
      data-nonprofit-source-banner
    >
      <InfoIcon aria-hidden />
      <AlertTitle>Listed from IRS records</AlertTitle>
      <AlertDescription>
        Current operating status, services and visiting locations are
        unconfirmed. City and state are filing locations; categories describe
        organization topics. Contact details may reflect an older filing.
      </AlertDescription>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-1 right-1 size-9 rounded-full"
        aria-label="Dismiss IRS source notice"
        onClick={() => setDismissed(true)}
      >
        <XIcon aria-hidden />
      </Button>
    </Alert>
  )
}
