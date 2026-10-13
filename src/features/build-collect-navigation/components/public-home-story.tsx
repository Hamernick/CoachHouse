import Link from "next/link"

import { Button } from "@/components/ui/button"
import { FIND_PATH } from "@/lib/find/routes"
import { cn } from "@/lib/utils"
import { HomeResourcePreview } from "../home-resource-preview"
import { HomeResourceCount } from "./home-resource-count"
import { HomeMediaPlaceholder, HomeStoryLink } from "./public-marketing-primitives"

const FEATURES = [
  {
    title: "Collect nfp's",
    description: "Nonprofits help people meet everyday needs and find a place to belong.\n\nWe believe their work should be easy to discover and share, connecting more people with the resources in their communities.",
    href: FIND_PATH,
    action: "Explore resources",
  },
  {
    title: "Your organization, together.",
    description: "One Workspace for your team, board, documents, and decisions.",
    href: "/build#workspace",
    action: "Explore Workspace",
  },
  {
    title: "Cover your foundations.",
    description: "Build your nonprofit with guided training and setup. The Accelerator helps you define your mission, plan programs, and work through the essentials of running an organization.",
    href: "/pricing",
    action: "View Accelerator options",
  },
  {
    title: "Work with an Executive Coach.",
    description: "Get hands-on, one-to-one training for your organization. Work with an Executive Coach on the questions, decisions, and next steps you’re working through.",
    href: "/coaching",
    action: "Sign in to book",
  },
] as const

const [COLLECT_FEATURE, WORKSPACE_FEATURE, ...BUILD_FEATURES] = FEATURES

type HomeFeature = (typeof FEATURES)[number]

const STARTING_POINTS = [
  {
    title: "Practical guidance, open to everyone.",
    description: "Read free guidance on writing your mission, planning a budget, and understanding board responsibilities. No account needed.",
    href: "/documentation",
    action: "Read the documentation",
  },
  {
    title: "Fund your first project.",
    description: "Explore fiscal sponsorship for your charitable project. See what’s required and how to apply.",
    href: "/documentation/fiscal-sponsorship",
    action: "Explore fiscal sponsorship",
  },
  {
    title: "Make room for what’s next.",
    description: "Choose a plan that fits where your organization is today and where it’s going.",
    href: "/pricing",
    action: "View plans",
  },
] as const

function HomeFeatureRow({ feature, reverse = false, media }: { feature: HomeFeature; reverse?: boolean; media?: React.ReactNode }) {
  return (
    <article className={cn("grid items-center gap-6 md:gap-10", reverse ? "md:grid-cols-[1fr_2fr]" : "md:grid-cols-[2fr_1fr]")}>
      <div className={cn("min-w-0", reverse && "md:col-start-2 md:row-start-1")}>
        {media ?? <HomeMediaPlaceholder />}
      </div>
      <div className={cn("flex min-w-0 flex-col items-start px-1 md:px-3 lg:px-5", reverse && "md:col-start-1 md:row-start-1")}>
        <h3 className="max-w-sm text-2xl leading-tight font-normal tracking-tight text-balance lg:text-3xl">{feature.title}</h3>
        <div className="text-muted-foreground mt-4 max-w-md space-y-3 text-base leading-relaxed text-pretty">
          {feature.description.split("\n\n").map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>
        <div className="mt-3"><HomeStoryLink href={feature.href}>{feature.action}</HomeStoryLink></div>
      </div>
    </article>
  )
}

function HomeBuildHero() {
  return (
    <div className="mb-16 sm:mb-20">
      <header className="mx-auto mb-8 flex max-w-3xl flex-col items-center text-center sm:mb-10">
        <p className="text-muted-foreground mb-3 text-sm font-medium">Build</p>
        <h2 id="home-build-title" className="text-4xl leading-[1.08] font-normal tracking-tight text-balance sm:text-5xl lg:text-6xl">
          {WORKSPACE_FEATURE.title}
        </h2>
        <p className="text-muted-foreground mt-2 max-w-2xl text-base leading-snug text-balance sm:text-lg lg:text-xl">
          {WORKSPACE_FEATURE.description}
        </p>
        <Button asChild size="lg" className="mt-6 min-h-11 rounded-full px-6 shadow-none">
          <Link href={WORKSPACE_FEATURE.href}>{WORKSPACE_FEATURE.action}</Link>
        </Button>
      </header>
      <HomeMediaPlaceholder />
    </div>
  )
}

export function PublicHomeStory() {
  return (
    <>
      <section aria-labelledby="home-how-title" className="pt-24 pb-16 sm:pt-32 sm:pb-20 lg:pt-40 lg:pb-24">
        <div className="mx-auto mb-12 max-w-3xl text-center sm:mb-16">
          <h2 id="home-how-title" className="text-4xl leading-[1.08] font-normal tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Collect resources
          </h2>
          <HomeResourceCount />
        </div>
        <HomeFeatureRow feature={COLLECT_FEATURE} media={<HomeResourcePreview />} />
      </section>

      <section aria-labelledby="home-build-title" className="border-t border-border/60 pt-16 pb-24 sm:pt-20 sm:pb-32 lg:pt-24 lg:pb-40">
        <HomeBuildHero />
        <div className="flex flex-col gap-16 md:gap-10">
          {BUILD_FEATURES.map((feature, index) => (
            <HomeFeatureRow key={feature.href} feature={feature} reverse={index % 2 !== 0} />
          ))}
        </div>
      </section>

      <section aria-labelledby="home-start-title" className="pb-24 sm:pb-32 lg:pb-40">
        <div className="mx-auto mb-12 max-w-2xl text-center sm:mb-16">
          <h2 id="home-start-title" className="text-4xl leading-[1.08] font-normal tracking-tight text-balance sm:text-5xl lg:text-6xl">For wherever you are.</h2>
          <p className="text-muted-foreground mt-6 text-lg leading-relaxed text-balance sm:text-xl">A first idea, a growing team, or a need close to home.</p>
        </div>
        <div className="grid gap-12 md:grid-cols-3 md:gap-6">
          {STARTING_POINTS.map((item) => (
            <article key={item.href} className="flex min-w-0 flex-col">
              <HomeMediaPlaceholder ratio={4 / 3} />
              <h3 className="mt-6 text-2xl leading-tight font-normal tracking-tight text-balance">{item.title}</h3>
              <p className="text-muted-foreground mt-3 text-base leading-relaxed text-pretty">{item.description}</p>
              <div className="mt-3"><HomeStoryLink href={item.href}>{item.action}</HomeStoryLink></div>
            </article>
          ))}
        </div>
      </section>
    </>
  )
}
