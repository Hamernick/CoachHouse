import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

const PROCESS = [
  ["Apply", "Tell us about your project, its public benefit, and your funding plan. No account required."],
  ["Hear from us", "Coach House reviews your application and contacts you about next steps."],
  ["Stay informed", "Keep your confirmation email to follow your application and respond to requests from our team."],
] as const

export function FiscalSponsorshipOverview() {
  return (
    <div id="how-it-works" className="mt-10 scroll-mt-6 space-y-8 border-t pt-8 sm:mt-12 sm:pt-10">
      <section aria-labelledby="fiscal-process-title">
        <h2 id="fiscal-process-title" className="text-2xl leading-tight font-normal tracking-tight">A place to start.</h2>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">Focus on the work your community needs. We’ll help you understand whether fiscal sponsorship is a fit.</p>
        <ol className="mt-5 grid gap-5 sm:grid-cols-3 sm:gap-6">
          {PROCESS.map(([title, description], index) => (
            <li key={title} className="min-w-0">
              <span aria-hidden className="text-xs tabular-nums text-muted-foreground">0{index + 1}</span>
              <h3 className="mt-2 text-sm font-medium">{title}</h3>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
            </li>
          ))}
        </ol>
      </section>
      <section className="grid gap-5 rounded-3xl bg-muted/30 p-5 sm:grid-cols-2 sm:gap-8 sm:p-6" aria-labelledby="fiscal-responsibilities-title">
        <h2 id="fiscal-responsibilities-title" className="sr-only">Our roles</h2>
        <div>
          <h3 className="text-lg font-normal tracking-tight">You lead the project.</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Keep your identity and manage day-to-day work.</p>
        </div>
        <div>
          <h3 className="text-lg font-normal tracking-tight">We support the funding.</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Coach House receives charitable contributions and makes grants for approved expenses, with financial oversight and fundraising review.</p>
        </div>
      </section>
      <section id="requirements" aria-labelledby="fiscal-requirements-title" className="scroll-mt-6">
        <h2 id="fiscal-requirements-title" className="text-lg font-normal tracking-tight">Is it a fit?</h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">For charitable projects. Activities outside the U.S. or lobbying require an explanation for review. We don’t sponsor primarily commercial ventures, projects for personal gain, or projects primarily distributing grants, awards, or scholarships to others.</p>
      </section>
      <Accordion type="single" collapsible className="border-y">
        <AccordionItem value="model" className="border-0">
          <AccordionTrigger className="min-h-11 py-3 text-sm">What does fiscal sponsorship mean?</AccordionTrigger>
          <AccordionContent className="max-w-prose text-sm leading-relaxed text-muted-foreground">
            Coach House uses a grantor-grantee relationship, often called Model C fiscal sponsorship. You lead your project; Coach House receives charitable contributions and makes grants for approved expenses. Applications are reviewed. Sponsorship does not guarantee funding.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
