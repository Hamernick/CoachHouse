"use client"
import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject, type ReactNode } from "react"
import type { ComposerInputHandle } from "../lib/composer-editor"
import { ParticleButton as Button } from "@/components/ui/particle-ui"
import { COMPOSER_CONTEXT_GROUPS, type ComposerContextControl, type ComposerContextItem, type ComposerContextResult } from "@/lib/workspace/composer-context"
import { composerMenuIcon } from "./particle-composer-menu-icons"
import styles from "./particle-composer-menu.module.css"
import { ParticleAssigneeAvatars } from "./particle-assignee-avatars"
import { filterParticlePresets } from "../lib/particle-presets"
import { composerToken, replaceComposerToken, type ComposerToken } from "../lib/composer-token"

type MenuItem = { id: string; title: string; group: string; detail?: string; available: boolean; context?: ComposerContextItem }
export function useParticleComposerMenu({ input, setInput, inputRef, context, onBrowse, disabled, actions }: {
  input: string; setInput: (value: string) => void; inputRef: RefObject<ComposerInputHandle | null>
  context?: ComposerContextControl; onBrowse?: (query: string, open?: boolean) => void; disabled: boolean; actions?: ReactNode
}) {
  const id = useId(), root = useRef<HTMLDivElement>(null)
  const keyboardNavigation = useRef(false)
  const [token, setToken] = useState<ComposerToken | null>(null)
  const [plus, setPlus] = useState(false), [active, setActive] = useState(0)
  const [response, setResponse] = useState<{ value:ComposerContextResult; query:string; search:ComposerContextControl["search"] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const kind = disabled ? null : plus ? "context" : token?.kind ?? null
  const query = plus ? "" : token?.query ?? ""
  const search = context?.search
  const cached = kind === "context" ? context?.getCached?.(query) : undefined
  const results = cached ?? (response?.query === query && response.search === search ? response.value : null)
  const close = () => { setPlus(false); setToken(null); setResponse(null); setError(null) }
  useEffect(() => {
    if (kind !== "context" || !search || cached) return
    let current = true
    const timer = setTimeout(() => {
      setResponse(null); setError(null)
      void search(query).then(value => { if (current) setResponse({value,query,search}) })
        .catch(() => { if (current) setError("Context could not be loaded.") })
    }, query ? 150 : 0)
    return () => { current = false; clearTimeout(timer) }
  }, [kind,query,search,retry,cached])
  useEffect(() => {
    if (!kind) return
    const dismiss = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) { setPlus(false); setToken(null); setResponse(null); setError(null) } }
    document.addEventListener("pointerdown",dismiss)
    return () => document.removeEventListener("pointerdown",dismiss)
  }, [kind])
  const items: MenuItem[] = kind === "create"
    ? filterParticlePresets(query).toSorted((a,b) => Number(b.type === "objective") - Number(a.type === "objective"))
      .map(preset => ({id:preset.id,title:preset.label,group:"Create",available:true}))
    : COMPOSER_CONTEXT_GROUPS.flatMap(group => (results?.items ?? []).filter(item => item.group === group).map(item => ({...item,context:item})))
  const selected = items[active]
  useEffect(() => { if (keyboardNavigation.current) document.getElementById(`${id}-option-${active}`)?.scrollIntoView({block:"nearest",behavior:"instant"}) },[id,active])
  const choose = (item: MenuItem) => {
    if (!item.available) return
    const caret = inputRef.current?.selectionStart ?? input.length
    try {
      if (item.context && context) {
        const selection = context.select(item.context)
        const next = replaceComposerToken(input,token,caret,selection.token)
        if (inputRef.current?.insertMention) inputRef.current.insertMention(selection,token?.start ?? caret,token?.end ?? caret)
        else setInput(next.value)
        close()
        requestAnimationFrame(() => { inputRef.current?.focus({preventScroll:true}); inputRef.current?.setSelectionRange(next.caret,next.caret) })
      } else if (kind === "create") {
        const next = replaceComposerToken(input,token,caret,"")
        if (inputRef.current?.removeRange) inputRef.current.removeRange(token?.start ?? caret, token?.end ?? caret)
        else setInput(next.value.trim() ? next.value : "")
        close(); onBrowse?.(item.title)
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Context could not be added.") }
  }
  const update = (value: string, caret: number, composing = false, pasted = false) => {
    const next = composing || pasted ? null : composerToken(value,caret)
    if ((next?.kind ?? null) !== kind || (next?.query ?? "") !== query) { setResponse(null); setError(null); setActive(0) }
    setPlus(false); setToken(next)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!kind || event.nativeEvent.isComposing) return false
    if (event.key === "Escape") { event.preventDefault(); close(); return true }
    if (["ArrowDown","ArrowUp"].includes(event.key)) {
      event.preventDefault(); keyboardNavigation.current = true
      setActive(value => items.length ? value < 0 ? event.key === "ArrowDown" ? 0 : items.length-1 : (value + (event.key === "ArrowDown" ? 1 : items.length-1)) % items.length : 0); return true
    }
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); if (selected) choose(selected); return true }
    return false
  }
  const menu = kind ? <div data-composer-menu onPointerLeave={() => { if (!keyboardNavigation.current) setActive(-1) }} className="absolute inset-x-2.5 bottom-[calc(100%-0.25rem)] z-20 max-h-[min(50dvh,24rem)] overflow-y-auto overscroll-contain rounded-2xl border bg-popover p-1.5 text-left text-popover-foreground shadow-none">
    {kind === "context" && (!context || error || !results) ? <div role="status" className="px-2.5 py-2 text-xs text-muted-foreground">
      {!context ? "Context is available when planning." : error ?? "Loading context…"}
      {error && <Button color="secondary" size="sm" variant="ghost" className="font-normal" onMouseDown={event => event.preventDefault()} onClick={() => setRetry(value=>value+1)}>Retry</Button>}
    </div> : null}
    <div id={id} role="listbox" aria-label={kind === "create" ? "Create a Particle" : "Add context"}>
      {[...new Set(items.map(item => item.group))].map(group => <div role="group" aria-labelledby={`${id}-${group.replaceAll(" ","-")}`} key={group}>
        <div id={`${id}-${group.replaceAll(" ","-")}`} className="px-2 pt-2 pb-1 text-xs font-normal text-muted-foreground">{group}</div>
        {items.map((item,index) => {
          if (item.group !== group) return null
          const { Icon, color } = composerMenuIcon(group === "Create" ? item.id : group)
          return <Button key={item.id} id={`${id}-option-${index}`} type="button" role="option" aria-selected={index===active} aria-disabled={!item.available}
            color="secondary" variant="ghost" size="md" tabIndex={-1}
            className={`${styles.option} flex w-full justify-start rounded-lg text-left text-sm font-normal`}
            onMouseDown={event => event.preventDefault()} onPointerMove={() => { keyboardNavigation.current = false; setActive(index) }} onClick={() => choose(item)}>
            <span aria-hidden className={`flex shrink-0 items-center justify-center ${group === "People" ? "size-6 [&_[data-slot=avatar]]:size-6" : `size-5 rounded-[5px] ${color}`}`}>
              {group === "People" ? <ParticleAssigneeAvatars ids={[item.id]} people={[{id:item.id,name:item.title,avatarUrl:item.context?.avatarUrl}]} /> : <Icon data-no-autosize className="size-4" />}
            </span><span className="min-w-0 flex-1 truncate">{item.title}</span>
            {(item.detail || !item.available) && <span className="shrink-0 text-xs text-muted-foreground">{!item.available ? "Unavailable" : item.detail}</span>}
          </Button>
        })}
      </div>)}
    </div>
    {!items.length && (kind === "create" || results) && <p className="px-2.5 py-2 text-xs text-muted-foreground">No matches</p>}
    {actions && <div className="mt-1 border-t pt-1" onClick={close}>{actions}</div>}
    {results?.unavailable.length ? <p role="status" className="px-2.5 py-2 text-xs text-muted-foreground">{results.unavailable.join(", ")} unavailable.</p> : null}
  </div> : null
  return { root, menu, update, close, onKeyDown, open: Boolean(kind),
    openContext: () => { if (kind === "context") { close(); return }; setToken(null); setPlus(true); setResponse(null); setActive(0); setError(null); inputRef.current?.focus({preventScroll:true}) },
    inputProps: { "aria-controls": kind ? id : undefined, "aria-expanded": Boolean(kind), "aria-autocomplete": "list" as const,
      "aria-activedescendant": kind && selected ? `${id}-option-${active}` : undefined },
  }
}
