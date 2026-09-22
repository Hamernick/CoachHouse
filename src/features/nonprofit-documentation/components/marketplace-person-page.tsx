import Link from "next/link"
import ArrowLeftIcon from "lucide-react/dist/esm/icons/arrow-left"
import ArrowUpRightIcon from "lucide-react/dist/esm/icons/arrow-up-right"
import MapPinIcon from "lucide-react/dist/esm/icons/map-pin"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import type { PublicPersonDirectoryProfile } from "@/features/public-profiles"

import { DocumentationSurface } from "./documentation-surface"

export function MarketplacePersonPage({
  person,
}: {
  person: PublicPersonDirectoryProfile
}) {
  return (
    <DocumentationSurface>
      <main
        id="documentation-content"
        className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8"
      >
        <Button asChild variant="link" className="mb-4 min-h-11 px-0">
          <Link href="/documentation/marketplace?view=people">
            <ArrowLeftIcon aria-hidden />
            Marketplace people
          </Link>
        </Button>
        <article className="rounded-2xl border p-5 sm:p-8">
          <header className="flex flex-col items-start gap-4 sm:flex-row sm:gap-6">
            <Avatar className="size-20">
              <AvatarImage
                src={person.avatarUrl ?? undefined}
                alt=""
                className="object-cover"
              />
              <AvatarFallback>
                {person.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-sm break-words">
                @{person.handle}
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight break-words sm:text-3xl">
                {person.name}
              </h1>
              {person.headline ? (
                <p className="mt-2 break-words">{person.headline}</p>
              ) : null}
              {person.location ? (
                <p className="text-muted-foreground mt-3 flex items-start gap-2 text-sm break-words">
                  <MapPinIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {person.location}
                </p>
              ) : null}
              {person.websiteUrl ? (
                <Button asChild variant="outline" className="mt-4 min-h-11">
                  <a href={person.websiteUrl} target="_blank" rel="noreferrer">
                    Website
                    <ArrowUpRightIcon aria-hidden />
                  </a>
                </Button>
              ) : null}
            </div>
          </header>
          {person.bio?.trim() ? (
            <section
              aria-labelledby="person-about-title"
              className="mt-6 border-t pt-6"
            >
              <h2 id="person-about-title" className="text-base font-semibold">
                About
              </h2>
              <p className="text-muted-foreground mt-2 leading-relaxed break-words whitespace-pre-wrap">
                {person.bio}
              </p>
            </section>
          ) : null}
        </article>
      </main>
    </DocumentationSurface>
  )
}
