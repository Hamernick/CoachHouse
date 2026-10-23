"use client"

import { useEffect, useRef, useState } from "react"
import type { Editor } from "@tiptap/core"
import { useEditorState } from "@tiptap/react"
import { BubbleMenu } from "@tiptap/react/menus"
import { TextSelection } from "@tiptap/pm/state"
import Bold from "lucide-react/dist/esm/icons/bold"
import Italic from "lucide-react/dist/esm/icons/italic"
import Link from "lucide-react/dist/esm/icons/link"
import X from "lucide-react/dist/esm/icons/x"
import ArrowUp from "lucide-react/dist/esm/icons/arrow-up"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupInput } from "@/components/ui/input-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSelectionAssistance } from "../hooks/use-selection-assistance"

const iconButton = "size-8 rounded-full p-0 shadow-none [@media(pointer:coarse)]:size-11"
export function SelectionAssistanceMenu({ editor, active = true, label = "Document" }: { editor: Editor; active?: boolean; label?: string }) {
  const ai = useSelectionAssistance(editor)
  const [link, setLink] = useState<string | null>(null)
  const [linkError, setLinkError] = useState("")
  const input = useRef<HTMLInputElement>(null)
  const review = useRef<HTMLDivElement>(null)
  const enabled = process.env.NEXT_PUBLIC_WORKSPACE_AI_ENABLED === "true"
  const state = useEditorState({ editor, selector: ({ editor: current }) => ({
    bold: current.isActive("bold"), italic: current.isActive("italic"),
    list: current.isActive("orderedList") ? "ordered" : current.isActive("bulletList") ? "bullet" : "paragraph",
  }) })
  useEffect(() => { if (ai.selection) input.current?.focus() }, [ai.selection])
  const begin = ai.begin
  useEffect(() => {
    const element = editor.view.dom
    const key = (event: KeyboardEvent) => {
      if (active && enabled && event.altKey && event.key === "Enter") { event.preventDefault(); void begin() }
    }
    element.addEventListener("keydown", key)
    return () => { element.removeEventListener("keydown", key) }
  }, [active, enabled, editor, begin])
  return <>
    <Popover open={Boolean(ai.selection) && active} onOpenChange={open => { if (!open) ai.discard() }}>
      <PopoverAnchor virtualRef={{ current: { getBoundingClientRect: () => ai.selection?.anchor ?? new DOMRect() } }} />
      <PopoverContent ref={review} side="top" sideOffset={8} className="w-auto max-w-[calc(100vw-1rem)] rounded-2xl p-1 shadow-sm"
        onInteractOutside={event => event.preventDefault()} onOpenAutoFocus={event => { event.preventDefault(); input.current?.focus() }}
        onCloseAutoFocus={event => {
          event.preventDefault()
          const focused = document.activeElement
          if (!editor.isDestroyed && (!focused || focused === document.body || review.current?.contains(focused))) editor.commands.focus()
        }}>
            {ai.selection ? <section aria-label="Change selected text" className="flex w-[min(360px,calc(100vw-1.5rem))] min-w-0 flex-col gap-2 p-2">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{ai.quote ? `${ai.quote.maximumCredits} credits maximum` : ai.error ? "Selected text" : "Checking credits…"}</span>
        <Button variant="ghost" className={iconButton} aria-label="Discard selection suggestion" disabled={ai.pending || ai.unresolved} onClick={ai.discard}><X aria-hidden /></Button>
      </div>
      <blockquote className="max-h-20 overflow-auto border-l-2 border-border pl-2 text-xs text-muted-foreground whitespace-pre-wrap">{ai.selection.text}</blockquote>
      {(ai.preview || ai.proposal?.content) && <div className="max-h-48 overflow-auto text-sm" aria-label="Suggested replacement">
        {ai.proposal?.content ? <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: ai.proposal.content }} /> : <p className="whitespace-pre-wrap">{ai.preview.replace(/<[^>]*>/g, "")}</p>}
      </div>}
      {!ai.applied && <form onSubmit={event => { event.preventDefault(); void ai.submit() }}>
        <InputGroup className="items-center gap-1 rounded-2xl border border-border bg-muted/30 p-1">
          <Input ref={input} aria-label="Requested changes" placeholder="Ask for changes…" value={ai.prompt} maxLength={4000}
            onChange={event => ai.setPrompt(event.target.value)} className="min-w-0 border-0 bg-transparent shadow-none focus-visible:ring-inset" />
          <Button type="submit" variant="secondary" className={iconButton} aria-label={ai.proposal?.status === "succeeded" ? "Revise selection suggestion" : "Generate selection suggestion"}
            disabled={ai.pending || !ai.quote || !ai.prompt.trim() || ai.stale || ai.unresolved}><ArrowUp aria-hidden /></Button>
        </InputGroup>
      </form>}
      <div className="flex flex-wrap items-center gap-1">
        {ai.pending && <Button variant="ghost" size="sm" className="rounded-full" onClick={() => void ai.stop()}>Stop</Button>}
        {!ai.pending && ai.unresolved && <Button variant="ghost" size="sm" className="rounded-full" onClick={() => void ai.recover()}>Check status</Button>}
        {!ai.pending && !ai.applied && ai.proposal?.status === "succeeded" && <Button size="sm" className="rounded-full shadow-none" disabled={ai.stale} onClick={() => void ai.apply()}>Apply</Button>}
        {ai.proposal?.credits != null && <span className="px-2 text-xs text-muted-foreground">{ai.proposal.credits} credits</span>}
      </div>
      <p role="status" aria-live="polite" className="text-xs text-muted-foreground">{ai.applied ? "Applied to editor" : ai.error || (ai.stale ? "The document changed. Select the text again before applying." : ai.pending ? "Drafting…" : ai.proposal && ["failed", "canceled"].includes(ai.proposal.status) ? "No replacement generated. No credits charged." : "")}</p>
    </section> : null}
      </PopoverContent>
    </Popover>
    <BubbleMenu editor={editor} updateDelay={100} appendTo={() => document.body}
    options={{ placement: "top", offset: 8, flip: true, shift: { padding: 8 } }}
    shouldShow={({ state: current, element }) => active && !ai.selection && editor.isEditable && (link !== null ||
      ((editor.isFocused || element.contains(document.activeElement)) && current.selection instanceof TextSelection && !current.selection.empty && Boolean(current.doc.textBetween(current.selection.from, current.selection.to).trim())))}
    data-editor-focus-ignore className="nodrag nopan nowheel z-50 max-w-[calc(100vw-1rem)] rounded-2xl border border-border/60 bg-popover p-1 text-popover-foreground shadow-sm">
    {link !== null ? <form className="flex max-w-full items-center gap-1 p-1" onSubmit={event => {
      event.preventDefault()
      if (link && !/^(https?:\/\/|mailto:|tel:)/i.test(link)) { setLinkError("Use an https, http, email or telephone link."); return }
      if (link) editor.chain().focus().setLink({ href: link }).run()
      else editor.chain().focus().unsetLink().run()
      setLink(null); setLinkError("")
    }}>
      <InputGroupInput aria-label="Selected text link" value={link} onChange={event => setLink(event.target.value)} placeholder="https://…" className="min-w-0 rounded-full shadow-none" />
      <Button type="submit" size="sm" className="rounded-full shadow-none">Apply</Button>
      <Button variant="ghost" className={iconButton} aria-label="Cancel link" onClick={() => setLink(null)}><X aria-hidden /></Button>
      {linkError && <span role="status" className="text-xs">{linkError}</span>}
    </form> : <div role="group" aria-label={`${label} selected text formatting`} className="flex flex-wrap items-center gap-0.5" onMouseDown={event => event.preventDefault()}>
      {enabled && <Button variant="secondary" size="sm" className="rounded-xl shadow-none [@media(pointer:coarse)]:h-11" title="Ask for changes (Alt+Enter)" onClick={() => void ai.begin()}>Ask for changes</Button>}
      <Button variant="ghost" className={iconButton} aria-label="Link selected text" onClick={() => setLink(editor.getAttributes("link").href ?? "")}><Link aria-hidden /></Button>
      <Button variant="ghost" className={iconButton} aria-label="Bold selected text" aria-pressed={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}><Bold aria-hidden /></Button>
      <Button variant="ghost" className={iconButton} aria-label="Italic selected text" aria-pressed={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic aria-hidden /></Button>
      <Select value={state.list} onValueChange={value => {
        const chain = editor.chain().focus()
        if (value === "ordered") chain.toggleOrderedList().run()
        else if (value === "bullet") chain.toggleBulletList().run()
        else if (editor.isActive("orderedList")) chain.toggleOrderedList().run()
        else if (editor.isActive("bulletList")) chain.toggleBulletList().run()
      }}><SelectTrigger aria-label="Selected text list style" className="h-8 w-auto rounded-full border-0 bg-transparent shadow-none"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="paragraph">Text</SelectItem><SelectItem value="bullet">Bullet list</SelectItem><SelectItem value="ordered">Numbered list</SelectItem></SelectContent>
      </Select>
    </div>}
  </BubbleMenu>
  </>
}
