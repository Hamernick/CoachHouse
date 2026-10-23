"use client"
import { useEffect, useRef, useState } from "react"
import { Paperclip } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Command, CommandInput, CommandList, CommandItem } from "@/components/ui/command"
import { opportunitySourceSchema, sourceKey, type OpportunitySource, type OpportunitySourceOption } from "../lib/opportunity-sources"
import { OpportunitySourcePill, SourceIcon } from "./opportunity-source-pill"

export function OpportunitySourcesInput({ value, onChange, organizationId, options, loadOptions, loading, error, disabled, query, onQueryChange, onAttachFiles, commitOnBlur = false }: {
  value: OpportunitySource[]; onChange: (sources: OpportunitySource[]) => void; organizationId: string
  options: OpportunitySourceOption[]; loadOptions: () => void; loading: boolean; error: string | null; disabled: boolean
  query: string; onQueryChange: (value: string) => void
  onAttachFiles: () => void; commitOnBlur?: boolean
}) {
  const [message, setMessage] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const mention = query.startsWith("@")
  useEffect(() => {
    if (!commitOnBlur) return
    const text = query.trim()
    const valid = !text || opportunitySourceSchema.safeParse(/^https?:\/\//i.test(text) ? { kind: "link", url: text } : { kind: "text", label: text }).success
    input.current?.setCustomValidity(mention ? "Choose a source from the suggestions." : valid ? "" : "Enter a valid source.")
  }, [commitOnBlur, mention, query])
  const matches = options.filter(item => !value.some(source => sourceKey(source) === sourceKey(item.source)) && `${item.title} ${item.category}`.toLocaleLowerCase().includes(query.slice(1).trim().toLocaleLowerCase())).slice(0, 20)
  function add(source: OpportunitySource) {
    if (value.length >= 20) { setMessage("You can add up to 20 sources."); return }
    if (!value.some(item => sourceKey(item) === sourceKey(source))) onChange([...value, source])
    onQueryChange(""); setMessage(null)
  }
  function addTyped() {
    const text = query.trim()
    if (!text) return
    const parsed = opportunitySourceSchema.safeParse(/^https?:\/\//i.test(text) ? { kind: "link", url: text } : { kind: "text", label: text })
    if (parsed.success) add(parsed.data)
    else setMessage("Enter a valid link or a source name under 120 characters.")
  }
  return <div className="min-w-0 space-y-1">
    {value.length > 0 && <div className="flex flex-wrap gap-1.5">{value.map(source => <OpportunitySourcePill key={sourceKey(source)} source={source} organizationId={organizationId} option={options.find(item => sourceKey(item.source) === sourceKey(source))} disabled={disabled} onRemove={() => onChange(value.filter(item => sourceKey(item) !== sourceKey(source)))} />)}</div>}
    <Command shouldFilter={false} className="h-auto bg-transparent [&_[data-slot=command-input-wrapper]]:border-0 [&_[data-slot=command-input-wrapper]]:px-1 [&_[data-slot=command-input-wrapper]>svg]:hidden">
      <div className="relative"><CommandInput ref={input} onBlur={() => { if (commitOnBlur && !mention) addTyped() }} aria-label="Sources" aria-expanded={mention} placeholder="Sources" className="pr-10" disabled={disabled} maxLength={2048} value={query} onPaste={event => {
        const text = event.clipboardData.getData("text").trim()
        const parsed = opportunitySourceSchema.safeParse({ kind: "link", url: text })
        if (parsed.success) { event.preventDefault(); add(parsed.data) }
      }} onValueChange={text => { onQueryChange(text); setMessage(null); if (text.startsWith("@")) loadOptions() }} onKeyDown={event => {
        if (event.key === "Escape" && mention) { event.preventDefault(); event.stopPropagation(); onQueryChange("") }
        if (event.key === "Enter" && !mention) { event.preventDefault(); addTyped() }
      }} /><Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 size-9 rounded-full [@media(pointer:coarse)]:size-11" disabled={disabled} aria-label="Attach files to Sources" onClick={onAttachFiles} onKeyDown={event => event.stopPropagation()}><Paperclip className="size-4" aria-hidden="true" /></Button></div>
      {mention && <CommandList aria-label="Source suggestions" className="max-h-52 rounded-xl bg-background/60 p-1">
        {loading ? <p role="status" className="p-2 text-xs text-muted-foreground">Loading sources…</p> : error ? <p role="alert" className="p-2 text-xs text-destructive">{error}</p> : matches.length === 0 ? <p className="p-2 text-xs text-muted-foreground">No matching workspace sources.</p> : matches.map(item => <CommandItem key={sourceKey(item.source)} value={sourceKey(item.source)} disabled={disabled} onSelect={() => add(item.source)} className="min-h-11 gap-2 rounded-lg"><SourceIcon category={item.category} /><span className="min-w-0 flex-1 truncate">{item.title}</span><span className="text-xs capitalize text-muted-foreground">{item.category}</span></CommandItem>)}
      </CommandList>}
    </Command>
    {message && <p role="alert" className="px-1 text-xs text-destructive">{message}</p>}
  </div>
}
