"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import type { FiscalSponsorshipProgramOption } from "../types"

export function FiscalSponsorshipStartDialog({
  open, onOpenChange, programs, pending, error, onStart,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  programs: FiscalSponsorshipProgramOption[]
  pending: boolean
  error: string | null
  onStart: (input: { name: string; description: string; program: FiscalSponsorshipProgramOption | null }) => void
}) {
  const id = React.useId()
  const [mode, setMode] = React.useState("new")
  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [programId, setProgramId] = React.useState("")
  const program = programs.find((item) => item.id === programId) ?? null
  const resolvedName = mode === "new" ? name.trim() : program?.title?.trim() ?? ""

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!pending) onOpenChange(next) }}>
      <DialogContent className="max-h-[calc(100svh-2rem)] gap-5 overflow-y-auto rounded-3xl border-border/70 bg-card p-5 shadow-none sm:max-w-md" showCloseButton={!pending}>
        <DialogHeader className="pr-6 text-left">
          <DialogTitle>Start an application</DialogTitle>
          <DialogDescription>What activity would you like sponsored?</DialogDescription>
        </DialogHeader>
        <form
          id={id}
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (pending || !resolvedName) return
            onStart({
              name: resolvedName,
              description: mode === "new" ? description.trim() : program?.description || program?.subtitle || "",
              program: mode === "existing" ? program : null,
            })
          }}
        >
          <Tabs value={mode} onValueChange={setMode} className="gap-4">
            <TabsList className="grid w-full grid-cols-2 rounded-full">
              <TabsTrigger value="new" disabled={pending} className="rounded-full">New activity</TabsTrigger>
              <TabsTrigger value="existing" disabled={pending || programs.length === 0} className="rounded-full">Use existing</TabsTrigger>
            </TabsList>
            <TabsContent value="new" className="m-0 space-y-4">
              <div className="space-y-2">
                <Label htmlFor={`${id}-name`}>Activity name</Label>
                <Input id={`${id}-name`} value={name} onChange={(event) => setName(event.target.value)}
                  maxLength={160} required={mode === "new"} disabled={pending} className="rounded-xl"
                  placeholder="e.g. Community garden" />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${id}-description`}>Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Textarea id={`${id}-description`} value={description} onChange={(event) => setDescription(event.target.value)}
                  maxLength={4000} disabled={pending} rows={3} className="min-h-20 resize-none rounded-xl" />
              </div>
            </TabsContent>
            <TabsContent value="existing" className="m-0 space-y-2">
              <Label htmlFor={`${id}-activity`}>Activity</Label>
              <Select value={programId} onValueChange={setProgramId} disabled={pending}>
                <SelectTrigger id={`${id}-activity`} className="w-full rounded-xl">
                  <SelectValue placeholder="Choose an activity" />
                </SelectTrigger>
                <SelectContent>
                  {programs.map((item) => <SelectItem key={item.id} value={item.id}>{item.title || "Untitled activity"}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">Its details will prefill your application.</p>
            </TabsContent>
          </Tabs>
          {error ? <p role="alert" className="text-destructive text-sm">{error}</p> : null}
        </form>
        <DialogFooter className="flex-row items-center justify-between sm:justify-between">
          <Button type="button" variant="ghost" className="rounded-full" disabled={pending} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form={id} variant="secondary" className="rounded-full" disabled={pending || !resolvedName}>
            {pending ? "Creating…" : "Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
