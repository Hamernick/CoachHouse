"use client"

import { ParticleButton as Button, ParticleAlertDialogAction as AlertDialogAction, ParticleAlertDialogCancel as AlertDialogCancel } from "@/components/ui/particle-ui"

import ArrowLeftIcon from "lucide-react/dist/esm/icons/arrow-left"

import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { PARTICLE_EDITOR_HEADER_ACTION } from "./particle-editor-header"

/** In-app discard guard; Radix owns focus, Escape and return to the Back button. */
export function ParticleDraftBackButton({
  dirty,
  pending,
  onBack,
  label = "Back to Particles",
}: {
  label?: string
  dirty: boolean
  pending: boolean
  onBack: () => void
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button color="secondary" uniform
          type="button"
          variant="ghost"
          size="lg"
          className={PARTICLE_EDITOR_HEADER_ACTION}
          aria-label={label}
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
