import { createRoot } from "react-dom/client"
import { PersonalMemorySettings } from "@/features/workspace-ai/components/personal-memory-settings"
import "@/app/globals.css"
createRoot(document.getElementById("root")!).render(<main className="mx-auto max-w-xl p-6"><PersonalMemorySettings /></main>)
