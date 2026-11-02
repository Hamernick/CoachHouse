import { useState } from "react"
import { ParticleInspector } from "@/features/workspace-particles/components/particle-inspector"
import { createParticle } from "@/features/workspace-particles/lib/particle-registry"
import type { Particle } from "@/features/workspace-particles/types"
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const noOp = () => {}
export function FormSourceFixture() {
  const [particle, setParticle] = useState<Particle>(() => {
    const item = createParticle("activity", { id: id(20), workspaceId: id(1), title: "Sign up", now: "2026-11-01T12:00:00Z" })
    if (item.type !== "activity") throw new Error("Expected activity")
    return { ...item, data: { ...item.data, widget: { kind: "form", definition: { questions: [{ id: id(90), type: "text", label: "Name", required: true }] } } } }
  })
  return <main className="mx-auto max-w-xl p-3"><ParticleInspector particle={particle} editable pending={false}
    onSave={async (next) => { setParticle(next); return true }} onClose={noOp} onDirtyChange={noOp} /></main>
}
