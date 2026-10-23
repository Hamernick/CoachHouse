import path from "node:path"
import { build } from "vite"

/** Component regression fixture only. Does not establish authenticated route/RLS acceptance. */
export async function buildDocumentCollaborationLifecycleFixture() {
  const entry = path.resolve("virtual-document-lifecycle.js")
  const result = await build({ configFile: false, logLevel: "error", define: { "process.env.NODE_ENV": JSON.stringify("production") },
    resolve: { alias: { "@": path.resolve("src") } }, esbuild: { jsx: "automatic" },
    plugins: [{ name: "document-lifecycle-regression", enforce: "pre", resolveId(id, importer) {
      if (id === entry) return entry
      if ((id === "../server/actions" && importer?.includes("organization-document-collaboration")) || id.endsWith("/organization-document-collaboration/server/actions.ts")) return "\0test-document-actions"
    }, load(id) {
      if (id === "\0test-document-actions") return "export async function loadOrganizationDocumentVersions() { return { versions: [] } }"
      if (id !== entry) return
      return `
        import React from "react";
        import { createRoot } from "react-dom/client";
        import { OrganizationDocumentCollaborationPanel } from "@/features/organization-document-collaboration/components/organization-document-collaboration-panel";
        import { applyDocumentSteps } from "@/features/organization-document-collaboration/lib";
        import { documentSchema, serializeDocument } from "@/features/organization-document-collaboration/lib/schema";
        import { resolveRoadmapSections } from "@/lib/roadmap";
        const section = resolveRoadmapSections({}).find(section => section.id === "origin_story");
        const fixture = { offline: false, revoked: false, session: null, section: { ...section, content: "<p>Original fixture.</p>" } };
        const transport = {
          async sync(input) {
            await new Promise(resolve => setTimeout(resolve, 50));
            if (fixture.offline) return { error: "Connection interrupted. Your local copy is retained.", code: "timeout", retryable: true };
            if (fixture.revoked) return { error: "Document access revoked. Your local copy is retained.", code: "denied" };
            if (!fixture.session && input.initialDocument) fixture.session = { generation: "fixture-generation", version: 0, document: input.initialDocument, steps: [], section_revision: null, section_content: fixture.section.content };
            if (fixture.session && input.steps?.length && input.version === fixture.session.version) {
              fixture.session = applyDocumentSteps(fixture.session, input.steps, input.clientId);
              fixture.section = { ...fixture.section, content: serializeDocument(documentSchema.nodeFromJSON(fixture.session.document)), lastUpdated: new Date().toISOString() };
            }
            const session = fixture.session && input.generation ? { ...fixture.session, steps: fixture.session.steps.slice(input.version) } : fixture.session;
            return { section: fixture.section, session, participants: [], userId: "fixture-actor", capabilities: { canView: true, canEdit: true, canViewHistory: true, reason: "editable" } };
          },
          async presence() { return { error: "Presence unavailable" } },
          async leave() {}, async versions() { return { versions: [] } }
        };
        function App() {
          const [open, setOpen] = React.useState(true);
          const [offline, setOffline] = React.useState(false);
          return React.createElement(React.Fragment, null,
            React.createElement("button", { onClick: () => setOpen(value => !value) }, open ? "Close test editor" : "Open test editor"),
            React.createElement("button", { onClick: () => { fixture.offline = !fixture.offline; setOffline(fixture.offline) } }, offline ? "Restore test connection" : "Disconnect test connection"),
            React.createElement("button", { onClick: () => { fixture.revoked = true } }, "Revoke test access"),
            open ? React.createElement(OrganizationDocumentCollaborationPanel, { section: fixture.section, organizationId: "fixture-org", userId: "fixture-actor", transport }) : null
          );
        }
        createRoot(document.getElementById("root")).render(React.createElement(App));
      `
    } }], build: { write: false, lib: { entry, name: "DocumentLifecycleRegression", formats: ["iife"] } } })
  const bundle = Array.isArray(result) ? result[0] : result
  if (!("output" in bundle)) throw new Error("Expected fixture bundle")
  const chunk = bundle.output.find(file => file.type === "chunk")
  if (!chunk || chunk.type !== "chunk") throw new Error("Missing fixture bundle")
  return chunk.code
}
