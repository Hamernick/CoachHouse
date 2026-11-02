import { NextResponse } from "next/server"

import { fetchHomeMapPreviewFeatures } from "@/lib/queries/home-map-preview"

export const runtime = "nodejs"

export async function GET() {
  try {
    const features = await fetchHomeMapPreviewFeatures()
    return NextResponse.json(
      { features },
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    )
  } catch {
    return NextResponse.json(
      { features: [] },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    )
  }
}
