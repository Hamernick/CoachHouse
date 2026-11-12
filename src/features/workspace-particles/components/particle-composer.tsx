"use client"

import { usePlanningComposer } from "@/components/workspace/planning-composer-context"
import { Button as CommandButton } from "@/components/ui/button"
import { composerMenuIcon } from "./particle-composer-menu-icons"
import { AiUsageSidebar } from "@/features/ai-credits/client"
import { cn } from "@/lib/utils"
import { ParticleButton as Button } from "@/components/ui/particle-ui"

import { useEffect, useEffectEvent, useId, useRef, useState, type ReactNode } from "react"
import PlusIcon from "lucide-react/dist/esm/icons/plus"
import LoaderCircleIcon from "lucide-react/dist/esm/icons/loader-circle"
import ArrowUpIcon from "lucide-react/dist/esm/icons/arrow-up"

import { ParticleComposerConversation } from "./particle-composer-conversation"
import { ParticleComposerEditor } from "./particle-composer-editor"
import type { ComposerInputHandle } from "../lib/composer-editor"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ParticlePopover as Popover } from "@/components/ui/particle-ui"

import { ParticleCreateActions } from "./particle-create-actions"
import type { ParticleType } from "../types"
import type { ComposerContextControl } from "@/lib/workspace/composer-context"
import { useParticleComposerMenu } from "./particle-composer-menu"
import {
  particleComposerSearchQuery,
  parseParticleCreateCommand,
  isParticlePlanningRequest,
} from "../lib/particle-command"

export function ParticleComposer({
  disabled,
  pending,
  error,
  saved,
  onCreate,
  onRetry,
  onBrowse,
  assistant,
  planner,
}: {
  disabled: boolean
  pending: boolean
  error: string | null
  saved: boolean
  onCreate: (type: ParticleType, title: string) => Promise<boolean>
  onRetry: () => void
  onBrowse?: (query: string, open?: boolean) => void
  assistant?: { revising?:boolean; active: boolean; pending: boolean; controls: ReactNode; panel?: ReactNode; submit: (prompt: string) => Promise<boolean> }
  planner?: { context?: ComposerContextControl; active: boolean; input?: string; onInputChange?: (value: string) => void; focusVersion?: number
    request?: { panel: ReactNode; prompt: string; onChange: (value: string) => void; pending: boolean; inputDisabled: boolean; submitDisabled: boolean; submit: () => Promise<void> }
    submit: (prompt: string, onReturn: (draft: string, saved: boolean) => void) => void }
}) {
  const command = usePlanningComposer()
  const feedbackId = useId()
  const inputRef=useRef<ComposerInputHandle>(null)
  useEffect(()=>{ if (assistant?.revising) inputRef.current?.focus() },[assistant?.revising])
  const [menuOpen, setMenuOpen] = useState(false)
  const [localInput, setLocalInput] = useState("")
  const input = command?.intent ? command.draft : planner?.request?.prompt ?? planner?.input ?? localInput
  const setInput = (value: string) => {
    if (command?.intent) command.setDraft(value)
    else if (planner?.request) planner.request.onChange(value)
    else if (planner?.onInputChange) planner.onInputChange(value)
    else setLocalInput(value)
  }
  useEffect(() => { if (planner?.focusVersion) inputRef.current?.focus({ preventScroll: true }) }, [planner?.focusVersion])
  const inputDisabled = disabled || pending || Boolean(assistant?.pending) || Boolean(command?.pending) || Boolean(planner?.request?.inputDisabled)
  const contextChecking = Boolean(planner?.context?.access?.checking)
  const submitDisabled = inputDisabled || (command?.intent ? false : contextChecking || Boolean(planner?.request?.submitDisabled)) || !input.trim()
  const picker = useParticleComposerMenu({input,setInput,inputRef,context:planner?.context,onBrowse,disabled:inputDisabled || contextChecking || Boolean(command?.intent),actions:assistant?.controls})
  const closeCommandPicker = useEffectEvent(() => picker.close())
  useEffect(() => { if (command?.focusVersion) { closeCommandPicker(); inputRef.current?.focus({ preventScroll: true }) } }, [command?.focusVersion])
  const panel = planner?.request?.panel ?? assistant?.panel
  const [hint, setHint] = useState<string | null>(null)
  const submit = async () => {
    if (submitDisabled) return
    if (command?.intent) {
      if (input.trim().length > command.intent.maxLength) { setHint(`Keep the title under ${command.intent.maxLength} characters.`); return }
      try { if (!await command.submit()) setHint("Not saved. Your draft is kept."); else setHint(null) }
      catch { setHint("Not saved. Your draft is kept.") }
      return
    }
    if (planner?.request) { await planner.request.submit(); return }
    if (assistant?.active) {
      if (planner?.context?.selected.length) { setHint("Return to planning to use selected context."); return }
      if (await assistant.submit(input)) { setInput(""); setHint(null) }
      return
    }
    if (planner && isParticlePlanningRequest(input)) {
      if (input.length > 2000) { setHint("Keep the objective under 2,000 characters."); return }
      planner.submit(input, (draft, saved) => {
        setInput(saved ? "" : draft); setHint(null)
        requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }))
      })
      return
    }
    const query = particleComposerSearchQuery(input)
    if (onBrowse && query !== null) {
      onBrowse(query)
      return
    }
    const parsedCommand = parseParticleCreateCommand(input)
    if (!parsedCommand.ok) {
      setHint(parsedCommand.error)
      return
    }
    const { type, title } = parsedCommand.value
    if (await onCreate(type, title)) {
      setInput("")
      setHint(null)
      onBrowse?.("", false)
    }
  }
  return (
    <div className="nodrag nopan nowheel relative shrink-0 px-2.5 pt-2 pb-2">
      <ParticleComposerConversation active={Boolean(planner?.request)} panel={panel} openVersion={planner?.focusVersion} hasInput={Boolean(input.trim())}>
      <div ref={picker.root} className="relative">
      <AiUsageSidebar />
      {picker.menu}
      {((!planner?.request && panel) || error || hint) && <div className="absolute inset-x-0 bottom-full z-10 mb-1 flex max-h-[min(60dvh,32rem)] min-w-0 flex-col overflow-y-auto overscroll-contain rounded-2xl border canvas-glass text-left shadow-none">
        {!planner?.request && panel}
        {(error || hint) && <div id={feedbackId} role="status" className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-muted-foreground">
          <span>{error ?? hint}</span>
          {error && <Button color="secondary" variant="ghost" size="md" className="shrink-0 [@media(pointer:coarse)]:min-h-11" disabled={pending} onClick={onRetry}>Retry</Button>}
        </div>}
      </div>}
      <form
        onKeyDownCapture={event => { if (command?.intent && event.key === "Backspace" && !input && !command.pending) { event.preventDefault(); command.clear() } }}
        className={cn("flex w-full items-end gap-1 p-1 focus-within:border-ring transition-colors duration-150 motion-reduce:transition-none", planner?.request ? "rounded-[24px] group-data-[state=open]/conversation:rounded-t-none group-data-[state=open]/conversation:rounded-b-2xl" : "canvas-glass canvas-planning-material rounded-[24px] border")}
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
            {planner?.context ? <Tooltip delayDuration={300}>
              <TooltipTrigger asChild><Button color="secondary" uniform type="button" aria-label="Add files and more" data-workspace-composer-action="true"
                disabled={inputDisabled} variant="ghost" size="lg" aria-expanded={picker.open} aria-haspopup="listbox"
                className="text-muted-foreground hover:text-foreground size-9 shrink-0 rounded-full" onClick={picker.openContext}>
                <PlusIcon className="size-4" aria-hidden />
              </Button></TooltipTrigger>
              {!picker.open && <TooltipContent side="bottom" sideOffset={8} showArrow={false} className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-foreground shadow-none">
                Add files and more<span aria-hidden className="flex size-5 items-center justify-center rounded-full bg-foreground/15 text-sm">@</span>
              </TooltipContent>}
            </Tooltip> : (
            <Popover
              open={menuOpen}
              onOpenChange={(open) => {
                if (open && onBrowse && !assistant?.controls) {
                  setInput("")
                  setHint(null)
                  onBrowse("")
                  return
                }
                setMenuOpen(open)
              }}
            >
              <Tooltip delayDuration={300}>
              <Popover.Trigger>
                <TooltipTrigger asChild>
                <Button color="secondary" uniform
                  type="button"
                  data-workspace-composer-action="true"
                  aria-label="Add Particle"
                  disabled={inputDisabled || planner?.active}
                  variant="ghost"
                  size="lg"

                  className="text-muted-foreground hover:text-foreground size-9 shrink-0 rounded-full transition-colors duration-150 motion-reduce:transition-none"
                >
                  <PlusIcon className="size-4" aria-hidden />
                </Button>
                </TooltipTrigger>
              </Popover.Trigger>
              {!menuOpen && <TooltipContent side="bottom" sideOffset={8} showArrow={false}
                className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-foreground shadow-none">
                Add files and more
                <span aria-hidden="true" className="flex size-5 items-center justify-center rounded-full bg-foreground/15 text-sm">@</span>
              </TooltipContent>}
              </Tooltip>
              <Popover.Content minWidth={0}
                align="start"
                side="top"
                sideOffset={12}
                className="canvas-glass w-52 rounded-2xl p-1.5 text-left shadow-none motion-reduce:animate-none"

              >
                {onBrowse ? <Button color="secondary" type="button" size="md" variant="ghost" className="min-h-9 w-full justify-start gap-2.5 rounded-lg px-2.5 [@media(pointer:coarse)]:min-h-11" onClick={() => { setMenuOpen(false); onBrowse("") }}><PlusIcon aria-hidden className="size-4" />Add Particle</Button> : <ParticleCreateActions
                  disabled={disabled || pending}
                  onCreate={async (type, title) => {
                    setMenuOpen(false)
                    return onCreate(type, title)
                  }}
                />}
                <div onClick={() => setMenuOpen(false)}>{assistant?.controls}</div>
              </Popover.Content>
            </Popover>)}
          {command?.intent && <CommandButton type="button" variant="ghost" size="sm" aria-label={`Remove /${command.intent.kind} command`} title="Remove command" disabled={command.pending}
            onClick={() => command.clear()} className="h-9 self-start shrink-0 gap-1 rounded-full px-1.5 font-normal text-blue-600 dark:text-blue-400">
            {(() => { const { Icon, color } = composerMenuIcon(command.intent.kind === "objective" ? "objective" : "finance"); return <Icon aria-hidden className={cn("size-4", color)} /> })()}
            /{command.intent.kind}
          </CommandButton>}
          {planner?.context && !command?.intent ? <ParticleComposerEditor inputRef={inputRef} value={input} context={planner.context} disabled={inputDisabled}
            placeholder={command?.intent ? "Title…" : assistant?.revising ? "Describe changes to this draft…" : assistant?.active ? "Ask for help with this document…" : "Plan anything…"}
            attributes={{...picker.inputProps, "aria-label": assistant?.active ? "Ask AI about this document" : "Plan an objective or search Particles", "aria-describedby": feedbackId, "aria-invalid": Boolean(error || hint)}}
            onChange={value => { setInput(value); setHint(null) }} onCaret={picker.update}
            onCompositionStart={picker.close}
            onBlur={event => { if (!picker.root.current?.contains(event.relatedTarget as Node)) picker.close() }}
            onKeyDown={event => {
              if (picker.onKeyDown(event)) { event.stopPropagation(); return }
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault(); event.stopPropagation(); void submit()
              }
            }}
          /> : <Textarea {...picker.inputProps} data-slot="input-group-control"
            ref={element => { inputRef.current = element }}
            aria-label={assistant?.active ? "Ask AI about this document" : planner ? "Plan an objective or search Particles" : "Search Particles or enter a command"}
            placeholder={command?.intent ? "Title…" : assistant?.revising ? "Describe changes to this draft…" : assistant?.active ? "Ask for help with this document…" : "Plan anything…"}
            aria-describedby={feedbackId}
            aria-invalid={Boolean(error || hint)}
            value={input}
            disabled={inputDisabled}
            rows={1}
            className="max-h-32 min-h-9 min-w-0 flex-1 resize-none rounded-none border-0 bg-transparent px-1.5 py-1.5 text-base leading-6 shadow-none focus-visible:ring-0 focus-visible:outline-none md:text-sm dark:bg-transparent [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:py-2.5"
            onChange={(event) => {
              const value = event.target.value
              setInput(value)
              setHint(null)
              const native = event.nativeEvent as InputEvent
              picker.update(value,event.target.selectionStart,native.isComposing,native.inputType === "insertFromPaste")
            }}
            onClick={event => picker.update(input,event.currentTarget.selectionStart)}
            onKeyUp={event => { if (["ArrowLeft","ArrowRight","Home","End"].includes(event.key)) picker.update(input,event.currentTarget.selectionStart,event.nativeEvent.isComposing) }}
            onCompositionStart={picker.close}
            onBlur={event => { if (!picker.root.current?.contains(event.relatedTarget as Node)) picker.close() }}
            onKeyDown={(event) => {
              if (picker.onKeyDown(event)) return
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault()
                void submit()
              }
            }}
          />}
            <Button color="primary" uniform
              data-workspace-composer-action="true"
              type="submit"
              disabled={submitDisabled}
              aria-label={
                command?.intent ? `Add ${command.intent.kind}` : planner?.request ? "Generate plan" : assistant?.active ? "Generate document proposal" : pending
                  ? "Saving Particle"
                  : planner && isParticlePlanningRequest(input)
                    ? "Review planning request"
                  : onBrowse && particleComposerSearchQuery(input) !== null
                    ? "Search Particles"
                    : "Run command"
              }
              size="lg"
              className="size-9 shrink-0 rounded-full shadow-none transition-[background-color,opacity] duration-150 motion-reduce:transition-none"
            >
              {pending || assistant?.pending || planner?.request?.pending ? (
                <LoaderCircleIcon
                  className="size-4 animate-spin motion-reduce:animate-none"
                  aria-hidden
                />
              ) : (
                <ArrowUpIcon className="size-4" aria-hidden />
              )}
            </Button>
      </form>
      </div>
      </ParticleComposerConversation>
      {!error && !hint && <span id={feedbackId} aria-live="polite" className="sr-only">
        {pending ? "Saving…" : saved ? "Saved" : "Enter to continue. Shift + Enter adds a new line."}
      </span>}
    </div>
  )
}
