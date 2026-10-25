import type { Metadata } from "next"
import {
  buildEmailOpsDashboardInput,
  EmailOpsPanel,
  sendEmailOpsTestEmailAction,
} from "@/features/email-ops"
import { requireAdmin } from "@/lib/admin/auth"

export const metadata: Metadata = {
  title: "Email Campaigns",
  description: "Review and manage Coach House email campaigns.",
}


export default async function EmailPage() {
  await requireAdmin()

  return (
    <EmailOpsPanel
      input={buildEmailOpsDashboardInput()}
      testSendAction={sendEmailOpsTestEmailAction}
    />
  )
}
