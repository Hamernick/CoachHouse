import { readFileSync } from "node:fs"
import { join } from "node:path"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { NotificationsList } from "@/components/notifications/notifications-list"
import type { NotificationItem } from "@/components/notifications/types"

const readSource = (path: string) => readFileSync(join(process.cwd(), path), "utf8")
const item: NotificationItem = { id: "notice", title: "New message", description: "Full notification details", time: "2 minutes ago", unread: true, href: "/workspace", tone: "info" }
const props = { items: [item], loading: false, error: null, updating: false, activeActionId: null, requestUpdating: null, onOpen: vi.fn(), onToggleRead: vi.fn(), onRespond: vi.fn(), onRetry: vi.fn() }

describe("notifications list and mobile drawer", () => {
  it("shares one list across desktop and mobile while preserving drawer scrolling", () => {
    const menu = readSource("src/components/notifications/notifications-menu.tsx")
    const drawer = readSource("src/components/ui/drawer.tsx")
    expect(menu).toContain("const NOTIFICATIONS_MOBILE_SNAP_POINTS = [0.62, 0.92]")
    expect(menu).toContain("activeSnapPoint={mobileSnapPoint}")
    expect(menu).toContain("setActiveSnapPoint={setMobileSnapPoint}")
    expect(menu).toContain("snapToSequentialPoint")
    expect(menu).toContain("handleOnly")
    expect(menu).toContain("h-[92dvh] max-h-[92dvh]")
    expect(menu).toContain("data-[vaul-drawer-direction=bottom]:mt-0")
    expect(menu).toContain("pb-[max(0.75rem,env(safe-area-inset-bottom))]")
    expect(menu).toContain("overscroll-contain touch-pan-y")
    expect(menu.match(/\{notificationsBody\}/g)).toHaveLength(2)
    expect(menu).not.toContain("NotificationPreview")
    expect(menu).not.toContain("mobileDetailItem")
    expect(drawer).toContain('<DrawerHandle className="mt-4" />')
  })

  it("keeps the complete message and read action available without selecting a preview", () => {
    const html = renderToStaticMarkup(createElement(NotificationsList, props))
    expect(html).toContain('<ul aria-label="Notifications"')
    expect(html).toContain(item.description)
    expect(html).toContain(item.time)
    expect(html).toContain('aria-label="Mark as read: New message"')
    expect(html).not.toContain("aria-pressed")
    const read = renderToStaticMarkup(createElement(NotificationsList, { ...props, items: [{ ...item, unread: false }] }))
    expect(read).toContain('aria-label="Mark as unread: New message"')
  })

  it("retains access decisions inline and disables actions during a mutation", () => {
    const html = renderToStaticMarkup(createElement(NotificationsList, { ...props, items: [{ ...item, organizationAccessRequestId: "request" }], updating: true, activeActionId: item.id, requestUpdating: "accepted" }))
    expect(html).toContain("Accept access")
    expect(html).toContain("Decline")
    const buttons = html.match(/<button\b[^>]*>/g) ?? []
    expect(buttons).toHaveLength(4)
    expect(buttons.every(button => button.includes('disabled=""'))).toBe(true)
  })

  it("keeps notifications without destinations readable and supports empty and error states", () => {
    const html = renderToStaticMarkup(createElement(NotificationsList, { ...props, items: [{ ...item, href: null }] }))
    expect(html).toContain(item.description)
    expect(html.match(/<button\b/g)).toHaveLength(1)
    const empty = renderToStaticMarkup(createElement(NotificationsList, { ...props, items: [], emptyLabel: "You’re all caught up." }))
    expect(empty).toContain("You’re all caught up.")
    const error = renderToStaticMarkup(createElement(NotificationsList, { ...props, error: "Offline" }))
    expect(error).toContain('role="alert"')
    expect(error).toContain("Retry")
  })
})
