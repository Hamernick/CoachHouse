"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { cn } from "@/lib/utils"
import { SectionRailIndicator } from "@/components/ui/section-rail-indicator"
import {
  useDocumentationContents,
  type DocumentationContents,
} from "../hooks/use-documentation-contents"

type Contents = DocumentationContents

function ContentsLinks({ items }: { items: Contents }) {
  const { navigationRef, activeId, setActiveId, indicator } =
    useDocumentationContents(items)
  return (
    <nav
      ref={navigationRef}
      aria-label="Article contents"
      className="relative pl-3"
    >
      <span
        aria-hidden
        className="bg-border/60 absolute inset-y-0 left-0 w-px rounded-full"
      />
      <SectionRailIndicator {...indicator} className="top-0 left-0" />
      <ol className="flex flex-col gap-1">
        {items.map(([id, title]) => (
          <li key={id}>
            <a
              href={`#${id}`}
              aria-current={activeId === id ? "location" : undefined}
              onClick={() => setActiveId(id)}
              className={cn(
                "hover:text-foreground hover:bg-muted/50 focus-visible:ring-ring flex min-h-11 items-center rounded-md px-2 text-sm leading-5 transition-colors focus-visible:ring-2 focus-visible:outline-none xl:min-h-8 xl:text-[13px]",
                activeId === id
                  ? "text-foreground font-medium"
                  : "text-muted-foreground"
              )}
            >
              {title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}

export function DocumentationMobileContents({
  items,
  className,
}: {
  items: Contents
  className?: string
}) {
  return (
    <Accordion
      type="single"
      collapsible
      className={cn("border-b xl:hidden print:hidden", className)}

    >
      <AccordionItem value="contents">
        <AccordionTrigger className="min-h-11 py-2">On this page</AccordionTrigger>
        <AccordionContent>
          <ContentsLinks items={items} />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

export function DocumentationDesktopContents({ items }: { items: Contents }) {
  return (
    <aside
      className="hidden xl:block print:hidden"
      aria-label="On this page"

    >
      <div className="sticky top-6 max-h-[calc(100svh-8rem)] overflow-y-auto">
        <p className="mb-2 pl-5 text-xs font-semibold">On this page</p>
        <ContentsLinks items={items} />
      </div>
    </aside>
  )
}
