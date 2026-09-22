import Link from "next/link"
import { Building2Icon, ExternalLinkIcon, MapPinIcon } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { WorkspaceActivityCard } from "@/components/workspace/workspace-activity-card"
import type {
  PublicOrganizationProfileView,
  PublicPersonProfileView,
  PublicProfileProgram,
  PublicProfileView,
} from "../types"
import { PublicProfileActivityHeatmap } from "./public-profile-activity-heatmap"
import { PublicProfileSavedCollections } from "./public-profile-saved-collections"

function profileInitials(displayName: string) {
  const words = displayName.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "CH"
  return `${words[0]?.[0] ?? ""}${words.at(-1)?.[0] ?? ""}`.toUpperCase()
}

function formatPublicDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date)
}

function formatPublicTimestamp(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(date)
}

const PUBLIC_ROLE_LABELS: Record<
  PublicPersonProfileView["affiliations"][number]["role"],
  string
> = {
  owner: "Owner",
  admin: "Admin",
  staff: "Staff",
  board: "Board",
  member: "Member",
}

function PublicExternalAction({
  href,
  label,
  variant = "outline",
}: {
  href: string
  label: string
  variant?: "default" | "outline"
}) {
  return (
    <Button asChild variant={variant}>
      <a href={href} target="_blank" rel="noreferrer">
        {label}
        <ExternalLinkIcon aria-hidden="true" />
      </a>
    </Button>
  )
}

function ProgramActivityCard({ program }: { program: PublicProfileProgram }) {
  const metadata = [
    program.locationLabel,
    program.startDate ? formatPublicDate(program.startDate) : null,
  ].filter((value): value is string => Boolean(value))

  return (
    <WorkspaceActivityCard
      title={program.title}
      description={program.summary}
      statusLabel={program.statusLabel ?? "Published"}
      status="scheduled"
      metadata={metadata}
      href={program.ctaUrl}
      actionLabel={program.ctaLabel ?? "Learn more"}
      external
    />
  )
}

function OrganizationActivity({
  profile,
}: {
  profile: PublicOrganizationProfileView
}) {
  if (profile.programs.length === 0) return null

  return (
    <section aria-labelledby="public-profile-activity" className="space-y-5">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 id="public-profile-activity" className="text-xl font-medium">
            Activity
          </h2>
          <p className="text-muted-foreground text-sm">
            Published ways to participate, apply, or learn more.
          </p>
        </div>
        <Badge variant="outline" className="hidden sm:inline-flex">
          {profile.programs.length} public{" "}
          {profile.programs.length === 1 ? "program" : "programs"}
        </Badge>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {profile.programs.map((program) => (
          <ProgramActivityCard key={program.id} program={program} />
        ))}
      </div>
    </section>
  )
}

function OrganizationPeople({
  profile,
}: {
  profile: PublicOrganizationProfileView
}) {
  const people = profile.people ?? []
  if (people.length === 0) return null

  return (
    <section aria-labelledby="public-profile-people" className="space-y-5">
      <div className="space-y-1 text-center">
        <h2 id="public-profile-people" className="text-xl font-medium">
          People
        </h2>
        <p className="text-muted-foreground text-sm">
          Staff and board members added by this organization.
        </p>
      </div>
      <div className="mx-auto grid max-w-2xl gap-3 sm:grid-cols-2">
        {people.map((person) => (
          <article
            key={person.id}
            className="flex min-w-0 items-center gap-3 rounded-2xl border p-4"
          >
            <Avatar className="size-11 shrink-0 border">
              <AvatarImage src={person.avatarUrl ?? undefined} alt="" />
              <AvatarFallback className="text-xs">
                {profileInitials(person.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-medium">{person.name}</h3>
              {person.title ? (
                <p className="text-muted-foreground truncate text-xs">
                  {person.title}
                </p>
              ) : null}
            </div>
            <Badge variant="outline" className="shrink-0">
              {person.roleLabel}
            </Badge>
          </article>
        ))}
      </div>
    </section>
  )
}

function PersonAffiliations({ profile }: { profile: PublicPersonProfileView }) {
  if (profile.affiliations.length === 0) return null

  return (
    <section
      aria-labelledby="public-profile-organizations"
      className="space-y-5"
    >
      <div className="space-y-1 text-center">
        <h2 id="public-profile-organizations" className="text-xl font-medium">
          Organizations
        </h2>
        <p className="text-muted-foreground text-sm">
          Verified organizations this person belongs to.
        </p>
      </div>
      <div className="mx-auto grid max-w-2xl gap-3 sm:grid-cols-2">
        {profile.affiliations.map((affiliation) => (
          <Link
            key={affiliation.organizationId}
            href={affiliation.href}
            className="focus-visible:ring-ring hover:bg-muted/50 flex min-w-0 items-center gap-3 rounded-2xl border p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <Avatar className="size-11 shrink-0 border">
              <AvatarImage src={affiliation.avatarUrl ?? undefined} alt="" />
              <AvatarFallback className="text-xs">
                {profileInitials(affiliation.name)}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-sm font-medium">
                {affiliation.name}
              </span>
              <span className="text-muted-foreground block truncate text-xs">
                @{affiliation.handle}
              </span>
            </span>
            <Badge variant="outline">
              {PUBLIC_ROLE_LABELS[affiliation.role]}
            </Badge>
          </Link>
        ))}
      </div>
    </section>
  )
}

function PersonActivity({ profile }: { profile: PublicPersonProfileView }) {
  if (profile.activity.length === 0) return null

  return (
    <section aria-labelledby="public-profile-activity" className="space-y-6">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 id="public-profile-activity" className="text-xl font-medium">
            Public activity
          </h2>
          <p className="text-muted-foreground text-sm">
            Verified activity intentionally shared on this profile.
          </p>
        </div>
        <Badge variant="outline" className="tabular-nums">
          {profile.activity.length} public{" "}
          {profile.activity.length === 1 ? "update" : "updates"}
        </Badge>
      </div>

      <div className="overflow-hidden rounded-2xl border p-4 sm:p-5">
        <PublicProfileActivityHeatmap data={profile.heatmap} />
      </div>

      <ol className="space-y-3">
        {profile.activity.map((event) => (
          <li key={event.id}>
            <WorkspaceActivityCard
              title={event.title}
              description={event.summary}
              statusLabel={formatPublicTimestamp(event.occurredAt)}
              status="completed"
              metadata={[event.relatedLabel]}
              href={event.relatedHref}
              actionLabel="Open"
            />
          </li>
        ))}
      </ol>
    </section>
  )
}

function PersonPublicImpact({ profile }: { profile: PublicPersonProfileView }) {
  if (
    profile.affiliations.length === 0 &&
    profile.activity.length === 0 &&
    profile.savedCollections.length === 0
  ) {
    return null
  }

  const metrics = [
    ...(profile.affiliations.length > 0
      ? [
          {
            label:
              profile.affiliations.length === 1
                ? "public organization"
                : "public organizations",
            value: profile.affiliations.length,
          },
        ]
      : []),
    ...(profile.resourcesShared > 0
      ? [
          {
            label:
              profile.resourcesShared === 1
                ? "resource shared"
                : "resources shared",
            value: profile.resourcesShared,
          },
          {
            label:
              profile.resourceOpens === 1
                ? "unique resource open"
                : "unique resource opens",
            value: profile.resourceOpens,
          },
        ]
      : []),
    ...(profile.savedItems > 0
      ? [
          {
            label: profile.savedItems === 1 ? "public save" : "public saves",
            value: profile.savedItems,
          },
        ]
      : []),
    ...(profile.activity.length > 0
      ? [
          {
            label:
              profile.activity.length === 1
                ? "public activity"
                : "public activities",
            value: profile.activity.length,
          },
        ]
      : []),
  ]

  return (
    <>
      <Separator />
      <div className="grid overflow-hidden rounded-2xl border sm:auto-cols-fr sm:grid-flow-col">
        {metrics.map((metric, index) => (
          <div
            key={metric.label}
            className={`flex min-h-24 flex-col items-center justify-center p-5 text-center ${
              index > 0 ? "border-t sm:border-t-0 sm:border-l" : ""
            }`}
          >
            <span className="text-2xl font-medium tabular-nums">
              {metric.value}
            </span>
            <span className="text-muted-foreground text-sm">
              {metric.label}
            </span>
          </div>
        ))}
      </div>
      <PersonAffiliations profile={profile} />
      <PublicProfileSavedCollections profile={profile} />
      <PersonActivity profile={profile} />
    </>
  )
}

export function PublicProfilePage({ profile }: { profile: PublicProfileView }) {
  return (
    <main
      data-public-profile-page
      className="bg-background min-h-svh px-4 py-12 sm:px-6 sm:py-20"
    >
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 sm:gap-14">
        <header className="flex flex-col items-center text-center">
          <Avatar className="bg-muted size-24 border sm:size-28">
            <AvatarImage src={profile.avatarUrl ?? undefined} alt="" />
            <AvatarFallback className="text-xl">
              {profileInitials(profile.displayName)}
            </AvatarFallback>
          </Avatar>
          {profile.kind === "organization" ? (
            <Badge variant="outline" className="mt-5">
              <Building2Icon aria-hidden="true" />
              Organization
            </Badge>
          ) : null}
          <h1 className="mt-4 text-3xl font-medium tracking-tight sm:text-4xl">
            {profile.displayName}
          </h1>
          <p className="text-muted-foreground mt-1">@{profile.handle}</p>
          {profile.headline ? (
            <p className="text-foreground/80 mt-4 max-w-2xl text-base leading-7 text-pretty sm:text-lg">
              {profile.headline}
            </p>
          ) : null}
          {profile.locationLabel ? (
            <p className="text-muted-foreground mt-3 inline-flex items-center gap-1.5 text-sm">
              <MapPinIcon className="size-4" aria-hidden="true" />
              {profile.locationLabel}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {profile.kind === "organization" && profile.donateUrl ? (
              <PublicExternalAction
                href={profile.donateUrl}
                label="Donate"
                variant="default"
              />
            ) : null}
            {profile.websiteUrl ? (
              <PublicExternalAction href={profile.websiteUrl} label="Website" />
            ) : null}
            {profile.kind === "organization" ? (
              <Button asChild variant="outline">
                <a href={profile.findUrl}>View on Find</a>
              </Button>
            ) : null}
          </div>
        </header>

        {profile.description ? (
          <>
            <Separator />
            <section
              aria-labelledby="public-profile-about"
              className="mx-auto w-full max-w-2xl space-y-3 text-center"
            >
              <h2 id="public-profile-about" className="text-xl font-medium">
                About
              </h2>
              <p className="text-muted-foreground leading-7 text-pretty whitespace-pre-line">
                {profile.description}
              </p>
            </section>
          </>
        ) : null}

        {profile.kind === "organization" &&
        ((profile.people?.length ?? 0) > 0 || profile.programs.length > 0) ? (
          <>
            <Separator />
            <OrganizationPeople profile={profile} />
            <OrganizationActivity profile={profile} />
          </>
        ) : null}

        {profile.kind === "person" ? (
          <PersonPublicImpact profile={profile} />
        ) : null}
      </div>
    </main>
  )
}
