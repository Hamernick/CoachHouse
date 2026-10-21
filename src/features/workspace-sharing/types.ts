import type { z } from "zod"
import type { workspacePageDraftSchema, workspacePageSchema, workspacePageSnapshotSchema } from "./lib"

export type WorkspacePageDraft = z.infer<typeof workspacePageDraftSchema>
export type WorkspacePageSnapshot = z.infer<typeof workspacePageSnapshotSchema>
export type WorkspacePage = z.infer<typeof workspacePageSchema>
