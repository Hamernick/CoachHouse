"use client"

import { InlineAddInput } from "@/components/ui/inline-add-input"

export function OpportunityComposer({
  value,
  onChange,
  onSubmit,
}: {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <InlineAddInput
        aria-label="New opportunity"
        placeholder="Add an opportunity…"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={200}
        actionLabel="Add opportunity"
      />
    </form>
  )
}
