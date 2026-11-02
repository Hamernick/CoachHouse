// Adapted from https://lab.xevrion.dev/r/inline-edit.json; async save and error recovery added.
"use client";

import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const InlineEditStatusContext = createContext<((id: string, dirty: boolean) => void) | null>(null);

const ICON_SWAP = { type: "spring", duration: 0.3, bounce: 0 } as const;
// Long enough to notice after the field settles, short enough that the
// pencil is back before the next edit.
const SAVED_FOR = 1600;

export function InlineEdit({
  label,
  value,
  onSave,
  placeholder,
  multiline = false,
  className, id, maxLength, disabled = false,
}: {
  label: string;
  value: string;
  onSave: (value: string) => void | Promise<void>;
  id?: string;
  maxLength?: number;
  disabled?: boolean;
  placeholder: string;
  multiline?: boolean;
  // Typography goes here; the display and the editor share it exactly.
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const errorId = useId();
  const reportDirty = useContext(InlineEditStatusContext);
  const active = useRef(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const saving = useRef(false);
  const original = useRef(value);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saved, setSaved] = useState(false);
  const fieldRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Keyboard exits hand focus back to the text; a click elsewhere keeps
  // focus wherever the click put it.
  const refocus = useRef(false);

  useEffect(() => () => clearTimeout(savedTimer.current), []);

  useEffect(() => {
    if (editing) {
      const field = fieldRef.current;
      field?.focus();
      // Caret at the end, where most edits start.
      field?.setSelectionRange(field.value.length, field.value.length);
    } else if (refocus.current) {
      refocus.current = false;
      buttonRef.current?.focus();
    }
  }, [editing]);

  useEffect(() => {
    reportDirty?.(errorId, editing && draft !== original.current);
    return () => reportDirty?.(errorId, false);
  }, [reportDirty, errorId, editing, draft]);

  const start = () => {
    if (disabled) return;
    active.current = true;
    refocus.current = false;
    original.current = value;
    setDraft(value);
    setError("");
    setSaved(false);
    setEditing(true);
  };

  const finish = async (commit: boolean, keyboard: boolean) => {
    if (!active.current || saving.current) return;
    refocus.current = keyboard;
    const next = multiline ? draft.trim() : draft.replace(/\s+/g, " ").trim();
    if (!commit || next === original.current) { active.current = false; setError(""); setEditing(false); return; }
    if (value !== original.current) {
      setError("This field changed elsewhere. Press Escape to load the latest value.");
      return;
    }
    saving.current = true;
    setPending(true);
    setError("");
    try {
      await onSave(next);
      active.current = false;
      setEditing(false);
      setSaved(true);
      clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), SAVED_FOR);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save. Your edit is still here; try again.");
      refocus.current = false;
    } finally { saving.current = false; setPending(false); }
  };

  useEffect(() => {
    if (editing && error && !pending && !disabled) fieldRef.current?.focus();
  }, [editing, error, pending, disabled]);

  useEffect(() => {
    if (!editing || draft === original.current) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [editing, draft]);

  // Identical box, padding, font and line-height for the display and the
  // editor, so the swap doesn't move a single glyph.
  const box = cn(
    "col-start-1 row-start-1 block w-full rounded-lg py-1 pr-9 pl-2 text-left",
    multiline ? "whitespace-pre-wrap break-words" : "truncate whitespace-pre",
    className,
  );
  const empty = value.trim() === "";

  return (
    // Pulled out by its own padding, so the text lines up with the
    // surrounding content while the tint still has room to breathe.
    <div className="group relative -mx-2 grid">
      <Button
        variant="ghost"
        disabled={disabled}
        id={!editing ? id : undefined}
        aria-label={`Edit ${label}`}
        ref={buttonRef}
        type="button"
        onClick={start}
        // Hidden while editing, but still sizing the cell, so the editor
        // inherits its exact width and starting height.
        className={cn(
          box,
          "h-auto min-h-9 justify-start font-normal disabled:opacity-100",
          "cursor-text outline-hidden transition-[background-color] duration-150 ease-out",
          "hover:bg-foreground/[0.04] focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-foreground",
          editing && "invisible",
          empty && "text-muted-foreground",
        )}
      >
        <span className="sr-only">Edit {label}: </span>
        {/* While editing, it mirrors the draft so a textarea grows with it.
            The trailing space keeps a new empty line from collapsing. */}
        {editing ? `${draft} ` : empty ? placeholder : value}
      </Button>

      {editing &&
        (multiline ? (
          <Textarea
            id={id}
            maxLength={maxLength}
            readOnly={pending}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            ref={fieldRef}
            aria-label={label}
            value={draft}
            placeholder={placeholder}
            rows={1}
            onChange={(e) => { setDraft(e.target.value); setError(""); }}
            onBlur={() => { void finish(true, false); }}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              // Shift+Enter still adds a line break.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                void finish(true, true);
              } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                void finish(false, true);
              }
            }}
            className={cn(
              box,
              "h-full resize-none overflow-hidden bg-background text-foreground ring-[1.5px] ring-foreground/25 outline-hidden placeholder:text-muted-foreground",
            )}
          />
        ) : (
          <Input
            id={id}
            maxLength={maxLength}
            readOnly={pending}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            ref={fieldRef}
            aria-label={label}
            value={draft}
            placeholder={placeholder}
            onChange={(e) => { setDraft(e.target.value); setError(""); }}
            onBlur={() => { void finish(true, false); }}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                void finish(true, true);
              } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                void finish(false, true);
              }
            }}
            className={cn(
              box,
              "h-full bg-background text-foreground ring-[1.5px] ring-foreground/25 outline-hidden placeholder:text-muted-foreground",
            )}
          />
        ))}

      {/* Pencil on hover or focus, a check right after saving. Pinned to the
          first line's height so it stays put as the text grows. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1 right-1.5 grid size-6 place-items-center text-muted-foreground",
          (editing || disabled) && "invisible",
        )}
      >
        <SwapIcon
          visible={!saved}
          reduceMotion={reduceMotion}
          className="opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100 group-has-[:focus-visible]:opacity-100"
        >
          <path d="M9.75 3.75 12.25 6.25M3.25 12.75l.6-2.6 6.9-6.9a1.25 1.25 0 0 1 1.77 0l.73.73a1.25 1.25 0 0 1 0 1.77l-6.9 6.9Z" />
        </SwapIcon>
        <SwapIcon visible={saved} reduceMotion={reduceMotion} className="text-foreground">
          <path d="m3.5 8.5 3 3 6-7" />
        </SwapIcon>
      </span>
      <span className="sr-only" role="status">{pending ? "Saving" : saved ? "Saved" : ""}</span>
      {error && <p id={errorId} role="alert" className="col-start-1 row-start-2 mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}

function SwapIcon({
  visible,
  reduceMotion,
  className,
  children,
}: {
  visible: boolean;
  reduceMotion: boolean | null;
  className?: string;
  children: React.ReactNode;
}) {
  const hidden = reduceMotion
    ? { opacity: 0 }
    : { scale: 0.25, opacity: 0, filter: "blur(4px)" };
  // The motion layer owns the swap; the wrapper owns the hover fade, so
  // the two never fight over one opacity.
  return (
    <span className={cn("col-start-1 row-start-1", className)}>
      <motion.svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-4"
        initial={false}
        animate={visible ? { scale: 1, opacity: 1, filter: "blur(0px)" } : hidden}
        transition={ICON_SWAP}
      >
        {children}
      </motion.svg>
    </span>
  );
}
