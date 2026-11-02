// Actual native-response view UI; backend bridge is restricted to the disposable fixture.
import { createRoot } from "react-dom/client"
import { ResponseSavedViews } from "@/features/workspace-data-views"
import { WorkspaceEditorStatusProvider } from "@/components/workspace/workspace-editor-status"
import "@/app/globals.css"
createRoot(document.getElementById("root")!).render(<WorkspaceEditorStatusProvider><main className="mx-auto w-full max-w-4xl p-4"><ResponseSavedViews versionId="10000000-0000-4000-8000-000000000080" /></main></WorkspaceEditorStatusProvider>)
