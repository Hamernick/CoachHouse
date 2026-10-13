import { SIDEBAR_COOKIE_NAME } from "@/components/ui/sidebar/constants"

export const APP_SIDEBAR_DEFAULT_OPEN = true
export const APP_SIDEBAR_STATE_COOKIE = SIDEBAR_COOKIE_NAME

export function parseAppSidebarStateCookie(
  value: string | null | undefined
): boolean | null {
  if (value === "true") return true
  if (value === "false") return false
  return null
}

export function resolveAppSidebarDefaultOpen(
  cookieValue: string | null | undefined
): boolean {
  return parseAppSidebarStateCookie(cookieValue) ?? APP_SIDEBAR_DEFAULT_OPEN
}
