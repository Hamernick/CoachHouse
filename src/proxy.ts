import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

import { env } from "@/lib/env"
import { DEFAULT_POST_AUTH_REDIRECT, getSafePostLoginRedirectPath } from "@/lib/auth/redirects"
import { getOrganizationInviteRedirect } from "@/lib/auth/organization-invite"
import { hasCoachCoachingAccess, isCoachRestrictedPath } from "@/features/platform-access"
import type { Database } from "@/lib/supabase/types"

const PROTECTED_PREFIXES = [
  "/class",
  "/academy",
  "/classes",
  "/organizations",
  "/workspace",
  "/projects",
  "/tasks",
  "/my-tasks",
  "/notifications",
  "/people",
  "/access-requests",
  "/billing",
  "/admin",
  "/internal",
  "/onboarding",
]
// Password recovery and retry must remain accessible with an existing session.
const AUTH_ROUTES = new Set(["/login", "/sign-up"])

export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-coach-house-request-method", request.method)
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  const pathname = request.nextUrl.pathname
  // OAuth bearer requests authenticate at the MCP boundary. Browser cookies must
  // never select the user or support organization for a connected tool request.
  if (process.env.COMPANION_LIVE_ENABLED === "1" &&
    (pathname === "/api/companion/mcp" || pathname.startsWith("/api/companion/oauth/"))) return response
  // This explicitly enabled local pilot has its own signed sandbox sessions.
  // Never consult or mutate real Coach House account state for fictional data.
  if (process.env.COMPANION_SANDBOX_ENABLED === "1" &&
    (pathname === "/companion" || pathname.startsWith("/api/companion/"))) return response
  // These same-origin JSON handlers authenticate, refresh cookies and authorize
  // their explicit organization themselves. Avoid a second Auth request per poll.
  if (request.method === "POST" && [
    "/api/account/workspace-support-presence",
    "/api/account/document-presence",
    "/api/account/document-collaboration",
  ].includes(pathname)) return response
  // Public documentation has no account-specific content; mutations still verify auth.
  if ((request.method === "GET" || request.method === "HEAD") &&
      (pathname === "/documentation" || pathname.startsWith("/documentation/"))) {
    return response
  }
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
  const isAuthRoute = AUTH_ROUTES.has(pathname)
  const isCoachRestricted = isCoachRestrictedPath(pathname)

  // With no cookies there is no browser session to refresh. Limit the fast
  // path to public page reads; guarded routes, APIs and mutations stay verified.
  if (
    (request.method === "GET" || request.method === "HEAD") &&
    !pathname.startsWith("/api/") &&
    !isProtected &&
    !isAuthRoute &&
    !isCoachRestricted &&
    request.cookies.getAll().length === 0
  ) {
    return response
  }

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value
        },
        set(name, value, options) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name, options) {
          response.cookies.set({ name, value: "", ...options, maxAge: 0 })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && isProtected) {
    const redirectUrl = new URL("/login", request.url)
    redirectUrl.searchParams.set("redirect", pathname + request.nextUrl.search)
    const redirectResponse = NextResponse.redirect(redirectUrl)
    copyCookies(response, redirectResponse)
    return redirectResponse
  }

  if (user && isAuthRoute) {
    const requestedRedirect = request.nextUrl.searchParams.get("redirect")
    const destination = getOrganizationInviteRedirect(requestedRedirect)
      ?? (pathname === "/login" ? getSafePostLoginRedirectPath(requestedRedirect) : undefined)
      ?? DEFAULT_POST_AUTH_REDIRECT
    const redirectResponse = NextResponse.redirect(new URL(destination, request.url))
    copyCookies(response, redirectResponse)
    return redirectResponse
  }

  if (
    user &&
    isCoachRestricted &&
    isCoachRestrictedPath(pathname, hasCoachCoachingAccess(user.app_metadata))
  ) {
    const { data: platformStaff } = await supabase
      .from("platform_staff_members")
      .select("access_level")
      .eq("user_id", user.id)
      .maybeSingle<{ access_level: "developer" | "coach" }>()

    if (platformStaff?.access_level === "coach") {
      const redirectResponse = NextResponse.redirect(
        new URL("/organizations", request.url)
      )
      copyCookies(response, redirectResponse)
      return redirectResponse
    }
  }

  // Onboarding is now an in-app overlay; do not redirect to /onboarding here.

  return response
}

function copyCookies(source: NextResponse, destination: NextResponse) {
  source.cookies.getAll().forEach((cookie) => {
    destination.cookies.set(cookie)
  })
}

export const config = {
  // This machine-only route verifies its own bearer secret. It does not need
  // browser session refresh; keep all other page/API session behavior intact.
  matcher: ["/((?!_next|.*\\..*|api/auth|api/internal/cron/coaching-calendar/?$).*)"],
}
