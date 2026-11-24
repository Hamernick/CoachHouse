"use client"

import { createContext } from "react"
import { getModuleNotesAction, saveModuleNotesAction } from "@/app/actions/module-notes"
import type { Json } from "@/lib/supabase/schema/json"

export const ModuleNotesActionsContext = createContext({
  load: getModuleNotesAction,
  save: saveModuleNotesAction,
  flush(moduleId: string, content: string, organizationId: string | undefined, revision: Json | null) {
    void fetch(`/api/modules/${moduleId}/notes`, {
      method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
      body: JSON.stringify({ content, organizationId, revision }),
    }).catch(() => { /* The scoped draft remains until an acknowledged save or read. */ })
  },
})
