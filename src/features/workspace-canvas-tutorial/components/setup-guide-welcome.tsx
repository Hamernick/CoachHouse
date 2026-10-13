import type { RefObject } from "react"
import { Button } from "@/components/ui/button"
import { SetupGuidePanel } from "./setup-guide-panel"

export function SetupGuideWelcome({
  headingRef,
  title,
  body,
  label,
  storageAvailable,
  onStart,
  onClose,
}: {
  headingRef: RefObject<HTMLHeadingElement | null>
  title: string
  body: string
  label: string
  storageAvailable: boolean
  onStart: () => void
  onClose: () => void
}) {
  return (
    <SetupGuidePanel
      headingRef={headingRef}
      title={title}
      body={body}
      storageAvailable={storageAvailable}
      onClose={onClose}
      closeLabel="Close introduction"
      actions={<Button className="min-h-11 max-w-full whitespace-normal rounded-full px-6 py-2" onClick={onStart}>{label}</Button>}
    />
  )
}
