"use client"

import { useId, useState } from "react"
import PlusIcon from "lucide-react/dist/esm/icons/plus"
import LoaderCircleIcon from "lucide-react/dist/esm/icons/loader-circle"
import CheckIcon from "lucide-react/dist/esm/icons/check"
import ArrowUpIcon from "lucide-react/dist/esm/icons/arrow-up"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover"
import {
  getReactGrabOwnerProps,
  getReactGrabLinkedSurfaceProps,
} from "@/components/dev/react-grab-surface"
import { ParticleCreateActions } from "./particle-create-actions"
import type { ParticleType } from "../types"
import { particlePresetQuery } from "../lib/particle-presets"
import {
  particleComposerSearchQuery,
  parseParticleCreateCommand,
} from "../lib/particle-command"

const COMPOSER_SOURCE =
  "src/features/workspace-particles/components/particle-composer.tsx"
const COMPOSER_OWNER = "workspace-particle:composer"

export function ParticleComposer({
  disabled,
  pending,
  error,
  saved,
  onCreate,
  onRetry,
  onBrowse,
}: {
  disabled: boolean
  pending: boolean
  error: string | null
  saved: boolean
  onCreate: (type: ParticleType, title: string) => Promise<boolean>
  onRetry: () => void
  onBrowse?: (query: string, open?: boolean) => void
}) {
  const feedbackId = useId()
  const [menuOpen, setMenuOpen] = useState(false)
  const [input, setInput] = useState("")
  const [hint, setHint] = useState<string | null>(null)
  const submit = async () => {
    if (disabled || pending || !input.trim()) return
    const query = particleComposerSearchQuery(input)
    if (onBrowse && query !== null) {
      onBrowse(query)
      return
    }
    const command = parseParticleCreateCommand(input)
    if (!command.ok) {
      setHint(command.error)
      return
    }
    const { type, title } = command.value
    if (await onCreate(type, title)) {
      setInput("")
      setHint(null)
      onBrowse?.("", false)
    }
  }
  return (
    <div
      className="nodrag nopan nowheel shrink-0 px-2.5 pt-2 pb-2"
      {...getReactGrabOwnerProps({
        ownerId: COMPOSER_OWNER,
        component: "ParticleComposer",
        source: COMPOSER_SOURCE,
        tokenSource: "src/app/globals.css",
      })}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <InputGroup className="border-border/60 bg-card/95 backdrop-blur-xl focus-within-visible:border-ring flex items-end gap-1 rounded-[24px] border p-1 transition-colors duration-150 motion-reduce:transition-none">
          <InputGroupAddon>
            <Popover
              open={menuOpen}
              onOpenChange={(open) => {
                if (open && onBrowse) {
                  setInput("")
                  setHint(null)
                  onBrowse("")
                  return
                }
                setMenuOpen(open)
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  data-workspace-composer-action="true"
                  aria-label="Add Particle"
                  disabled={disabled || pending}
                  variant="ghost"
                  size="icon"
                  {...getReactGrabOwnerProps({
                    ownerId: `${COMPOSER_OWNER}:add`,
                    component: "ParticleComposerAdd",
                    source: COMPOSER_SOURCE,
                    slot: "trigger",
                    tokenSource: "src/app/globals.css",
                    primitiveImport: "@/components/ui/button",
                  })}
                  className="text-muted-foreground hover:text-foreground size-9 rounded-full transition-colors duration-150 motion-reduce:transition-none"
                >
                  <PlusIcon className="size-4" aria-hidden />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                side="top"
                sideOffset={12}
                className="w-60 rounded-2xl p-0 motion-reduce:animate-none"
                {...getReactGrabLinkedSurfaceProps({
                  ownerId: `${COMPOSER_OWNER}:add`,
                  component: "ParticleCreateActions",
                  source: COMPOSER_SOURCE,
                  surfaceKind: "content",
                  primitiveImport: "@/components/ui/popover",
                })}
              >
                <ParticleCreateActions
                  disabled={disabled || pending}
                  onCreate={async (type, title) => {
                    setMenuOpen(false)
                    return onCreate(type, title)
                  }}
                />
              </PopoverContent>
            </Popover>
          </InputGroupAddon>
          <InputGroupTextarea
            aria-label="Search Particles or enter a command"
            placeholder="Search Particles or add to the plan…"
            aria-describedby={feedbackId}
            aria-invalid={Boolean(error || hint)}
            value={input}
            disabled={disabled || pending}
            rows={1}
            className="max-h-32 min-h-9 min-w-0 flex-1 resize-none rounded-none border-0 bg-transparent px-1.5 py-1.5 text-base leading-6 shadow-none focus-visible:ring-0 focus-visible:outline-none md:text-base dark:bg-transparent"
            onChange={(event) => {
              const value = event.target.value
              setInput(value)
              setHint(null)
              const query = particleComposerSearchQuery(value)
              const slashQuery = particlePresetQuery(value)
              onBrowse?.(
                query ?? "",
                slashQuery !== null &&
                  (particlePresetQuery(input) === null || slashQuery === "")
              )
            }}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault()
                void submit()
              }
            }}
          />
          <InputGroupAddon>
            <Button
              data-workspace-composer-action="true"
              type="submit"
              disabled={disabled || pending || !input.trim()}
              aria-label={
                pending
                  ? "Saving Particle"
                  : onBrowse && particleComposerSearchQuery(input) !== null
                    ? "Search Particles"
                    : "Run command"
              }
              size="icon"
              className="size-9 rounded-full shadow-none transition-[background-color,opacity] duration-150 motion-reduce:transition-none"
            >
              {pending ? (
                <LoaderCircleIcon
                  className="size-4 animate-spin motion-reduce:animate-none"
                  aria-hidden
                />
              ) : saved && !input ? (
                <CheckIcon className="size-4" aria-hidden />
              ) : (
                <ArrowUpIcon className="size-4" aria-hidden />
              )}
            </Button>
          </InputGroupAddon>
        </InputGroup>
      </form>
      <div
        id={feedbackId}
        aria-live="polite"
        className={
          error || hint
            ? "text-muted-foreground flex items-center justify-between gap-2 px-3 pt-2 text-xs"
            : "sr-only"
        }
      >
        <span>
          {error ??
            hint ??
            (pending
              ? "Saving…"
              : saved
                ? "Saved"
                : "Type to filter Particles. Enter opens the results. Use /commands to browse all, or create objective, create activity, or create workflow followed by a title. Shift + Enter adds a new line.")}
        </span>
        {error ? (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            disabled={pending}
            onClick={onRetry}
          >
            Retry
          </Button>
        ) : null}
      </div>
    </div>
  )
}
