"use client"

import { useEffect, useId, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const hexValue = (value: string) => /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : "#000000"

export function ColorPicker({ label, value, disabled = false, onSelect }: {
  label: string
  value: string
  disabled?: boolean
  onSelect: (hex: string) => void | Promise<void>
}) {
  const input = useRef<HTMLInputElement>(null)
  const latest = useRef({ value, disabled, onSelect })
  latest.current = { value, disabled, onSelect }
  const saving = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [retryColor, setRetryColor] = useState<string | null>(null)
  const errorId = useId()

  useEffect(() => {
    if (input.current) input.current.value = hexValue(value)
  }, [value])

  async function save(selected: string) {
    if (latest.current.disabled || saving.current) return
    const hex = hexValue(selected)
    if (hex === hexValue(latest.current.value)) return
    saving.current = true
    setPending(true)
    setError("")
    try {
      await latest.current.onSelect(hex)
      setRetryColor(null)
    } catch (error) {
      setRetryColor(hex)
      setError(error instanceof Error ? error.message : "Could not save this color. Try again.")
      if (input.current) input.current.value = hexValue(latest.current.value)
    } finally {
      saving.current = false
      setPending(false)
    }
  }
  const saveRef = useRef(save)
  saveRef.current = save
  useEffect(() => {
    const field = input.current
    // Native change commits the chosen color when the picker closes. React's
    // onChange also follows input events and would save every drag adjustment.
    const commit = () => { if (field) void saveRef.current(field.value) }
    field?.addEventListener("change", commit)
    return () => field?.removeEventListener("change", commit)
  }, [])

  return (
    <div className="flex shrink-0 flex-col items-end">
      <Input ref={input} type="color" defaultValue={hexValue(value)}
        disabled={disabled || pending} aria-label={`Choose ${label} color`}
        title={`Choose ${label} color`} aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className="size-9 cursor-pointer overflow-hidden rounded-lg p-1 [&::-moz-color-swatch]:rounded [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
      />
      <span className="sr-only" role="status">{pending ? "Saving color" : ""}</span>
      {error ? <div id={errorId} role="alert" className="max-w-32 text-sm text-destructive">
        <p>{error}</p>
        {retryColor ? <Button type="button" size="sm" variant="ghost" disabled={disabled || pending} onClick={() => { void save(retryColor) }}>Retry save</Button> : null}
      </div> : null}
    </div>
  )
}
