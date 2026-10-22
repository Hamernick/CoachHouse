"use client"

import XIcon from "lucide-react/dist/esm/icons/x"
import { Button } from "@/components/ui/button"
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select"
import type { AiDocumentEditor } from "../lib/document-registry"

export function DocumentContextPicker({editors,selected,organizationName,disabled,onSelect}: {
  editors:readonly AiDocumentEditor[]; selected:AiDocumentEditor | null; organizationName?:string
  disabled:boolean; onSelect:(id:string | null)=>void
}) {
  return <div className="flex min-w-0 flex-wrap items-center gap-1.5">
    <span className="max-w-48 truncate rounded-full bg-muted/60 px-2 py-1" title={organizationName}>{organizationName || "Current organization"}</span>
    <Select value={selected?.id ?? "none"} onValueChange={id=>onSelect(id === "none" ? null : id)} disabled={disabled}>
      <SelectTrigger aria-label="AI document context" className="h-8 w-fit max-w-full rounded-full border-border/60 bg-transparent text-xs shadow-none">
        <SelectValue placeholder="Choose a document" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Choose a document</SelectItem>
        {editors.map(editor=><SelectItem key={editor.id} value={editor.id}>{editor.target.title}</SelectItem>)}
      </SelectContent>
    </Select>
    {selected ? <Button variant="ghost" size="icon" className="size-8 rounded-full [@media(pointer:coarse)]:min-w-11" aria-label="Remove document context" disabled={disabled} onClick={()=>onSelect(null)}><XIcon aria-hidden="true" className="size-3.5" /></Button> : null}
  </div>
}
