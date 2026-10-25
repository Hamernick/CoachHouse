import type { Metadata } from "next"
import Link from "next/link"

import { NewsGradientThumb } from "@/components/news/gradient-thumb"

export const metadata: Metadata = {
  title: "News",
  description: "Read Coach House updates and nonprofit insights.",
}


export const revalidate = 86400

export default function NewsPage() {
  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">News</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Coach House updates</h1>
        <p className="text-sm text-muted-foreground">
          Product notes, guides, and stories from the Coach House community.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)]">
        {/* Featured story */}
        <article className="space-y-4">
          <Link href="/news/how-we-think-about-AI" className="block">
            <NewsGradientThumb
              seed="featured-how-we-think-about-ai"
              className="aspect-[16/9] w-full rounded-[28px] shadow-lg"
            />
            <div className="mt-5 space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Product · Oct 21, 2025
              </p>
              <h2 className="text-2xl font-semibold leading-tight sm:text-3xl">
                How we think about and approach AI for nonprofits
              </h2>
              <p className="max-w-xl text-sm text-muted-foreground">
                AI is math at scale pointed at the hardest part of building a sustainable nonprofit:
                fundraising, storytelling, and stewardship.
              </p>
            </div>
          </Link>
        </article>

        {/* Right column cards */}
        <div className="space-y-4">
          <Link
            href="/news/funding-roadmaps"
            className="block rounded-[28px] border border-border/60 bg-card/60 p-1 shadow-lg"
          >
            <NewsGradientThumb
              seed="news-funding-roadmaps"
              className="aspect-[4/5] w-full rounded-[28px]"
            />
            <div className="mt-3 space-y-1 px-2 pb-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Guide · Jan 2026
              </p>
              <p className="text-sm font-semibold text-foreground">Funding roadmaps funders actually read</p>
            </div>
          </Link>

          <Link
            href="/news/formation-to-funding"
            className="block rounded-[28px] border border-border/60 bg-card/60 p-1 shadow-lg"
          >
            <NewsGradientThumb
              seed="news-formation-funding"
              className="aspect-[4/5] w-full rounded-[28px]"
            />
            <div className="mt-3 space-y-1 px-2 pb-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Product · Jan 2026
              </p>
              <p className="text-sm font-semibold text-foreground">From formation to funding</p>
            </div>
          </Link>

          <Link
            href="/news/grassroots-discovery"
            className="block rounded-[28px] border border-border/60 bg-card/60 p-1 shadow-lg"
          >
            <NewsGradientThumb
              seed="news-grassroots-discovery"
              className="aspect-[4/5] w-full rounded-[28px]"
            />
            <div className="mt-3 space-y-1 px-2 pb-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Community · Jan 2026
              </p>
              <p className="text-sm font-semibold text-foreground">Discovery tools for grassroots organizations</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
