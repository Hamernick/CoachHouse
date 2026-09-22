import type { PlatformAccessLevel, PlatformCapability } from "../types"

const CAPABILITIES_BY_LEVEL: Record<
  PlatformAccessLevel,
  ReadonlySet<PlatformCapability>
> = {
  developer: new Set([
    "workspace",
    "find",
    "organizations",
    "tasks",
    "email",
    "platform",
    "platform-lab",
    "prototypes",
  ]),
  coach: new Set(["workspace", "find", "organizations", "tasks"]),
}

const COACH_RESTRICTED_ROUTE_PREFIXES = [
  "/access-requests",
  "/accelerator",
  "/admin",
  "/academy",
  "/billing",
  "/class",
  "/classes",
  "/coaching",
  "/email",
  "/internal",
  "/my-tasks",
  "/notifications",
  "/organization",
  "/people",
  "/projects",
  "/tasks",
  "/training",
] as const

const COACH_ALLOWED_ROUTE_PREFIXES = [
  "/admin/dashboard",
  "/projects",
  "/tasks",
  "/find",
  "/my-organization",
  "/organizations",
  "/workspace",
] as const

function pathMatchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function isCoachRestrictedPath(pathname: string) {
  if (
    COACH_ALLOWED_ROUTE_PREFIXES.some((prefix) =>
      pathMatchesPrefix(pathname, prefix)
    )
  ) {
    return false
  }

  return COACH_RESTRICTED_ROUTE_PREFIXES.some((prefix) =>
    pathMatchesPrefix(pathname, prefix)
  )
}

export function isPlatformAccessLevel(
  value: unknown
): value is PlatformAccessLevel {
  return value === "developer" || value === "coach"
}

export function hasPlatformCapability(
  accessLevel: PlatformAccessLevel | null | undefined,
  capability: PlatformCapability
) {
  return accessLevel
    ? CAPABILITIES_BY_LEVEL[accessLevel].has(capability)
    : false
}

export function resolveLegacyPlatformAccessLevel(
  profileRole: string | null | undefined
): PlatformAccessLevel | null {
  return profileRole === "admin" ? "developer" : null
}
