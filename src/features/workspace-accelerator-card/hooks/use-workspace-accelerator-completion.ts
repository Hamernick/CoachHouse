"use client"

import { useRef } from "react"
import { toast } from "sonner"

import type { WorkspaceAcceleratorCardInput } from "../types"
import type { useWorkspaceAcceleratorCardController } from "./use-workspace-accelerator-card-controller"

export function useWorkspaceAcceleratorCompletion({
  controller,
  onModuleComplete,
}: {
  controller: ReturnType<typeof useWorkspaceAcceleratorCardController>
  onModuleComplete: WorkspaceAcceleratorCardInput["onModuleComplete"]
}) {
  const saving = useRef(false)
  const completeModule = async () => {
    if (!controller.currentStep || saving.current) return false
    if (!onModuleComplete) {
      toast.error("Unable to save lesson progress. Reload and try again.")
      return false
    }
    saving.current = true
    try {
      const result = await onModuleComplete(controller.currentStep.moduleId)
      if (!result || "error" in result) {
        toast.error(result && "error" in result ? result.error : "Unable to save lesson progress. Try Complete again.")
        return false
      }
      return await controller.markCurrentStepComplete(true)
    } catch {
      toast.error("Unable to save lesson progress. Try Complete again.")
      return false
    } finally {
      saving.current = false
    }
  }

  const completeVideo = async () => {
    if (controller.currentModuleSteps.every((step) => step.stepKind === "video")) {
      await completeModule()
    } else {
      await controller.markCurrentStepComplete()
    }
  }

  return { completeModule, completeVideo }
}
