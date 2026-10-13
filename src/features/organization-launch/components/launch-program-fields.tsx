"use client"

import { useState } from "react"
import { createProgramAction, updateProgramAction } from "@/actions/programs"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { organizationNarrativeHtmlToPlainText } from "@/lib/roadmap/organization-narratives"
import type { OrganizationLaunchInput } from "../types"
import { LaunchInlineForm } from "./launch-inline-form"

export function LaunchProgramFields({ programs = [] }: { programs: OrganizationLaunchInput["programs"] }) {
  const [selected, setSelected] = useState(programs[0]?.id ?? "new")
  const [dirty, setDirty] = useState(false)
  const [pending, setPending] = useState(false)
  const [created, setCreated] = useState(false)
  const program = programs.find((item) => item.id === selected)
  return <div className="space-y-3">
    {programs.length > 0 ? <Select disabled={pending} value={selected} onValueChange={(value) => {
      if (dirty && !window.confirm("Discard the unsaved program edits?")) return
      setSelected(value); setDirty(false); setCreated(false)
    }}>
      <SelectTrigger aria-label="Program to edit" className="h-11 w-full text-base sm:h-9 sm:text-sm"><SelectValue /></SelectTrigger>
      <SelectContent>{programs.map((item) => <SelectItem key={item.id} value={item.id}>{item.title || "Untitled program"}</SelectItem>)}<SelectItem value="new">Add a program</SelectItem></SelectContent>
    </Select> : null}
    {created ? <div className="space-y-2"><p role="status" className="text-muted-foreground text-xs">Program saved privately. You can find it in Organization → Programs.</p><Button variant="outline" size="sm" className="min-h-11" onClick={() => setCreated(false)}>Add another</Button></div> : <LaunchInlineForm
      key={selected}
      onDirtyChange={setDirty}
      onPendingChange={setPending}
      fields={[{ name: "title", label: "Program name", required: true }, { name: "description", label: "What do you offer?", multiline: true }]}
      initialValues={{ title: program?.title ?? "", description: organizationNarrativeHtmlToPlainText(program?.description ?? "") }}
      hint={program ? "Changes update this program. Its visibility stays the same." : "Start with the basics. New programs are saved privately."}
      saveLabel={program ? "Save program" : "Add program"}
      onSave={async ({ title, description }) => {
        if (!title.trim()) return { error: "Enter a name for your program." }
        const patch = { title: title.trim(), description: description.trim() }
        const result = program ? await updateProgramAction(program.id, patch) : await createProgramAction({ ...patch, isPublic: false })
        if ("error" in result) return { error: result.error }
        if (!program) { setCreated(true); setDirty(false); setPending(false) }
        return { message: "Program saved." }
      }}
    />}
  </div>
}
