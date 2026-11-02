import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Toaster } from "sonner"
import { NotificationsMenu } from "@/components/notifications/notifications-menu"
import "../../../src/app/globals.css"

createRoot(document.getElementById("root")!).render(<StrictMode>
  <div className="flex h-16 items-center justify-end gap-4 px-8"><NotificationsMenu /></div>
  <button type="button">Outside target</button>
  <Toaster />
</StrictMode>)
