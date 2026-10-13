"use client"

import type { ComponentProps } from "react"
import GiftIcon from "lucide-react/dist/esm/icons/gift"
import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function UpgradeButton({ className, ...props }: ComponentProps<typeof Button>) {
  return (
    <Button type="button" variant="secondary" {...getReactGrabOwnerProps({ ownerId: "account:upgrade", component: "AccountUpgradeButton", source: "src/components/nav-user/upgrade-button.tsx", slot: "trigger" })} {...props} className={cn(className, "h-9 w-full justify-start gap-2 rounded-lg px-2 shadow-none group-data-[collapsible=icon]:justify-center")}>
      <GiftIcon className="size-4" aria-hidden />
      <span className="group-data-[collapsible=icon]:hidden">Upgrade</span>
    </Button>
  )
}
