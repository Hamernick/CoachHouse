import { StrictMode, useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import { App } from "@modelcontextprotocol/ext-apps"
import { CoachHouseCompanionPanel } from "../components"
import type { CompanionSnapshot, CompanionToolResult, CompanionTransport } from "../types"
import "../../../app/globals.css"

const app = new App({ name: "Coach House Companion", version: "0.1.0" }, {})
let receive: (result: CompanionToolResult) => void = () => undefined
const transport: CompanionTransport = async (name, args) => {
  const response = await app.callServerTool({ name, arguments: args })
  if (response.isError) throw new Error(response.content?.filter(c => c.type === "text").map(c => c.text).join(" ") || "Action unavailable")
  return response.structuredContent as CompanionToolResult
}

function Widget() {
  const [snapshot, setSnapshot] = useState<CompanionSnapshot | null>(null)
  const [error, setError] = useState("")
  useEffect(() => {
    receive = result => { if (result?.snapshot?.mode === "sandbox") setSnapshot(result.snapshot) }
    app.ontoolresult = params => receive(params.structuredContent as CompanionToolResult)
    app.onhostcontextchanged = context => { if (context.theme) document.documentElement.classList.toggle("dark", context.theme === "dark") }
    void app.connect().then(async () => {
      const context = app.getHostContext()
      document.documentElement.classList.toggle("dark", context?.theme === "dark")
      const result = await app.callServerTool({ name: "companion_get_session", arguments: {} })
      if (result.isError) throw new Error("Could not resume this sandbox. Read the session in the conversation.")
      receive(result.structuredContent as CompanionToolResult)
    }).catch(value => setError(value instanceof Error ? value.message : "Host connection unavailable"))
  }, [])
  return <main className="bg-background p-4 text-foreground">
    {snapshot ? <CoachHouseCompanionPanel initialSnapshot={snapshot} transport={transport} /> : <p role="status">{error || "Opening Coach House Companion…"}</p>}
  </main>
}

createRoot(document.getElementById("companion-root")!).render(<StrictMode><Widget /></StrictMode>)
