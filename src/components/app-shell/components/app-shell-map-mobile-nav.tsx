"use client"

import { createPortal } from "react-dom"
import MenuIcon from "lucide-react/dist/esm/icons/menu"
import BellIcon from "lucide-react/dist/esm/icons/bell"
import SearchIcon from "lucide-react/dist/esm/icons/search"
import CircleUserIcon from "lucide-react/dist/esm/icons/circle-user"

import { GlobalSearch } from "@/components/global-search"
import type { GlobalSearchProps } from "@/components/global-search"
import { NavUser, type NavUserProps } from "@/components/nav-user"
import { NotificationsMenu } from "@/components/notifications/notifications-menu"
import { Button } from "@/components/ui/button"
import { useSidebar } from "@/components/ui/sidebar"
import { MobileNavigationPanel, useMobileMapNavigation, type MobileNavigationItem } from "@/features/mobile-navigation"

type MobileNavigationControlProps = Parameters<NonNullable<MobileNavigationItem["render"]>>[0]

export function AppShellMapMobileNav({
  account,
  search,
}: {
  account: NavUserProps
  search: GlobalSearchProps
}) {
  const { openMobile, toggleSidebar } = useSidebar()
  const mapNavigation = useMobileMapNavigation()
  const hasUser = Boolean(account.user.email)
  const items: MobileNavigationItem[] = [
    {
      id: "menu",
      label: "Menu",
      icon: MenuIcon,
      expanded: openMobile,
      active: openMobile,
      onSelect: toggleSidebar,
    },
    {
      id: "notifications",
      label: "Notifications",
      icon: BellIcon,
      ...(hasUser
        ? {
            render: ({ className, labelClassName }: MobileNavigationControlProps) => (
              <NotificationsMenu triggerClassName={className} labelClassName={labelClassName} />
            ),
          }
        : { href: "/login?redirect=%2F" }),
    },
    {
      id: "search",
      label: "Search",
      icon: SearchIcon,
      ...(mapNavigation ? { onSelect: mapNavigation.openSearch } : { render: ({ className, labelClassName }: MobileNavigationControlProps) => (
        <GlobalSearch
          {...search}
          renderTrigger={(onOpen) => (
            <Button variant="ghost" className={className} aria-label="Search" onClick={onOpen}>
              <SearchIcon className="size-5" aria-hidden />
              <span className={labelClassName}>Search</span>
            </Button>
          )}
        />
      ) }),
    },
    {
      id: "profile",
      label: "Profile",
      icon: CircleUserIcon,
      ...(hasUser
        ? {
            render: (mobileTrigger: MobileNavigationControlProps) => <NavUser {...account} mobileTrigger={mobileTrigger} />,
          }
        : { href: "/login?redirect=%2F" }),
    },
  ]

  return mapNavigation?.footer
    ? createPortal(<MobileNavigationPanel items={items} embedded />, mapNavigation.footer)
    : <MobileNavigationPanel items={items} />
}
