import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

import { env } from "@/lib/env"
import { DEFAULT_POST_AUTH_REDIRECT } from "@/lib/auth/redirects"
import { isCoachRestrictedPath } from "@/features/platform-access"
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
const AUTH_ROUTES = new Set(["/login", "/sign-up", "/forgot-password"])

export async function proxy(request: NextRequest) {
  const response = NextResponse.next()
  const pathname = request.nextUrl.pathname
  // Public documentation has no account-specific content; mutations still verify auth.
  if ((request.method === "GET" || request.method === "HEAD") &&
      (pathname === "/documentation" || pathname.startsWith("/documentation/"))) {
    return response
  }
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
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
    const redirectResponse = NextResponse.redirect(
      new URL(DEFAULT_POST_AUTH_REDIRECT, request.url)
    )
    copyCookies(response, redirectResponse)
    return redirectResponse
  }

  if (user && isCoachRestricted) {
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
