import type { Metadata } from "next"
import { FiscalGuestRecovery, loadGuestFiscalRecoveryAvailability } from "@/features/fiscal-sponsorship"
export const metadata: Metadata = {
  description: "Recover secure access to your fiscal sponsorship application.", title: "Access your application", robots: { index: false, follow: false }, referrer: "no-referrer" }
export default async function FiscalRecoveryPage({ searchParams }: { searchParams: Promise<{ application?: string }> }) {
  const { application } = await searchParams
  return <FiscalGuestRecovery enabled={await loadGuestFiscalRecoveryAvailability()} initialReference={typeof application === "string" && /^[a-f0-9-]{36}$/i.test(application) ? application : ""} />
}
