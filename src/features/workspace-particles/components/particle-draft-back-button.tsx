"use client"

import ArrowLeftIcon from "lucide-react/dist/esm/icons/arrow-left"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { PARTICLE_EDITOR_HEADER_ACTION } from "./particle-editor-header"

/** In-app discard guard; Radix owns focus, Escape and return to the Back button. */
export function ParticleDraftBackButton({
  dirty,
  pending,
  onBack,
}: {
  dirty: boolean
  pending: boolean
  onBack: () => void
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={PARTICLE_EDITOR_HEADER_ACTION}
          aria-label="Back to Particles"
          disabled={pending}
          onClick={(event) => {
            if (pending || !dirty) {
              event.preventDefault()
              if (!pending) onBack()
            }
          }}
        >
          <ArrowLeftIcon aria-hidden />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="gap-4 rounded-3xl p-5 shadow-none motion-reduce:animate-none sm:max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base">
            Discard this draft?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Your changes haven’t been added to the canvas.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel type="button" className="rounded-full">
            Keep editing
          </AlertDialogCancel>
          <AlertDialogAction
            type="button"
            className="rounded-full"
            disabled={pending}
            onClick={(event) => {
              if (pending) event.preventDefault()
              else onBack()
            }}
          >
            Discard draft
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
