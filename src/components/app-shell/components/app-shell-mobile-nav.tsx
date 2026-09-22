import { usePathname } from "next/navigation"
import CompassIcon from "lucide-react/dist/esm/icons/compass"
import LayoutDashboardIcon from "lucide-react/dist/esm/icons/layout-dashboard"
import PanelRightIcon from "lucide-react/dist/esm/icons/panel-right"

import { useSidebar } from "@/components/ui/sidebar"
import {
  MobileNavigationPanel,
  isMobileNavigationPathActive,
  type MobileNavigationItem,
} from "@/features/mobile-navigation"
import { RIGHT_RAIL_ID } from "../constants"
import { useRightRailPresence } from "../right-rail"

type AppShellMobileNavProps = {
  rightOpen: boolean
  onRightOpenChange: (open: boolean) => void
  showWorkspace?: boolean
  onboardingLocked?: boolean
}

export function AppShellMobileNav({
  rightOpen,
  onRightOpenChange,
  showWorkspace = false,
  onboardingLocked = false,
}: AppShellMobileNavProps) {
  const pathname = usePathname() ?? "/"
  const hasRightRail = useRightRailPresence()
  const { isMobile, openMobile } = useSidebar()
  if (!isMobile) return null

  const items: MobileNavigationItem[] = []
  if (!onboardingLocked) {
    items.push({ id: "find", label: "Find", href: "/", icon: CompassIcon })
    if (showWorkspace)
      items.push({
        id: "workspace",
        label: "Workspace",
        href: "/workspace",
        icon: LayoutDashboardIcon,
      })
  }
  for (const item of items)
    item.active =
      !openMobile &&
      !rightOpen &&
      isMobileNavigationPathActive(pathname, item.href!)
  if (hasRightRail)
    items.push({
      id: "details",
      label: "Details",
      icon: PanelRightIcon,
      active: rightOpen,
      expanded: rightOpen,
      controls: RIGHT_RAIL_ID,
      onSelect: () => onRightOpenChange(!rightOpen),
    })
  return items.length > 0 ? <MobileNavigationPanel items={items} /> : null
}
