import Image from "next/image"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { AspectRatio } from "@/components/ui/aspect-ratio"
import { PublicMapFooter } from "@/components/public/public-map-index/footer"
import { FIND_PATH } from "@/lib/find/routes"
import { PublicHomeLandingHeader } from "./public-home-landing-header"
import { PublicHomeStory } from "./public-home-story"
import { HomeMediaPlaceholder } from "./public-marketing-primitives"

function HomeActions() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <Button asChild size="lg" className="min-h-11 rounded-full px-6 shadow-none">
        <Link href="/sign-up?intent=build">Start building</Link>
      </Button>
      <Button asChild size="lg" variant="outline" className="min-h-11 rounded-full px-6 shadow-none">
        <Link href={FIND_PATH}>Start collecting</Link>
      </Button>
    </div>
  )
}

export function PublicHomeLanding() {
  return (
    <div data-public-home-landing="" className="min-h-svh bg-background text-foreground">
      <a href="#home-content" className="focus-ring sr-only rounded-full bg-background px-5 py-3 focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50">
        Skip to content
      </a>
      <div data-home-sticky-header="" className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/75">
        <PublicHomeLandingHeader />
      </div>
      <main aria-label="Home" id="home-content" tabIndex={-1} className="mx-auto w-full max-w-[1400px] scroll-mt-28 px-5 outline-none sm:scroll-mt-20 sm:px-8 lg:px-14">
        <section aria-labelledby="home-title" className="flex flex-col items-center pt-14 pb-16 text-center sm:pt-20 sm:pb-24 lg:pt-24 lg:pb-28">
          <div className="mb-8 w-20 overflow-hidden rounded-2xl sm:mb-10 sm:w-24 sm:rounded-[20px]">
            <AspectRatio ratio={1}>
              <Image src="/coach-house-logo-light.png" alt="Coach House" width={96} height={96} className="block size-full object-contain dark:hidden" unoptimized />
              <Image src="/coach-house-logo-dark.png" alt="Coach House" width={96} height={96} className="hidden size-full object-contain dark:block" unoptimized />
            </AspectRatio>
          </div>
          <h1 id="home-title" className="max-w-5xl text-4xl leading-[1.08] font-normal tracking-tight text-balance sm:text-5xl lg:text-6xl">
            The platform for nonprofits.
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-base leading-snug text-balance sm:text-lg lg:text-xl">
            Find or build resources in your area.
          </p>
          <div className="mt-8 sm:mt-10"><HomeActions /></div>
        </section>

        <HomeMediaPlaceholder />
        <PublicHomeStory />

        <section aria-labelledby="home-next-title" className="pb-20 text-center sm:pb-28">
          <h2 id="home-next-title" className="mx-auto max-w-3xl text-4xl leading-[1.08] font-normal tracking-tight text-balance sm:text-6xl lg:text-7xl">
            Find your people. Build your nonprofit.
          </h2>
          <p className="text-muted-foreground mx-auto mt-6 max-w-xl text-lg leading-relaxed text-balance sm:text-xl">Find, save, and share nonprofits. Bring your team and your work together.</p>
          <div className="mt-8 mb-12 sm:mb-16"><HomeActions /></div>
          <HomeMediaPlaceholder ratio={16 / 7} />
        </section>
      </main>
      <div className="px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <PublicMapFooter showClaim={false} />
      </div>
    </div>
  )
}
