import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Notifications",
  description: "Review updates, invitations, and activity for your account.",
}


export default async function NotificationsPage() {
  redirect("/workspace")
}
