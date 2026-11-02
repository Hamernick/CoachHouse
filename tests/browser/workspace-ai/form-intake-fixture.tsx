import type { FormDefinition } from "@/features/organization-forms"
import { PublicWorkspacePage } from "@/features/workspace-sharing/components/public-workspace-page"
import { OrganizationFormResponseBrowser, OrganizationFormResponses } from "@/features/organization-forms/client"
export const nativeFormId = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const noLock = () => {}
export function FormIntakeFixture() {
  if (new URLSearchParams(location.search).has("direct-responses") || location.pathname.startsWith("/forms/responses/")) return <main className="mx-auto min-h-dvh w-full max-w-2xl px-3 py-6 sm:px-6">
    <OrganizationFormResponses versionId={location.pathname.startsWith("/forms/responses/") ? location.pathname.split("/").at(-1)! : nativeFormId(80)} standalone />
  </main>
  const definition: FormDefinition = new URLSearchParams(location.search).has("other") ? { questions: [
    { id: nativeFormId(90), type: "single_choice", label: "Location", required: true, options: ["North", "South"], allowOther: true },
    { id: nativeFormId(95), type: "multiple_choice", label: "Activities", required: false, options: ["Art", "Music"], allowOther: true },
  ] } : new URLSearchParams(location.search).has("grids") ? { questions: [
    { id: nativeFormId(90), type: "multiple_choice_grid", label: "Availability", required: true,
      rows: [{ id: nativeFormId(100), label: "Monday" }, { id: nativeFormId(101), label: "Tuesday" }],
      columns: [{ id: nativeFormId(110), label: "Morning" }, { id: nativeFormId(111), label: "Afternoon" }] },
    { id: nativeFormId(95), type: "checkbox_grid", label: "Activities", required: false,
      rows: [{ id: nativeFormId(102), label: "Adults" }, { id: nativeFormId(103), label: "Children" }],
      columns: [{ id: nativeFormId(112), label: "Art" }, { id: nativeFormId(113), label: "Music" }] },
  ] } : new URLSearchParams(location.search).has("scales") ? { questions: [
    { id: nativeFormId(90), type: "linear_scale", label: "Confidence", required: true, min: 0, max: 10, lowerLabel: "Low", upperLabel: "High" },
    { id: nativeFormId(95), type: "rating", label: "Experience", required: false, min: 1, max: 5, lowerLabel: "Poor", upperLabel: "Excellent" },
  ] } : { questions: [{ id: nativeFormId(90), type: "text", label: "Name", required: true }] }
  return <main className="mx-auto flex max-w-md flex-col gap-6 p-3">
    <PublicWorkspacePage embedded interactiveForms snapshot={{ version: 1, title: "", description: "", brand: { name: "Community table", organizationSlug: "community-table" },
      items: [{ id: nativeFormId(20), title: "Sign up", content: { kind: "form", intakeVersionId: nativeFormId(80), definition } }] }} />
    <OrganizationFormResponseBrowser pageId={nativeFormId(10)} onLockChange={noLock} />
  </main>
}
