import Link from "next/link"
import ArrowRightIcon from "lucide-react/dist/esm/icons/arrow-right"
import { Button } from "@/components/ui/button"
import { DocumentationFundingBanner } from "./documentation-funding-banner"
import { cn } from "@/lib/utils"
import density from "./documentation-density.module.css"
import { DOCUMENTATION_TOOL_METADATA } from "../lib/documentation-tools"
import { DocumentationPathCover } from "./documentation-path-cover"
import { DocumentationTaskCards } from "./documentation-task-cards"
import {
  DocumentationJsonLd,
  DocumentationSurface,
} from "./documentation-surface"

const tasks = [
  {
    variant: "campaign" as const,
    title: "Create a campaign",
    description: "Plan your audience, message, and action.",
    href: "/documentation/tools/campaigns#sandbox",
  },
  {
    variant: "fundraising" as const,
    title: "Build a funding plan",
    description: "Set a funding goal and channel mix.",
    href: "/documentation/best-practices/fundraising#sandbox",
  },
  {
    variant: "marketplace" as const,
    title: "Find nonprofit tools",
    description: "Explore source-backed offers and practical resources.",
    href: "/documentation/marketplace",
  },
]

const tools = [
  {
    title: "Brand identity",
    description: "Build a palette, type system, and portable brand kit.",
    href: "/documentation/tools/brand-identity",
  },
  ...Object.entries(DOCUMENTATION_TOOL_METADATA)
    .filter(
      ([slug]) =>
        !["tools/campaigns", "best-practices/fundraising"].includes(slug)
    )
    .map(([slug, tool]) => ({
      title: tool.title,
      description: tool.description.split(".")[0] + ".",
      href: `/documentation/${slug}#sandbox`,
    })),
]

export function DocumentationHome() {
  return (
    <DocumentationSurface>
      <DocumentationJsonLd
        value={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Coach House Nonprofit Documentation",
          description:
            "Practical guides and working tools for nonprofit founders and teams.",
          url: "https://coachhouse.app/documentation",
        }}
      />
      <main
        id="documentation-content"
        className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8"
      >
        <header className={cn(density.heading, "mb-2")}>
          <h1 className="text-2xl font-semibold tracking-tight">
            Nonprofit documentation
          </h1>
          <p className="text-muted-foreground text-sm">
            Practical guides and working tools for nonprofit founders and teams.
          </p>
        </header>
        <DocumentationFundingBanner />
        <section
          id="quickstart"
          aria-labelledby="quickstart-title"
          className="grid overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 text-zinc-100 md:grid-cols-[minmax(0,1.1fr)_minmax(15rem,0.9fr)]"
        >
          <div className="p-4 sm:p-5">
            <div className={density.heading}>
              <p className="text-xs font-medium text-green-400">Quickstart</p>
              <h2
                id="quickstart-title"
                className="text-lg font-semibold tracking-tight"
              >
                Start with the essentials.
              </h2>
              <p className="max-w-md text-sm text-zinc-400">
                Work through your mission, organizational path, and first
                operating decisions. Use the guides at the stage you are in.
              </p>
            </div>
            <div className="mt-2 flex flex-wrap gap-3">
              <Button
                asChild
                className="min-h-11 rounded-full bg-white text-zinc-950 hover:bg-zinc-200"
              >
                <Link href="/documentation/quickstart">
                  Open Quickstart
                  <ArrowRightIcon aria-hidden />
                </Link>
              </Button>
              <Button
                asChild
                variant="link"
                className="min-h-11 px-2 text-zinc-300"
              >
                <Link href="/documentation/key-concepts">Key concepts</Link>
              </Button>
            </div>
          </div>
          <ol className="grid content-center gap-3 border-t border-zinc-800 p-4 text-sm sm:p-5 md:border-t-0 md:border-l">
            {[
              "Clarify who you serve and what changes for them.",
              "Choose a structure that fits the work.",
              "Set priorities for your first operating plan.",
            ].map((item, index) => (
              <li key={item} className="flex gap-4">
                <span className="text-zinc-500 tabular-nums">0{index + 1}</span>
                <span className="max-w-xs leading-5 text-zinc-300">{item}</span>
              </li>
            ))}
          </ol>
        </section>
        <section
          id="start-a-task"
          aria-labelledby="tasks-title"
          className="mt-4"
        >
          <h2
            id="tasks-title"
            className="text-base leading-tight font-semibold tracking-tight"
          >
            Start a task
          </h2>
          <DocumentationTaskCards>
            {tasks.map((task) => (
              <Link
                key={task.href}
                href={task.href}
                className="group focus-visible:ring-ring overflow-hidden rounded-2xl border focus-visible:ring-2"
              >
                <div className="px-2 pt-2">
                  <DocumentationPathCover variant={task.variant} />
                </div>
                <div className="px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold underline-offset-4 group-hover:underline">
                      {task.title}
                    </h3>
                    <ArrowRightIcon
                      className="mt-0.5 size-4 shrink-0"
                      aria-hidden
                    />
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm leading-5">
                    {task.description}
                  </p>
                </div>
              </Link>
            ))}
          </DocumentationTaskCards>
        </section>
        <section id="tools" aria-labelledby="tools-title" className="mt-4">
          <div className={density.heading}>
            <h2
              id="tools-title"
              className="text-base leading-tight font-semibold tracking-tight"
            >
              More working tools
            </h2>
            <p className="text-muted-foreground text-sm">
              Start from your own draft or load an example. Export the result
              when you are ready to use it.
            </p>
          </div>
          <div className="grid gap-x-6 md:grid-cols-2">
            {tools.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className="group focus-visible:ring-ring flex items-start justify-between gap-4 border-b py-2 focus-visible:ring-2"
              >
                <div>
                  <h3 className="text-sm font-medium underline-offset-4 group-hover:underline">
                    {tool.title}
                  </h3>
                  <p className="text-muted-foreground mt-1 text-sm leading-5">
                    {tool.description}
                  </p>
                </div>
                <ArrowRightIcon
                  className="text-muted-foreground mt-1 size-4 shrink-0"
                  aria-hidden
                />
              </Link>
            ))}
          </div>
        </section>
      </main>
    </DocumentationSurface>
  )
}
