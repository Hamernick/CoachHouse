import { defineConfig } from "vite"
import { resolve } from "node:path"
import { fixtureServer } from "./fixture-server"
import tailwindcss from "@tailwindcss/postcss"

import particleUiFoundation from "../../../src/components/ui/particle-ui/postcss.cjs"

const repo = resolve(__dirname, "../../..")
const actions = resolve(__dirname, "actions.ts")
export default defineConfig({
  root: __dirname,
  envDir: false,
  cacheDir: resolve(repo, "node_modules/.vite-workspace-ai-fixture"),
  esbuild: { jsx: "automatic" },
  css: { postcss: { plugins: [particleUiFoundation(), tailwindcss()] } },
  define: { "process.env.NEXT_PUBLIC_WORKSPACE_AI_ENABLED": JSON.stringify("true") },
  resolve: { alias: [
    { find: "next/navigation", replacement: actions },
    { find: "@/actions/roadmap", replacement: actions },
    { find: "@/lib/organization/org-media", replacement: actions },
    { find: "@", replacement: resolve(repo, "src") },
  ] },
  plugins: [
    { name: "fixture-server-action-boundary", enforce: "pre", resolveId(source, importer) {
      if (source === "../memory-actions" && importer?.includes("workspace-ai/components/")) return resolve(__dirname, "memory-actions.ts")
      if ((source === "@/features/workspace-objectives/client" || source === resolve(repo, "src/features/workspace-objectives/client")) && importer?.endsWith("workspace-chat-planning.tsx")) return resolve(repo, "src/features/workspace-objectives/components/planning-sidebar-surface.tsx")
      if ((source === "@/features/workspace-finance" || source === resolve(repo, "src/features/workspace-finance")) && importer?.endsWith("particle-widget-preview.tsx")) return "\0fixture-opportunity-preview"
      if ((source === "@/features/workspace-finance" || source === resolve(repo, "src/features/workspace-finance")) && importer?.includes("workspace-tools/")) return resolve(repo, "src/features/workspace-finance/components/workspace-finance-stripe-connection.tsx")
      if ((source === "@/features/workspace-particles/client" || source === resolve(repo, "src/features/workspace-particles/client")) && importer?.includes("workspace-objectives/")) return resolve(__dirname, "revision-particle-client.ts")
      if ((source === "@/components/roadmap/roadmap-calendar" || source === resolve(repo, "src/components/roadmap/roadmap-calendar")) && importer?.endsWith("roadmap-editor-shell.tsx")) return "\0fixture-core-calendar"
      if (source === "../server/actions" && importer?.includes("organization-document-collaboration/")) return "\0fixture-core-history"
      if (source === "../core-access-actions" && importer?.includes("document-editing/")) return resolve(__dirname, "core-editor-actions.ts")
      if (source === "../actions" && importer?.includes("document-editing/")) return resolve(__dirname, "native-window-actions.ts")
      if ((source === "@/lib/supabase/client" || source === resolve(repo, "src/lib/supabase/client")) && importer?.endsWith("document-file-window.tsx")) return resolve(__dirname, "native-window-client.ts")
      if (source === "../actions" && importer?.includes("workspace-objectives/hooks/")) return actions
      if (source === "../matching-actions" && importer?.includes("workspace-finance/components/")) return resolve(__dirname, "matching-actions.ts")
      if (source === "../../project-workflow-actions" && importer?.endsWith("project-asset-folders.tsx")) return resolve(__dirname, "folder-library-actions.ts")
      if (source === "next/dynamic" && importer?.endsWith("project-folder-document-editor.tsx")) return resolve(__dirname, "next-dynamic.tsx")
      if (source === "../../server/project-folder-access-actions") return resolve(__dirname, "folder-access-actions.ts")
      if (source === "../server/actions" && importer?.includes("workspace-management/")) return resolve(__dirname, "workspace-command-actions.ts")
      if (source === "../retained-access-actions" && importer?.includes("workspace-management/")) return resolve(__dirname, "retained-access-actions.ts")
      if (source === "../access-actions" && importer?.includes("workspace-management/")) return resolve(__dirname, "workspace-access-actions.ts")
      if (source === "../canvas-access-actions" && importer?.includes("workspace-management/")) return resolve(__dirname, "canvas-access-actions.ts")
      if (source === "../context-actions" && importer?.includes("workspace-ai/components/")) return resolve(__dirname, "context-actions.ts")
      if (source === "../research-draft-actions" && importer?.includes("workspace-ai/components/")) return actions
      if (source === "../conversation-actions" && importer?.includes("workspace-ai/components/")) return actions
      if (source === "../research-actions" && importer?.includes("workspace-ai/components/")) return actions
      if (source === "../refill-actions" && importer?.includes("ai-credits/components/")) return resolve(__dirname, "refill-actions.ts")
      if (source === "../purchase-actions" && importer?.includes("ai-credits/components/")) return resolve(__dirname, "credit-actions.ts")
      if (source === "../allowance-actions" && importer?.includes("ai-credits/components/")) return resolve(__dirname, "credit-actions.ts")
      if (source === "../usage-summary-actions" && importer?.includes("ai-credits/components/")) return "\0fixture-usage-summary"
      if (source === "../usage-actions" && importer?.includes("ai-credits/components/")) return resolve(__dirname, "credit-actions.ts")
      if (source === "../limit-actions" && importer?.includes("ai-credits/components/")) return resolve(__dirname, "credit-actions.ts")
      if (source === "../actions" && (importer?.includes("workspace-ai/components/") || importer?.includes("workspace-ai/hooks/"))) return actions
      if (source === "../research-source-actions" && importer?.includes("workspace-ai/")) return "\0fixture-research-source-actions"
      if (source === "../source-actions" && importer?.includes("workspace-data-views/")) return "\0fixture-data-view-actions"
      if (source === "../note-actions" && importer?.includes("workspace-sharing/")) return "\0fixture-note-actions"
      if (source === "../directory-actions" && importer?.includes("workspace-sharing/")) return resolve(__dirname, "sharing-actions.ts")
      if (source === "../access-actions" && importer?.includes("workspace-sharing/")) return resolve(__dirname, "guest-actions.ts")
      if ((source === "../server/actions" || source === "../actions") && importer?.includes("workspace-sharing/")) return resolve(__dirname, "sharing-actions.ts")
      return null
    }, load(id) {
      if (id === "\0fixture-core-calendar") return 'export function RoadmapCalendar(){throw new Error("Calendar outside native core fixture")}'
      if (id === "\0fixture-core-history") return 'export async function loadOrganizationDocumentVersions(){throw new Error("Core collaboration remains disabled in this fixture")}'
      if (id === "\0fixture-usage-summary") return `import {creditAccount, creditOrg} from ${JSON.stringify(resolve(__dirname, "credit-actions.ts"))}; export async function loadCurrentAiUsage(){return {organizationId:creditOrg,account:creditAccount}}`
      if (id === "\0fixture-opportunity-preview") return 'export function WorkspaceOpportunityPreview(){throw new Error("Opportunity preview outside this controlled fixture")}'
      if (id === "\0fixture-research-source-actions") return 'export async function readWorkspaceResearchSourceEffects(){throw new Error("Source receipt outside this controlled fixture")} export async function applyWorkspaceResearchSourceEffects(){throw new Error("Source effects outside this controlled fixture")}'
      if (id === "\0fixture-data-view-actions") return 'export async function runDataViewCommand(){throw new Error("Data view command outside this controlled fixture")}'
      if (id === "\0fixture-note-actions") return 'export async function workspacePageNoteAction(){throw new Error("Note operation outside this controlled fixture")}'
    } },
    fixtureServer(),
  ],
  server: { host: "127.0.0.1", port: 3187, strictPort: true, watch: null, fs: { allow: [repo] } },
})
