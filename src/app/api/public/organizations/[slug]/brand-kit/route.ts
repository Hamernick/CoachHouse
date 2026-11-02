import { NextResponse } from "next/server"

import { buildPublicBrandKitDownload } from "@/lib/organization/brand-kit-download"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params
  const result = await buildPublicBrandKitDownload(slug)
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return new NextResponse(result.archive, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${result.fileName}"`,
      "Cache-Control": "no-store",
    },
  })
}
