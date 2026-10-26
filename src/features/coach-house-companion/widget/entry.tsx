import { StrictMode, useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import { App } from "@modelcontextprotocol/ext-apps"
import { CoachHouseCompanionPanel } from "../components"
import { ConnectedCompanionPanel } from "../components/connected-companion-panel"
import type { CompanionToolResult, CompanionTransport, LiveCompanionToolResult, LiveCompanionSnapshot, LiveCompanionToolName, LiveCompanionToolArguments } from "../types"
import "../../../app/globals.css"

const app = new App({ name: "Coach House Companion", version: "0.1.0" }, {})
type ConnectedResult = LiveCompanionToolResult & { snapshot: LiveCompanionSnapshot }
type CardResult = CompanionToolResult | ConnectedResult
function connected(result: CardResult): result is ConnectedResult { return result.snapshot.mode === "connected" }
let receive: (result: CardResult) => void = () => undefined
const transport: CompanionTransport = async (name, args) => {
  const response = await app.callServerTool({ name, arguments: args })
  if (response.isError) throw new Error(response.content?.filter(c => c.type === "text").map(c => c.text).join(" ") || "Action unavailable")
  return response.structuredContent as CompanionToolResult
}
const liveTransport = async (name: LiveCompanionToolName, args: LiveCompanionToolArguments): Promise<LiveCompanionToolResult> => {
  const response = await app.callServerTool({ name, arguments: args })
  if (response.isError) throw new Error(response.content?.filter(c => c.type === "text").map(c => c.text).join(" ") || "Action unavailable")
  return response.structuredContent as LiveCompanionToolResult
}

function Widget() {
  const [result, setResult] = useState<CardResult | null>(null)
  const [error, setError] = useState("")
  useEffect(() => {
    receive = next => {
      if (!["sandbox", "connected"].includes(next?.snapshot?.mode)) return
      setResult(previous => {
        if (connected(next)) {
          const pending = previous && connected(previous) && previous.proposal?.organizationId === next.snapshot.organization.id && previous.proposal.documentId === next.snapshot.document.id ? previous.proposal : undefined
          return { ...next, proposal: next.proposal ?? pending }
        }
        return { ...next, proposal: next.proposal ??
          (previous && !connected(previous) && previous.proposal && next.snapshot.document.revision <= previous.proposal.expectedRevision ? previous.proposal : undefined) }
      })
    }
    app.ontoolresult = params => receive(params.structuredContent as CardResult)
    app.onhostcontextchanged = context => { if (context.theme) document.documentElement.classList.toggle("dark", context.theme === "dark") }
    void app.connect().then(async () => {
      const context = app.getHostContext()
      document.documentElement.classList.toggle("dark", context?.theme === "dark")
      // Connected cards consume the host's selected organization/lesson result.
      // Never bootstrap a real account by guessing an organization.
      if (document.querySelector('meta[name="coach-house-companion-mode"]')?.getAttribute("content") === "connected") return
      const result = await app.callServerTool({ name: "companion_get_session", arguments: {} })
      if (result.isError) throw new Error("Could not resume this sandbox. Read the session in the conversation.")
      receive(result.structuredContent as CompanionToolResult)
    }).catch(value => setError(value instanceof Error ? value.message : "Host connection unavailable"))
  }, [])
  return <main className="bg-background p-4 text-foreground">
    {result && connected(result) ? <ConnectedCompanionPanel key={`${result.snapshot.organization.id}:${result.snapshot.lesson.id}`} initialSnapshot={result.snapshot} proposal={result.proposal} transport={liveTransport}
      onDownloadCalendar={app.getHostCapabilities()?.downloadFile ? async (event) => {
        const response = await app.downloadFile({ contents: [{ type: "resource", resource: { uri: "file:///coach-house-work-block.ics", mimeType: "text/calendar", text: event.ics } }] })
        if (response.isError) throw new Error("Download canceled or blocked")
      } : undefined} /> : result && !connected(result) ? <CoachHouseCompanionPanel key={result.snapshot.organization.id} initialSnapshot={result.snapshot} proposal={result.proposal} transport={transport}
      onDownloadCalendar={app.getHostCapabilities()?.downloadFile ? async (event) => {
        const response = await app.downloadFile({ contents: [{ type: "resource", resource: { uri: "file:///coach-house-work-block.ics", mimeType: "text/calendar", text: event.ics } }] })
        if (response.isError) throw new Error("Download canceled or blocked")
      } : undefined} /> : <p role="status">{error || "Opening Coach House Companion…"}</p>}
  </main>
}

createRoot(document.getElementById("companion-root")!).render(<StrictMode><Widget /></StrictMode>)
