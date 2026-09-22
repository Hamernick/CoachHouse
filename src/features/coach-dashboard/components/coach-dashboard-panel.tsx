"use client"
import Link from "next/link"
import { PlatformRevenueStat } from "@/features/member-workspace/client"
import ArrowUpRight from "lucide-react/dist/esm/icons/arrow-up-right"
import Building2 from "lucide-react/dist/esm/icons/building-2"
import Folder from "lucide-react/dist/esm/icons/folder"
import FileText from "lucide-react/dist/esm/icons/file-text"
import CircleCheck from "lucide-react/dist/esm/icons/circle-check"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ActivityContributions } from "@/components/github-contributions"
import type { CoachDashboardInput } from "../types"
import { buildActivityDays } from "../lib"
import { useCoachDashboardController } from "../hooks/use-coach-dashboard-controller"
import { CoachDashboardTools } from "./coach-dashboard-tools"

function dueDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(`${value.slice(0, 10)}T12:00:00`))
}
function SectionTitle({
  title,
  href,
  children,
}: {
  title: string
  href?: string
  children?: React.ReactNode
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold">{title}</h2>
      {href ? (
        <Link
          href={href}
          className="text-muted-foreground hover:text-foreground inline-flex min-h-9 items-center gap-1 text-xs"
        >
          View all
          <ArrowUpRight className="size-3" aria-hidden />
        </Link>
      ) : (
        children
      )}
    </div>
  )
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground py-3 text-sm">{children}</p>
}
export function CoachDashboardPanel({ input }: { input: CoachDashboardInput }) {
  useCoachDashboardController()
  const days = buildActivityDays(
    input.personalActivity,
    new Date(input.loadedAt)
  )
  const initials = input.user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
  const allOrganizations = input.scope === "all"
  const coachFilter = allOrganizations ? "all" : input.user.id
  const scopeLabel = allOrganizations
    ? "All organizations"
    : "Your assigned organizations"
  const orgHref = `/organizations?coach=${coachFilter}`
  const projectsHref = `/projects?coach=${coachFilter}&view=board`
  const stats = [
    {
      label: allOrganizations ? "Organizations" : "Assigned organizations",
      value: input.organizationCount,
      href: orgHref,
    },
    { label: "Open projects", value: input.projectCount, href: projectsHref },
    { label: "Your open tasks", value: input.taskCount, href: "/tasks" },
  ]
  const activityUnavailable = input.issues.some((issue) =>
    issue.startsWith("Activity")
  )
  return (
    <div
      className="mx-auto w-full max-w-6xl space-y-7 px-1 py-3 sm:px-4 sm:py-5"
      data-testid="coach-dashboard"
    >
      <header className="flex flex-col items-center text-center">
        <Avatar className="ring-border/60 mb-3 size-16 ring-1 sm:size-20">
          <AvatarImage src={input.user.avatarUrl ?? undefined} alt="" />
          <AvatarFallback className="text-xl">{initials}</AvatarFallback>
        </Avatar>
        <h1 className="text-2xl font-semibold tracking-tight">
          {input.user.name}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {input.user.role}
          {input.user.email && (
            <span className="hidden sm:inline"> · {input.user.email}</span>
          )}
        </p>
        {input.user.role === "Platform admin" && (
          <Link
            href={
              allOrganizations
                ? "/admin/dashboard"
                : "/admin/dashboard?scope=all"
            }
            className="text-muted-foreground hover:text-foreground mt-2 inline-flex min-h-9 items-center gap-1 text-xs"
          >
            {allOrganizations
              ? "Show assigned organizations"
              : "Show all organizations"}
            <ArrowUpRight className="size-3" aria-hidden />
          </Link>
        )}
      </header>
      <nav
        aria-label="Work and revenue"
        className="border-border/60 grid grid-cols-6 overflow-hidden rounded-2xl border md:grid-cols-5"
      >
        {stats.map((stat) => (
          <Link
            key={stat.href}
            href={stat.href}
            className="border-border/60 hover:bg-muted/50 focus-visible:ring-ring col-span-2 flex min-w-0 flex-col items-center justify-center gap-1 border-r px-2 py-4 text-center focus-visible:ring-2 focus-visible:ring-inset md:col-span-1 [&:nth-child(3)]:border-r-0 md:[&:nth-child(3)]:border-r"
          >
            <span className="text-2xl font-medium tabular-nums">
              {stat.value === null ? "—" : stat.value.toLocaleString()}
            </span>
            <span className="text-muted-foreground text-xs sm:text-sm">
              {stat.label}
            </span>
          </Link>
        ))}
        <div className="border-border/60 col-span-6 flex min-w-0 items-center justify-between gap-2 border-t px-3 py-2 sm:col-span-3 sm:flex-col sm:justify-center sm:gap-1 sm:border-r sm:px-1 sm:py-3 md:col-span-1 md:border-t-0">
          <PlatformRevenueStat kind="coaching" />
          <span className="text-muted-foreground order-first text-xs sm:order-last sm:text-sm">
            Coaching revenue
          </span>
        </div>
        <div className="border-border/60 col-span-6 flex min-w-0 items-center justify-between gap-2 border-t px-3 py-2 sm:col-span-3 sm:flex-col sm:justify-center sm:gap-1 sm:px-1 sm:py-3 md:col-span-1 md:border-t-0">
          <PlatformRevenueStat />
          <span className="text-muted-foreground order-first text-xs sm:order-last sm:text-sm">
            Platform revenue
          </span>
        </div>
      </nav>
      {input.issues.length > 0 && (
        <p role="status" className="text-muted-foreground text-xs">
          {input.issues.join(" ")}
        </p>
      )}
      <section aria-label="Your recorded activity">
        <SectionTitle title="Your activity">
          <span className="text-muted-foreground text-xs">Past year</span>
        </SectionTitle>
        {activityUnavailable ? (
          <Empty>Activity history is unavailable.</Empty>
        ) : (
          <ActivityContributions
            data={days
              .filter((day) => !day.future)
              .map((day) => ({
                date: day.date,
                count: day.count,
                level:
                  day.count === 0
                    ? 0
                    : day.count < 3
                      ? 1
                      : day.count < 7
                        ? 2
                        : day.count < 12
                          ? 3
                          : 4,
              }))}
            caption={`${scopeLabel} · UTC${input.activityTruncated ? ` · latest ${input.personalActivity.length.toLocaleString()} events` : ""}`}
          />
        )}
      </section>
      <div className="grid min-w-0 gap-7 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-10">
        <div className="min-w-0 space-y-7">
          <section>
            <SectionTitle title="Recent activity" />
            {input.activity.length ? (
              <ul className="space-y-1">
                {input.activity.map((event) => {
                  const Icon =
                    event.kind === "task"
                      ? CircleCheck
                      : event.kind === "project"
                        ? Folder
                        : FileText
                  return (
                    <li key={event.id}>
                      <Link
                        href={event.href}
                        className="hover:bg-muted/50 group focus-visible:outline-ring flex min-w-0 items-center gap-3 rounded-lg py-3 focus-visible:outline-2"
                      >
                        <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
                          <Icon className="size-4" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm leading-5">
                            <span>{event.title}</span>
                            <span className="text-muted-foreground hidden sm:inline">
                              {" "}
                              — {event.organization}
                            </span>
                          </p>
                          <p className="text-muted-foreground mt-0.5 truncate text-xs sm:hidden">
                            {event.organization}
                          </p>
                        </div>
                        <time
                          dateTime={event.occurredAt}
                          title={new Date(event.occurredAt).toLocaleString()}
                          className="text-muted-foreground shrink-0 text-[11px] tabular-nums"
                        >
                          {new Intl.DateTimeFormat(undefined, {
                            month: "short",
                            day: "numeric",
                          }).format(new Date(event.occurredAt))}
                        </time>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <Empty>
                {activityUnavailable
                  ? "Could not load recent activity."
                  : `Changes from ${allOrganizations ? "all organizations" : "your assigned organizations"} will appear here.`}
              </Empty>
            )}
          </section>
          <section>
            <SectionTitle title="Tools">
              <Link
                className="text-muted-foreground hover:text-foreground min-h-9 content-center text-xs"
                href="/workspace?drawer=tools"
              >
                Manage tools
              </Link>
            </SectionTitle>
            <CoachDashboardTools />
          </section>
        </div>
        <aside className="min-w-0 space-y-5">
          <section>
            <SectionTitle title="Projects" href={projectsHref} />
            {input.projects.length ? (
              <ul className="space-y-1">
                {input.projects.map((project) => (
                  <li key={project.id}>
                    <Link
                      href={`/projects/${project.id}`}
                      className="hover:bg-muted/50 flex min-w-0 items-center gap-3 rounded-lg py-2.5"
                    >
                      <Folder
                        className="text-muted-foreground size-4 shrink-0"
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{project.name}</p>
                        <p className="text-muted-foreground truncate text-xs">
                          {project.organization}
                        </p>
                      </div>
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {dueDate(project.dueDate)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>
                {input.projectCount === null
                  ? "Projects are unavailable."
                  : `No open projects in ${allOrganizations ? "the organization directory" : "your assigned organizations"}.`}
              </Empty>
            )}
          </section>
          <section className="border-border/60 border-t pt-4">
            <SectionTitle title="Tasks" href="/tasks" />
            {input.tasks.length ? (
              <ul className="space-y-1">
                {input.tasks.map((task) => (
                  <li key={task.id}>
                    <Link
                      href={`/projects/${task.projectId}`}
                      className="hover:bg-muted/50 flex min-w-0 items-center gap-3 rounded-lg py-2.5"
                    >
                      <span
                        className="border-border size-3.5 shrink-0 rounded-full border"
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">{task.name}</p>
                        <p className="text-muted-foreground truncate text-xs">
                          {task.organization}
                        </p>
                      </div>
                      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                        {dueDate(task.dueDate)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>
                {input.taskCount === null
                  ? "Tasks are unavailable."
                  : "You’re caught up."}
              </Empty>
            )}
          </section>
          <section className="border-border/60 border-t pt-4">
            <SectionTitle title="Organizations" href={orgHref} />
            {input.organizations.length ? (
              <ul>
                {input.organizations.slice(0, 5).map((org) => (
                  <li key={org.id}>
                    <Link
                      href={org.href}
                      className="hover:bg-muted/50 flex min-h-11 items-center gap-3 rounded-lg py-2"
                    >
                      <Building2
                        className="text-muted-foreground size-4 shrink-0"
                        aria-hidden
                      />
                      <span className="min-w-0 truncate text-sm">
                        {org.name}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>
                {input.organizationCount === null
                  ? "Organizations are unavailable."
                  : allOrganizations
                    ? "No organizations found."
                    : "No organizations assigned yet."}
              </Empty>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
