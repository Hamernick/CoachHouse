"use client"

import { useState } from "react"
import { ArrowRightIcon, BookOpenIcon, FileTextIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCompanionSession } from "../hooks/use-companion-session"
import type { CompanionSnapshot, CompanionTransport } from "../types"
import { CompanionDevelop } from "./companion-develop"
import { CompanionReview } from "./companion-review"
import { CompanionReceipt } from "./companion-receipt"
import { CompanionStatus } from "./companion-status"

export function CompanionPanel({ initialSnapshot, transport }: { initialSnapshot: CompanionSnapshot; transport: CompanionTransport }) {
  const session = useCompanionSession(initialSnapshot, transport)
  const [step, setStep] = useState("continue")
  const { snapshot } = session
  const answered = snapshot.lesson.fields.filter((field) => snapshot.draft.answers[field.name]?.trim()).length

  return <div className="mx-auto flex w-full max-w-5xl touch-manipulation flex-col gap-6 bg-background px-4 py-6 text-foreground sm:px-8 sm:py-10 [&_button]:min-h-11 [&_input]:min-h-11 [&_textarea]:text-base [&_input]:text-base motion-reduce:[&_*]:transition-none">
    <header className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2"><BookOpenIcon className="size-5" aria-hidden="true" /><span className="text-sm font-semibold tracking-tight">Coach House Companion</span></div>
        <Badge variant="outline">Private sandbox</Badge>
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-2"><p className="text-sm text-muted-foreground">{snapshot.organization.name}</p><p className="text-xs text-muted-foreground" role="status">{session.dirty ? "Unsaved changes" : "Saved state loaded"}</p></div>
      <p className="text-xs leading-5 text-muted-foreground">{snapshot.source.kind === "repository_fixture" ? "Repository curriculum fixture" : "Published curriculum source"}: {snapshot.source.label}. All changes stay in the test workspace. Calendar export requires manual import.</p>
    </header>
    <Separator />
    <Tabs value={step} onValueChange={setStep} className="gap-7">
      <TabsList variant="line" className="w-full justify-start" aria-label="Companion session stages">
        <TabsTrigger value="continue">Continue</TabsTrigger><TabsTrigger value="develop">Develop</TabsTrigger><TabsTrigger value="review">Review</TabsTrigger><TabsTrigger value="receipt">Receipt</TabsTrigger>
      </TabsList>
      <CompanionStatus session={session} />
      <TabsContent value="continue" forceMount className="mt-0 data-[state=inactive]:hidden">
        <section className="grid gap-10 py-4 lg:grid-cols-[1.3fr_1fr]" aria-labelledby="companion-outcome">
          <div className="flex flex-col items-start gap-5">
            <p className="text-sm text-muted-foreground">One lesson. One useful next step.</p>
            <h1 id="companion-outcome" className="max-w-xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Move your {snapshot.lesson.title.toLowerCase()} forward.</h1>
            <p className="max-w-xl text-base leading-7 text-muted-foreground">{snapshot.lesson.description}</p>
            <Button onClick={() => setStep("develop")}>Continue your work<ArrowRightIcon data-icon="inline-end" /></Button>
          </div>
          <aside className="flex min-w-0 flex-col gap-5 rounded-lg border p-5 sm:p-6" aria-label="Session overview">
            <div className="flex items-center gap-2"><FileTextIcon className="size-4" aria-hidden="true" /><h2 className="text-sm font-medium">What you’ll leave with</h2></div>
            <p className="text-lg font-medium tracking-tight">{snapshot.document.title}</p>
            <p className="text-sm leading-6 text-muted-foreground">Build from your answers, review the wording, and save a document you can return to.</p>
            <Separator />
            <dl className="flex flex-col gap-3 text-sm"><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Saved answers</dt><dd className="tabular-nums">{answered} / {snapshot.lesson.fields.length}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Lesson progress</dt><dd>{snapshot.submission.completed ? "Completed" : "In progress"}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Document</dt><dd className="tabular-nums">Revision {snapshot.document.revision}</dd></div></dl>
          </aside>
        </section>
      </TabsContent>
      <TabsContent value="develop" forceMount className="mt-0 data-[state=inactive]:hidden"><CompanionDevelop session={session} onReview={() => setStep("review")} /></TabsContent>
      <TabsContent value="review" forceMount className="mt-0 data-[state=inactive]:hidden"><CompanionReview session={session} onReceipt={() => setStep("receipt")} /></TabsContent>
      <TabsContent value="receipt" forceMount className="mt-0 data-[state=inactive]:hidden"><CompanionReceipt session={session} /></TabsContent>
    </Tabs>
    <footer className="pt-4 text-xs leading-5 text-muted-foreground">This preview writes only to its sandbox. It does not update your live organization, public profile, or external calendar.</footer>
  </div>
}
