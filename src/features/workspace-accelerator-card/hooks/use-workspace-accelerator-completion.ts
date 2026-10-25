"use client"

import { useWorkspaceEditorStatus } from "@/components/workspace/workspace-editor-status"
import { useRef, useState } from "react"
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
  const [status, setStatus] = useState<"clean" | "saving" | "error">("clean")
  useWorkspaceEditorStatus({
    label: "Lesson progress",
    dirty: status === "error",
    pending: status === "saving",
    error: status === "error",
  })
  const completeModule = async () => {
    if (!controller.currentStep || saving.current) return false
    if (!onModuleComplete) {
      toast.error("Unable to save lesson progress. Reload and try again.")
      return false
    }
    saving.current = true
    setStatus("saving")
    try {
      const result = await onModuleComplete(controller.currentStep.moduleId)
      if (result && "error" in result) {
        setStatus("error")
        toast.error(result.error)
        return false
      }
      setStatus("clean")
      controller.markCurrentStepComplete(true)
      return true
    } catch {
      setStatus("error")
      toast.error("Unable to save lesson progress. Try Complete again.")
      return false
    } finally {
      saving.current = false
    }
  }

  const completeVideo = async () => {
    if (
      controller.currentModuleSteps.every((step) => step.stepKind === "video")
    ) {
      await completeModule()
    } else {
      controller.markCurrentStepComplete()
    }
  }

  return { completeModule, completeVideo }
}
