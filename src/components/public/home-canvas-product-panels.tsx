import { FIND_PATH } from "@/lib/find/routes"
import Link from "next/link"
import dynamic from "next/dynamic"
import ArrowRightIcon from "lucide-react/dist/esm/icons/arrow-right"
import FileTextIcon from "lucide-react/dist/esm/icons/file-text"
import LayoutDashboardIcon from "lucide-react/dist/esm/icons/layout-dashboard"
import SearchIcon from "lucide-react/dist/esm/icons/search"
import ShieldCheckIcon from "lucide-react/dist/esm/icons/shield-check"
import UsersIcon from "lucide-react/dist/esm/icons/users"
import type { ReactNode } from "react"

import {
  HomeCanvasHeroMotion,
  HomeCanvasRevealMotion,
} from "@/components/public/home-canvas-product-motion"
import { HomeFindMapMini } from "@/components/public/home-find-map-mini"
import {
  HomeDocumentsPreview,
  HomeWorkspacePreview,
} from "@/components/public/home-page-product-previews"
import { Button } from "@/components/ui/button"
import type { FiscalSponsorshipProgramOption } from "@/features/fiscal-sponsorship"

const FiscalSponsorshipWorkspaceCardSurface = dynamic(
  () =>
    import("@/features/fiscal-sponsorship").then(
      (feature) => feature.FiscalSponsorshipWorkspaceCardSurface
    ),
  {
    loading: () => (
      <div
        className="border-border/60 bg-muted mx-auto min-h-[28rem] w-full max-w-[42rem] rounded-[2rem] border"
        aria-hidden
      />
    ),
  }
)

const BUILD_CAPABILITIES = [
  { icon: LayoutDashboardIcon, label: "Strategic roadmap" },
  { icon: FileTextIcon, label: "Programs and tasks" },
  { icon: UsersIcon, label: "Team access" },
] as const

const PUBLIC_FISCAL_SPONSORSHIP_PROGRAMS: FiscalSponsorshipProgramOption[] = [
  {
    id: "public-fiscal-preview",
    title: "Neighborhood Food and Family Resource Nights",
    description:
      "Recurring neighborhood events connecting families with food and local support.",
    objectKind: "Service",
    focusArea: "Food access and family resource navigation",
    location: "Chicago, IL",
    goalCents: 3_200_000,
    raisedCents: 1_200_000,
  },
]

export function HomeCanvasMapHeroPanel({
  mapboxToken,
}: {
  mapboxToken?: string
}) {
  return (
    <HomeCanvasHeroMotion>
      <section
        data-public-home-hero=""
        aria-labelledby="home-canvas-hero-title"
        className="relative h-full min-h-[44rem] w-full overflow-hidden bg-zinc-950 text-white sm:min-h-[32rem]"
      >
        <div data-home-canvas-hero-media="" className="absolute inset-0">
          <HomeFindMapMini mapboxToken={mapboxToken} />
          <div
            className="pointer-events-none absolute inset-0 bg-black/20"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 [box-shadow:inset_0_-26rem_18rem_-17rem_rgba(0,0,0,0.96),inset_18rem_0_16rem_-17rem_rgba(0,0,0,0.72)]"
            aria-hidden
          />
        </div>

        <div
          data-home-canvas-hero-copy=""
          className="absolute inset-x-0 bottom-0 z-10 px-5 pb-6 sm:px-8 sm:pb-8 lg:px-10 lg:pb-10"
        >
          <p className="text-sm font-medium text-white/70">Coach House</p>
          <h1
            id="home-canvas-hero-title"
            className="mt-3 max-w-3xl text-4xl leading-[1.04] font-semibold text-balance sm:text-5xl lg:text-6xl"
          >
            Build, find, and fund nonprofit work.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-pretty text-white/78 sm:text-lg">
            Bring plans, people, and documents into one shared workspace, then
            help communities discover the work and resources around them.
          </p>

          <form
            action={FIND_PATH}
            method="get"
            className="mt-5 flex w-full max-w-xl items-center gap-2 rounded-full border border-white/25 bg-black/45 p-1.5 pl-4 shadow-lg backdrop-blur-xl"
          >
            <SearchIcon className="size-4 shrink-0 text-white/60" aria-hidden />
            <label htmlFor="home-canvas-map-search" className="sr-only">
              Search organizations and community resources
            </label>
            <input
              id="home-canvas-map-search"
              name="q"
              type="search"
              autoComplete="off"
              placeholder="Search the map…"
              className="min-w-0 flex-1 bg-transparent py-2 text-base text-white outline-none placeholder:text-white/55"
            />
            <Button
              type="submit"
              size="icon"
              aria-label="Search map"
              title="Search map"
              className="size-10 rounded-full bg-white text-black hover:bg-white/90"
            >
              <ArrowRightIcon aria-hidden />
            </Button>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              asChild
              size="lg"
              className="rounded-full bg-white px-6 text-black hover:bg-white/90"
            >
              <Link href={FIND_PATH}>
                Explore the map
                <ArrowRightIcon aria-hidden />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-full border-white/25 bg-black/35 px-6 text-white backdrop-blur hover:bg-white hover:text-black dark:border-white/25 dark:bg-black/35 dark:hover:bg-white"
            >
              <Link href="/home-canvas?section=platform">Start building</Link>
            </Button>
          </div>
        </div>
      </section>
    </HomeCanvasHeroMotion>
  )
}

export function HomeCanvasBuildPanel({
  pricingPanel,
}: {
  pricingPanel?: ReactNode
}) {
  return (
    <HomeCanvasRevealMotion>
      <div className="bg-background text-foreground min-h-full">
        <section
          aria-labelledby="home-canvas-build-title"
          className="mx-auto grid w-full max-w-[76rem] gap-10 px-5 pt-20 pb-14 sm:px-8 sm:pt-24 sm:pb-16 lg:grid-cols-[0.72fr_1.28fr] lg:items-center lg:gap-14 lg:px-10"
        >
          <div data-home-canvas-reveal="" className="max-w-xl">
            <p className="text-muted-foreground text-sm font-semibold">Build</p>
            <h2
              id="home-canvas-build-title"
              className="mt-3 text-3xl leading-tight font-semibold text-balance sm:text-4xl"
            >
              One workspace from board to team.
            </h2>
            <p className="text-muted-foreground mt-5 text-base leading-7 text-pretty">
              Turn strategy into shared work. Plan programs, assign ownership,
              track progress, and give staff and board members the same source
              of truth.
            </p>
            <div className="mt-6 space-y-3">
              {BUILD_CAPABILITIES.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 text-sm font-medium"
                >
                  <span className="bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-md">
                    <item.icon className="size-4" aria-hidden />
                  </span>
                  {item.label}
                </div>
              ))}
            </div>
            <Button asChild size="lg" className="mt-7 rounded-full px-6">
              <Link href="/home-canvas?section=signup&intent=build">
                Start building
                <ArrowRightIcon aria-hidden />
              </Link>
            </Button>
          </div>
          <div data-home-canvas-reveal="">
            <HomeWorkspacePreview />
          </div>
        </section>

        <section
          aria-labelledby="home-canvas-documents-title"
          className="border-border/70 bg-muted/30 border-t"
        >
          <div className="mx-auto grid w-full max-w-[72rem] gap-10 px-5 py-14 sm:px-8 sm:py-16 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:gap-16 lg:px-10">
            <div data-home-canvas-reveal="">
              <HomeDocumentsPreview />
            </div>
            <div
              data-home-canvas-reveal=""
              className="max-w-xl lg:justify-self-end"
            >
              <p className="text-muted-foreground text-sm font-semibold">
                Documents
              </p>
              <h2
                id="home-canvas-documents-title"
                className="mt-3 text-3xl leading-tight font-semibold text-balance sm:text-4xl"
              >
                Every document, next to the work it supports.
              </h2>
              <p className="text-muted-foreground mt-5 text-base leading-7 text-pretty">
                Keep formation records, board materials, budgets, and program
                files in one secure, centralized library your team can actually
                find.
              </p>
              <div className="text-muted-foreground mt-6 flex items-center gap-3 text-sm">
                <ShieldCheckIcon
                  className="text-foreground size-5"
                  aria-hidden
                />
                Shared access stays connected to your workspace team.
              </div>
            </div>
          </div>
        </section>

        {pricingPanel ? (
          <div
            data-public-home-build-pricing=""
            className="border-border/70 border-t"
          >
            {pricingPanel}
          </div>
        ) : null}
      </div>
    </HomeCanvasRevealMotion>
  )
}

export function HomeCanvasFundPanel() {
  return (
    <HomeCanvasRevealMotion>
      <section
        aria-labelledby="home-canvas-fund-title"
        className="flex min-h-full items-center bg-zinc-950 px-5 py-20 text-white sm:px-8 sm:py-24 lg:px-10"
      >
        <div className="mx-auto grid w-full max-w-[72rem] min-w-0 gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16">
          <div data-home-canvas-reveal="" className="max-w-xl min-w-0">
            <p className="text-sm font-semibold text-white/60">Fund</p>
            <h2
              id="home-canvas-fund-title"
              className="mt-3 text-3xl leading-tight font-semibold text-balance sm:text-4xl"
            >
              A clearer path from ready project to funded work.
            </h2>
            <p className="mt-5 text-base leading-7 text-pretty text-white/68">
              Qualified projects can apply for fiscal sponsorship through Coach
              House, connecting the plan and documents already in your workspace
              to shared operational infrastructure and a faster path toward
              funding.
            </p>
            <Button
              asChild
              size="lg"
              className="mt-7 rounded-full bg-white px-6 text-black hover:bg-white/90"
            >
              <Link href="/home-canvas?section=signup&intent=fund">
                Start a project
                <ArrowRightIcon aria-hidden />
              </Link>
            </Button>
            <p className="mt-4 text-xs leading-5 text-white/50">
              Fiscal sponsorship is subject to eligibility review and approval.
            </p>
          </div>
          <div data-home-canvas-reveal="" className="min-w-0">
            <FiscalSponsorshipWorkspaceCardSurface
              className="mx-auto max-w-full"
              openFlowHref="/home-canvas?section=signup&intent=fund"
              programs={PUBLIC_FISCAL_SPONSORSHIP_PROGRAMS}
              selectedProgramId="public-fiscal-preview"
            />
          </div>
        </div>
      </section>
    </HomeCanvasRevealMotion>
  )
}
