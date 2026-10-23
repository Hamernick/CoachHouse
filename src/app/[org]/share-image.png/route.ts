import { servePublicProfileShareImage } from "./_lib/public-profile-share-image"

// A normal Node route keeps renderer imports out of inherited Edge metadata.
export const runtime = "nodejs"

export async function GET(_request: Request, { params }: { params: Promise<{ org: string }> }) {
  const { org } = await params
  return servePublicProfileShareImage(org)
}
