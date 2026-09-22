import Link from "next/link"
import ArrowUpRightIcon from "lucide-react/dist/esm/icons/arrow-up-right"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Empty } from "@/components/ui/empty"
import type { PublicPersonDirectoryEntry } from "@/features/public-profiles"
import { marketplacePersonHref } from "../../lib/marketplace-people"
import { MarketplacePeoplePagination } from "./marketplace-people-pagination"

import {
  MARKETPLACE_COACHES,
  MARKETPLACE_COACH_SOURCE,
} from "../../lib/marketplace-coaches"

export type MarketplacePeopleData = {
  status: "ready" | "unavailable"
  people: PublicPersonDirectoryEntry[]
  hasMore: boolean
  page: number
}

export function MarketplacePeople({
  directory,
}: {
  directory: MarketplacePeopleData
}) {
  return (
    <div className="space-y-4 pt-2">
      <section
        id="coaches"
        aria-labelledby="coaches-title"
        className="scroll-mt-24"
      >
        <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              id="coaches-title"
              className="text-base leading-tight font-semibold tracking-tight"
            >
              Coach House coaches
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Get help with a decision, a plan, or the work of building your
              organization.
            </p>
          </div>
          <Button asChild variant="link" className="min-h-11 px-0">
            <a href={MARKETPLACE_COACH_SOURCE} target="_blank" rel="noreferrer">
              About the team
              <ArrowUpRightIcon aria-hidden />
            </a>
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {MARKETPLACE_COACHES.map((coach) => (
            <Card
              key={coach.id}
              className="gap-0 overflow-hidden rounded-2xl py-0 shadow-none"
              data-marketplace-coach={coach.id}
            >
              <CardHeader className="bg-muted/40 flex flex-row items-center gap-3 p-4">
                <Avatar className="size-12">
                  <AvatarImage
                    src={coach.image}
                    alt=""
                    className="object-cover"
                  />
                  <AvatarFallback className="text-sm">
                    {coach.initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-base font-semibold">{coach.name}</h3>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {coach.role}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-4">
                <p className="text-muted-foreground text-sm leading-5">
                  {coach.description}
                </p>
              </CardContent>
              <CardFooter className="flex-col items-start gap-3 px-4 pb-4">
                <Button
                  asChild
                  variant="outline"
                  className="h-auto min-h-11 w-full rounded-full py-2 text-center whitespace-normal"
                >
                  {coach.href.startsWith("/") ? (
                    <Link href={coach.href}>{coach.action}</Link>
                  ) : (
                    <a href={coach.href} target="_blank" rel="noreferrer">
                      {coach.action}
                      <ArrowUpRightIcon className="shrink-0" aria-hidden />
                    </a>
                  )}
                </Button>
                <p className="text-muted-foreground text-xs">{coach.note}</p>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>
      <section
        id="community"
        aria-labelledby="community-title"
        className="scroll-mt-24"
      >
        <h2
          id="community-title"
          className="text-base leading-tight font-semibold tracking-tight"
        >
          Meet the community
        </h2>
        <p className="text-muted-foreground mt-1 mb-2 text-sm">
          People who have published a Coach House profile. Open a profile to
          learn about their work.
        </p>
        {directory.people.length ? (
          <div className="grid gap-x-6 md:grid-cols-2">
            {directory.people.map((person) => (
              <Link
                key={person.handle}
                href={marketplacePersonHref(person.handle)}
                className="hover:bg-muted/40 focus-visible:ring-ring flex min-w-0 items-center gap-4 rounded-xl p-4 focus-visible:ring-2"
                data-marketplace-person={person.handle}
              >
                <Avatar className="size-12">
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
                  <h3 className="font-medium break-words">{person.name}</h3>
                  {person.headline ? (
                    <p className="text-muted-foreground mt-1 text-sm break-words">
                      {person.headline}
                    </p>
                  ) : null}
                  {person.location ? (
                    <p className="text-muted-foreground mt-1 text-xs">
                      {person.location}
                    </p>
                  ) : null}
                </div>
                <ArrowUpRightIcon
                  className="text-muted-foreground size-4 shrink-0"
                  aria-hidden
                />
              </Link>
            ))}
          </div>
        ) : (
          <Empty
            className="rounded-2xl py-6"
            title={
              directory.status === "unavailable"
                ? "Community profiles are temporarily unavailable"
                : directory.page > 1
                  ? "No more profiles on this page"
                  : "Public profiles are just getting started"
            }
            description={
              directory.status === "unavailable"
                ? "Try again shortly. You can still contact the coaches above."
                : "Published member profiles will appear here as people share their work."
            }
          />
        )}
        <MarketplacePeoplePagination
          page={directory.page}
          hasMore={directory.hasMore}
        />
      </section>
    </div>
  )
}
