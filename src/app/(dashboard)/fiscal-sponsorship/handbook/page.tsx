import { readFileSync } from "node:fs"
import { join } from "node:path"

import type { Metadata } from "next"
import Link from "next/link"
import ArrowLeftIcon from "lucide-react/dist/esm/icons/arrow-left"
import DownloadIcon from "lucide-react/dist/esm/icons/download"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  FISCAL_SPONSORSHIP_HANDBOOK_DOWNLOAD_HREF,
  FISCAL_SPONSORSHIP_HANDBOOK_NAV_ITEMS,
  FiscalSponsorshipMarkdownDocument,
} from "@/features/fiscal-sponsorship"

export const metadata: Metadata = {
  description: "Read the Coach House fiscal sponsorship handbook and program requirements.",
  title: "Fiscal Sponsorship Handbook",
}

function readFiscalSponsorshipHandbook() {
  return readFileSync(
    join(
      process.cwd(),
      "public/fiscal-sponsorship/2026-ch-fiscal-sponsorship-handbook.md"
    ),
    "utf8"
  )
}

export default function FiscalSponsorshipHandbookPage() {
  const handbookMarkdown = readFiscalSponsorshipHandbook()

  return (
    <main className="mx-auto flex w-full max-w-[92rem] flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-5">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="w-fit rounded-full"
        >
          <Link href="/my-organization">
            <ArrowLeftIcon data-icon="inline-start" />
            Back to workspace
          </Link>
        </Button>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <Badge className="bg-primary/10 text-primary h-7 rounded-full border-transparent px-2.5 py-1 leading-none">
              Fiscal Sponsorship
            </Badge>
            <h1 className="mt-4 text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
              2026 Coach House Fiscal Sponsorship Handbook
            </h1>
            <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-6">
              A styled reader for the full handbook source used by the
              application, agreement, fundraising disclosure, re-grant, and
              internal-controls flow.
            </p>
          </div>
          <Button asChild className="w-fit rounded-full">
            <a href={FISCAL_SPONSORSHIP_HANDBOOK_DOWNLOAD_HREF} download>
              <DownloadIcon data-icon="inline-start" />
              Download markdown
            </a>
          </Button>
        </div>
      </div>
      <Separator />
      <div className="grid min-w-0 gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <nav
            aria-label="Fiscal sponsorship handbook"
            className="border-border/60 bg-muted/35 rounded-2xl border p-3"
          >
            <p className="text-muted-foreground px-2 text-xs font-semibold tracking-wide uppercase">
              On this page
            </p>
            <div className="mt-3 flex flex-col gap-1">
              {FISCAL_SPONSORSHIP_HANDBOOK_NAV_ITEMS.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="hover:bg-background focus-visible:ring-ring/50 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2"
                >
                  <span className="block">{item.label}</span>
                  <span className="text-muted-foreground mt-0.5 block text-xs leading-snug font-normal">
                    {item.description}
                  </span>
                </a>
              ))}
            </div>
          </nav>
        </aside>
        <div className="bg-background border-border/60 min-w-0 rounded-2xl border px-5 py-6 shadow-sm sm:px-8 sm:py-8">
          <FiscalSponsorshipMarkdownDocument markdown={handbookMarkdown} />
        </div>
      </div>
    </main>
  )
}
