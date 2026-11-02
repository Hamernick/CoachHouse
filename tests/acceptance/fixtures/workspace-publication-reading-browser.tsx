import { createRoot } from "react-dom/client"
import { PublicWorkspacePage } from "@/features/workspace-sharing/components/public-workspace-page"
import type { WorkspacePageSnapshot } from "@/features/workspace-sharing/types"
import "@/app/globals.css"
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const snapshot: WorkspacePageSnapshot = {
  version: 1, brand: { name: "Published community organization", organizationSlug: "published-community", primaryColor: "#3B82F6" },
  title: "Approved community gathering", description: "Only the committed projection appears here.", items: [
    { id: id(20), title: "Welcome", content: { kind: "notes", markdown: "## Shared notes\n\n[Public information](https://example.org/info)\n\n| Topic | Detail |\n|---|---|\n| Time | Friday |" } },
    { id: id(21), title: "Gathering", content: { kind: "event", startsAt: "2026-11-01T20:00:00Z", location: "LongLocation".repeat(18) } },
    { id: id(22), title: "Guide", content: { kind: "document", assetId: id(60), name: "CommunityWorkshopGuideWithoutSpaces".repeat(4) + ".txt" } },
    { id: id(23), title: "Workshop image", content: { kind: "image", assetId: id(61), alt: "Published workshop participants", width: 600, height: 300 } },
    { id: id(24), title: "External source", content: { kind: "drive_link", href: "https://docs.google.com/document/d/canonicalFile01/edit" } },
  ],
}
document.documentElement.classList.toggle("dark", matchMedia("(prefers-color-scheme: dark)").matches)
const root = createRoot(document.getElementById("root")!)
if (new URLSearchParams(location.search).has("review")) {
  const { SharingFixture } = await import("../../browser/workspace-ai/sharing-fixture")
  root.render(<SharingFixture />)
} else root.render(<PublicWorkspacePage snapshot={snapshot} interactiveForms={false} />)
