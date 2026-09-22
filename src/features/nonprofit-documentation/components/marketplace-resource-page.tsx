import Link from "next/link"
import ArrowLeftIcon from "lucide-react/dist/esm/icons/arrow-left"
import ArrowUpRightIcon from "lucide-react/dist/esm/icons/arrow-up-right"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  marketplaceCostLabel,
  marketplaceTypeLabel,
} from "../lib/marketplace-directory"
import { MARKETPLACE_RESOURCE_GUIDES } from "../lib/marketplace-resource-guides"
import type { MarketplaceResource } from "../marketplace-types"
import {
  DocumentationJsonLd,
  DocumentationSurface,
} from "./documentation-surface"
import { MarketplaceResourceActions } from "./marketplace/marketplace-resource-actions"
import { MarketplaceReferralOffer } from "./marketplace/marketplace-referral-offer"
import { DocumentationPageHeader } from "./documentation-page-header"

export function MarketplaceResourcePage({
  resource,
}: {
  resource: MarketplaceResource
}) {
  const guide = MARKETPLACE_RESOURCE_GUIDES[resource.id]
  return (
    <DocumentationSurface>
      <DocumentationJsonLd
        value={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: resource.name,
          description: resource.description,
          dateModified: resource.reviewedDate,
          mainEntityOfPage: `https://coachhouse.app/documentation/marketplace/${resource.id}`,
          author: { "@type": "Organization", name: "Coach House" },
        }}
      />
      <main
        id="documentation-content"
        className="mx-auto w-full max-w-[1120px] px-4 py-6 sm:px-6 lg:px-8"
      >
        <Button asChild variant="link" className="mb-3 min-h-11 px-0">
          <Link href="/documentation/marketplace">
            <ArrowLeftIcon aria-hidden />
            Marketplace
          </Link>
        </Button>
        <DocumentationPageHeader
          artwork={`marketplace/${resource.id}`}
          artworkKind={resource.artworkKind}
          eyebrow={marketplaceTypeLabel(resource.type)}
          title={resource.name}
          description={resource.headerDescription}
        />
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <article className="min-w-0 space-y-4">
            <section id="use-when" aria-labelledby="resource-use-title">
              <h2
                id="resource-use-title"
                className="text-base leading-tight font-semibold tracking-tight"
              >
                What you can do with it
              </h2>
              <p className="text-muted-foreground mt-1 leading-5">
                {guide?.outcome ?? resource.useWhen}
              </p>
            </section>
            {guide ? (
              <>
                <section id="prepare" aria-labelledby="resource-prepare-title">
                  <h2
                    id="resource-prepare-title"
                    className="text-base leading-tight font-semibold tracking-tight"
                  >
                    Before you start
                  </h2>
                  <ul className="text-muted-foreground mt-2 list-disc space-y-2 pl-5 text-sm leading-5">
                    {guide.preparation.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
                <section
                  id="get-started"
                  aria-labelledby="resource-steps-title"
                >
                  <h2
                    id="resource-steps-title"
                    className="text-base leading-tight font-semibold tracking-tight"
                  >
                    Put it to work
                  </h2>
                  <p className="text-muted-foreground mt-1 text-sm">
                    A suggested workflow from Coach House.
                  </p>
                  <ol className="mt-2 space-y-4">
                    {guide.steps.map((step, index) => (
                      <li
                        key={step.title}
                        className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3"
                      >
                        <span
                          className="bg-muted flex size-8 items-center justify-center rounded-full text-sm tabular-nums"
                          aria-hidden
                        >
                          {index + 1}
                        </span>
                        <div>
                          <h3 className="pt-1 font-semibold">{step.title}</h3>
                          <p className="text-muted-foreground mt-1 text-sm leading-5">
                            {step.description}
                          </p>
                          {step.href ? (
                            <Button
                              asChild
                              variant="link"
                              className="mt-1 h-auto min-h-11 justify-start px-0 text-left whitespace-normal"
                            >
                              <a
                                href={step.href}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {step.linkLabel}
                                <ArrowUpRightIcon
                                  className="shrink-0"
                                  aria-hidden
                                />
                              </a>
                            </Button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
                {guide.examples?.length ? (
                  <section
                    id="examples"
                    aria-labelledby="resource-examples-title"
                  >
                    <h2
                      id="resource-examples-title"
                      className="text-base leading-tight font-semibold tracking-tight"
                    >
                      Ways to use it
                    </h2>
                    <div className="bg-muted/30 mt-2 divide-y rounded-2xl border px-4">
                      {guide.examples.map((example) => (
                        <div key={example.title} className="py-3">
                          <h3 className="font-medium">{example.title}</h3>
                          <p className="text-muted-foreground mt-1 text-sm leading-5">
                            {example.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
                <section id="watch-for" aria-labelledby="resource-watch-title">
                  <h2
                    id="resource-watch-title"
                    className="text-base leading-tight font-semibold tracking-tight"
                  >
                    Know before you commit
                  </h2>
                  <ul className="text-muted-foreground mt-2 list-disc space-y-2 pl-5 text-sm leading-5">
                    {guide.watchFor.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              </>
            ) : null}
            <section
              id="sources"
              aria-labelledby="resource-sources-title"
              className="border-t pt-4"
            >
              <h2
                id="resource-sources-title"
                className="text-base font-semibold"
              >
                Sources & review
              </h2>
              <ul className="mt-2 space-y-1">
                {(
                  guide?.sources ?? [
                    { title: resource.sourceLabel, href: resource.url },
                  ]
                ).map((source) => (
                  <li key={source.href}>
                    <Button
                      asChild
                      variant="link"
                      className="h-auto min-h-11 justify-start px-0 text-left whitespace-normal"
                    >
                      <a href={source.href} target="_blank" rel="noreferrer">
                        {source.title}
                        <ArrowUpRightIcon className="shrink-0" aria-hidden />
                      </a>
                    </Button>
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground mt-3 text-xs leading-5">
                Reviewed{" "}
                <time dateTime={resource.reviewedDate}>
                  {resource.reviewedDate}
                </time>
                . Scheduled recheck:{" "}
                <time dateTime={resource.reviewByDate}>
                  {resource.reviewByDate}
                </time>
                . Confirm current terms with the provider.
              </p>
            </section>
          </article>
          <aside className="bg-muted/20 order-first rounded-2xl border p-4 lg:sticky lg:top-24 lg:order-last">
            <Badge variant="secondary" className="rounded-full">
              {marketplaceCostLabel(resource.costModel)}
            </Badge>
            <p className="mt-4 text-sm leading-5">{resource.costNote}</p>
            <Button asChild className="mt-3 mb-3 min-h-11 w-full rounded-full">
              <a href={resource.url} target="_blank" rel="noreferrer">
                Visit provider
                <ArrowUpRightIcon aria-hidden />
              </a>
            </Button>
            <MarketplaceResourceActions id={resource.id} name={resource.name} />
            <MarketplaceReferralOffer offer={resource.referralOffer} />
            {resource.relatedGuide ? (
              <Button
                asChild
                variant="link"
                className="mt-4 h-auto min-h-11 justify-start px-0 text-left whitespace-normal"
              >
                <Link href={resource.relatedGuide.href}>
                  {resource.relatedGuide.title}
                  <ArrowUpRightIcon className="shrink-0" aria-hidden />
                </Link>
              </Button>
            ) : null}
            <Accordion type="single" collapsible className="mt-4 border-t">
              <AccordionItem value="details" className="border-b-0">
                <AccordionTrigger className="text-sm">
                  Access details
                </AccordionTrigger>
                <AccordionContent>
                  <dl className="mb-4 space-y-4 text-sm">
                    <div>
                      <dt className="font-medium">Who can use it</dt>
                      <dd className="text-muted-foreground mt-1 leading-5">
                        {resource.eligibility}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium">Where</dt>
                      <dd className="text-muted-foreground mt-1 leading-5">
                        {resource.geography}
                      </dd>
                    </div>
                  </dl>

                  <dl className="text-muted-foreground space-y-3 text-sm leading-5">
                    <div>
                      <dt className="text-foreground font-medium">Account</dt>
                      <dd>{resource.accountRequirement}</dd>
                    </div>
                    <div>
                      <dt className="text-foreground font-medium">Language</dt>
                      <dd>{resource.languages}</dd>
                    </div>
                    <div>
                      <dt className="text-foreground font-medium">
                        Accessibility
                      </dt>
                      <dd>{resource.accessibility}</dd>
                    </div>
                  </dl>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </aside>
        </div>
      </main>
    </DocumentationSurface>
  )
}
