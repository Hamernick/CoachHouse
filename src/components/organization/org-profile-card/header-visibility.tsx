"use client"

import { useEffect, useId, useRef, useState } from "react"
import Link from "next/link"
import InfoIcon from "lucide-react/dist/esm/icons/info"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"

export function OrgProfileHeaderVisibility({
  isPublic,
  disabled,
  onCheckedChange,
}: {
  isPublic: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  const switchId = useId()
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearCloseTimer = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = null
  }
  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }, [])

  const handlePointerLeave = () => {
    clearCloseTimer()
    if (!pinned) closeTimer.current = setTimeout(() => setOpen(false), 150)
  }

  return (
    <div className="-mb-2 flex w-full items-center gap-1 text-left">
      <Label htmlFor={switchId} className="text-muted-foreground text-xs">Public</Label>
      <Popover open={open} onOpenChange={(nextOpen) => {
        clearCloseTimer()
        setOpen(nextOpen)
        if (!nextOpen) setPinned(false)
      }}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground size-7 rounded-full [@media(pointer:coarse)]:size-11"
            aria-label="About public visibility"
            onPointerEnter={(event) => {
              clearCloseTimer()
              if (event.pointerType === "mouse") setOpen(true)
            }}
            onPointerLeave={handlePointerLeave}
            onClick={(event) => {
              event.preventDefault()
              clearCloseTimer()
              setPinned(!pinned)
              setOpen(!pinned)
            }}
          >
            <InfoIcon className="size-4" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          aria-label="Public visibility"
          side="bottom"
          sideOffset={4}
          className="w-64 rounded-xl p-3 text-left text-xs shadow-none"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onPointerEnter={clearCloseTimer}
          onPointerLeave={handlePointerLeave}
        >
          When enabled, your organization is discoverable on{" "}
          <Link href="/" target="_blank" rel="noreferrer" className="underline underline-offset-2">
            our map
          </Link>.
        </PopoverContent>
      </Popover>
      <Switch
        id={switchId}
        checked={isPublic}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        aria-label="Make organization visible on map"
        className="ml-auto"
      />
    </div>
  )
}
