import { AppBreadcrumbs } from "@/components/app-shell/breadcrumbs"
export default function DashboardBreadcrumbs() {
  return <AppBreadcrumbs segments={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Dashboard" }]} />
}
