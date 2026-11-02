import { ResearchDependencyVisualFixture } from "@/features/workspace-ai/client"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import {
  WorkspaceOntologyBoardVisualFixture,
  WorkspaceOntologyVisualFixture,
} from "@/features/workspace-ontology"

export const metadata: Metadata = {
  title: "Workspace ontology visual fixture",
  robots: { index: false, follow: false },
}

export default async function WorkspaceOntologyVisualFixturePage({ searchParams }: { searchParams: Promise<{ fixture?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound()
  if ((await searchParams).fixture === "dependencies") return <ResearchDependencyVisualFixture />
  return (
    <>
      <WorkspaceOntologyVisualFixture />
      <WorkspaceOntologyBoardVisualFixture />
    </>
  )
}
