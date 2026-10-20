"use client"

import { useActionState } from "react"
import Loader2Icon from "lucide-react/dist/esm/icons/loader-circle"

import { Button } from "@/components/ui/button"
import { joinOrganizationAction, switchInviteAccountAction } from "../actions"

export function JoinOrganizationForm({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState(joinOrganizationAction, null)

  return (
    <div className="space-y-4">
      <p className="break-words text-sm text-muted-foreground">Signed in as {email}</p>
      <form action={action} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        {state?.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
        <Button type="submit" className="min-h-11 w-full" disabled={pending} aria-busy={pending}>
          {pending ? <Loader2Icon className="size-4 animate-spin" aria-hidden="true" /> : null}
          Join organization
        </Button>
      </form>
      <form action={switchInviteAccountAction}>
        <input type="hidden" name="token" value={token} />
        <Button type="submit" variant="outline" className="min-h-11 w-full" disabled={pending}>
          Use a different account
        </Button>
      </form>
    </div>
  )
}
