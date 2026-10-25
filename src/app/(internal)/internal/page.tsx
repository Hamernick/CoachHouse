import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Internal Tools",
  description: "Access authorized Coach House staff tools.",
}

export default function InternalAdminPage() {
  return (
    <div className="space-y-3">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Staff admin</p>
        <h1 className="text-2xl font-semibold text-foreground">Internal tools</h1>
        <p className="text-sm text-muted-foreground">
          Staff-only controls will live here. Use the Organization Admin page to manage member access.
        </p>
      </header>
    </div>
  )
}
