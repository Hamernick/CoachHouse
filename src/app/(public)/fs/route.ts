import { NextResponse } from "next/server"

import { buildPublicFiscalSponsorshipHref } from "@/features/fiscal-sponsorship/client"

export function GET(request: Request) {
  const url = new URL(request.url)
  return NextResponse.redirect(new URL(buildPublicFiscalSponsorshipHref(url.searchParams), url), 308)
}

export const HEAD = GET
