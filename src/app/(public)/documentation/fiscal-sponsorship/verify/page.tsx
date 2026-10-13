import type { Metadata } from "next"
import { FiscalPublicEmailVerification } from "@/features/fiscal-sponsorship"
export const metadata: Metadata = { title: "Verify your email", robots: { index: false, follow: false }, referrer: "no-referrer" }
export default function FiscalEmailVerificationPage() { return <FiscalPublicEmailVerification profileImportEnabled={process.env.FISCAL_GUEST_PROFILE_IMPORT_ENABLED === "true"} /> }
