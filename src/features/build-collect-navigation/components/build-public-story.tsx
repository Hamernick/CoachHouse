import { cn } from "@/lib/utils"
import { HomeMediaPlaceholder, HomeStoryLink } from "./public-marketing-primitives"

const CORE_FEATURES = [
  {
    title: "Make the next step clear.",
    description: "Organize projects, tasks, and milestones around the work you need to do. Give each next step an owner.",
  },
  {
    title: "Bring your board into the work.",
    description: "Invite staff and board members into a shared Workspace. Keep responsibilities and updates close to the work.",
  },
  {
    title: "Keep the work together.",
    description: "Keep documents, notes, and your calendar alongside your plans. Find what you need without losing the context.",
  },
] as const

function BuildFeatureRow({ title, description, reverse = false, action }: {
  title: string
  description: string
  reverse?: boolean
  action?: { label: string; href: string }
}) {
  return (
    <article className={cn("grid items-center gap-6 md:gap-10", reverse ? "md:grid-cols-[1fr_2fr]" : "md:grid-cols-[2fr_1fr]")}>
      <div className={cn("min-w-0", reverse && "md:col-start-2 md:row-start-1")}>
        <HomeMediaPlaceholder />
      </div>
      <div className={cn("flex min-w-0 flex-col items-start px-1 md:px-3 lg:px-5", reverse && "md:col-start-1 md:row-start-1")}>
        <h3 className="max-w-sm text-2xl leading-tight font-normal tracking-tight text-balance lg:text-3xl">{title}</h3>
        <p className="text-muted-foreground mt-4 max-w-md text-base leading-relaxed text-pretty">{description}</p>
        {action ? <div className="mt-3"><HomeStoryLink href={action.href}>{action.label}</HomeStoryLink></div> : null}
      </div>
    </article>
  )
}

export function BuildCoreFeatures() {
  return (
    <section aria-labelledby="build-features-title" className="py-16 sm:py-24">
      <header className="mx-auto mb-10 max-w-3xl text-center sm:mb-14">
        <h2 id="build-features-title" className="text-4xl leading-[1.08] font-normal tracking-tight text-balance sm:text-5xl lg:text-6xl">One place to build your organization.</h2>
        <p className="text-muted-foreground mx-auto mt-2 max-w-2xl text-base leading-snug text-balance sm:text-lg lg:text-xl">Keep the work connected, from your first plan to your next board meeting.</p>
      </header>
      <div className="space-y-14 sm:space-y-20">
        {CORE_FEATURES.map((feature, index) => <BuildFeatureRow key={feature.title} {...feature} reverse={index % 2 === 1} />)}
        <BuildFeatureRow title="Give your organization a home." description="Share your mission, vision, values, and ways to get involved. Create your profile for free and choose when to make it public." reverse action={{ label: "Create free profile", href: "/sign-up?intent=build&plan=free" }} />
      </div>
    </section>
  )
}

export function BuildSupportSections() {
  return (
    <div className="space-y-16 pb-16 sm:space-y-24 sm:pb-24">
      <section id="accelerator" aria-labelledby="build-accelerator-title" tabIndex={-1} className="scroll-mt-32 sm:scroll-mt-24 outline-none">
        <header className="mx-auto mb-10 max-w-3xl text-center sm:mb-14">
          <p className="text-muted-foreground mb-3 text-sm">Accelerator</p>
          <h2 id="build-accelerator-title" className="text-4xl leading-[1.08] font-normal tracking-tight text-balance sm:text-5xl lg:text-6xl">Build a strong foundation.</h2>
          <p className="text-muted-foreground mx-auto mt-2 max-w-2xl text-base leading-snug text-balance sm:text-lg lg:text-xl">Guided training and setup for your nonprofit.</p>
        </header>
        <BuildFeatureRow title="Cover the essentials." description="Define your mission, plan your programs, and work through the essentials of running an organization. The Accelerator gives you a place to start and a path to follow." action={{ label: "Explore Accelerator access", href: "/build#pricing" }} />
      </section>
      <BuildFeatureRow title="Get support as you build." description="Work with an Executive Coach on your organization's questions and next steps. Explore operations support when you need more hands on the work." reverse action={{ label: "Compare support options", href: "/build#pricing" }} />
      <BuildFeatureRow title="Fund your first project." description="Explore fiscal sponsorship for your charitable project. Review the requirements and apply without an account. Applications are reviewed; sponsorship and funding are not guaranteed." action={{ label: "Explore fiscal sponsorship", href: "/documentation/fiscal-sponsorship#application" }} />
      <section id="documentation" aria-labelledby="build-documentation-title" tabIndex={-1} className="scroll-mt-32 sm:scroll-mt-24 outline-none">
        <h2 id="build-documentation-title" className="sr-only">Documentation</h2>
        <BuildFeatureRow title="A practical place to start." description="Read free guidance on writing your mission, planning a budget, and understanding your board's responsibilities. No account needed." reverse action={{ label: "Read the documentation", href: "/documentation" }} />
      </section>
    </div>
  )
}
