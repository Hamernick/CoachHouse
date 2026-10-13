import { DocumentationHome } from "./documentation-home"
import { MarketplacePage } from "./marketplace-page"
import { DocumentationShell } from "./documentation-shell"

// Every viewer uses the same public documentation shell.
export function DocumentationVisualFixture({ viewer }: { viewer: string }) {
  return (
    <DocumentationShell>
      {viewer === "marketplace" ? <MarketplacePage /> : <DocumentationHome />}
    </DocumentationShell>
  )
}
