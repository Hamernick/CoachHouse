// Local-only browser fixture: real UI + actual disposable SQL through a test bridge.
import { createRoot } from "react-dom/client"
import { WorkspaceDataViewsPanel } from "@/features/workspace-data-views"
import { WorkspaceEditorStatusProvider } from "@/components/workspace/workspace-editor-status"
import "@/app/globals.css"
createRoot(document.getElementById("root")!).render(<WorkspaceEditorStatusProvider><main className="mx-auto w-full max-w-4xl p-4"><WorkspaceDataViewsPanel organizationId="10000000-0000-4000-8000-000000000001" viewId="10000000-0000-4000-8000-000000002001" /></main></WorkspaceEditorStatusProvider>)
