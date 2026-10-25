import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { WORKSPACE_ACCELERATOR_PATH } from "@/lib/workspace/routes"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function AcceleratorLayout() {
  redirect(WORKSPACE_ACCELERATOR_PATH)
}
