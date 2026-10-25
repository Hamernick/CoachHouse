import { lookup } from "node:dns/promises"
import { request as httpRequest, type IncomingHttpHeaders } from "node:http"
import { request as httpsRequest } from "node:https"
import { isIP, type LookupFunction } from "node:net"

import { resolvePersonSocialHref } from "@/lib/people/social-links"

const LINKEDIN_HTML_MAX_BYTES = 1024 * 1024
const LINKEDIN_IMAGE_MAX_BYTES = 5 * 1024 * 1024
const LINKEDIN_REFRESH_MAX_REDIRECTS = 4
const LINKEDIN_REFRESH_TIMEOUT_MS = 5000

const ALLOWED_IMAGE_CONTENT_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
])

type ResolvedAddress = {
  address: string
  family: 4 | 6
}

type AddressResolver = (hostname: string) => Promise<readonly ResolvedAddress[]>

type PublicResourceResponse = {
  body: AsyncIterable<Uint8Array>
  discard: () => void
  headers: IncomingHttpHeaders
  status: number
  url: URL
}

type PublicResourceRequester = (
  url: URL,
  options: {
    address: ResolvedAddress
    headers: Record<string, string>
    timeoutMs: number
  }
) => Promise<PublicResourceResponse>

export type LinkedInImageRefreshDependencies = {
  htmlMaxBytes?: number
  imageMaxBytes?: number
  request?: PublicResourceRequester
  resolveAddresses?: AddressResolver
}

export type LinkedInProfileImage = {
  bytes: Uint8Array
  contentType: string
}

function parseIpv4Bytes(address: string) {
  const parts = address.split(".")
  if (parts.length !== 4) return null
  const bytes = parts.map((part) => Number(part))
  return bytes.every(
    (byte, index) =>
      Number.isInteger(byte) &&
      byte >= 0 &&
      byte <= 255 &&
      String(byte) === parts[index]
  )
    ? bytes
    : null
}

function parseIpv6Bytes(address: string) {
  const normalized = address.toLowerCase().split("%")[0]
  const doubleColonIndex = normalized.indexOf("::")
  if (
    doubleColonIndex !== -1 &&
    normalized.indexOf("::", doubleColonIndex + 1) !== -1
  ) {
    return null
  }

  const parseSide = (value: string) => {
    if (!value) return []
    const parts = value.split(":")
    const output: number[] = []
    for (const [index, part] of parts.entries()) {
      if (part.includes(".")) {
        if (index !== parts.length - 1) return null
        const ipv4Bytes = parseIpv4Bytes(part)
        if (!ipv4Bytes) return null
        output.push(
          (ipv4Bytes[0] << 8) | ipv4Bytes[1],
          (ipv4Bytes[2] << 8) | ipv4Bytes[3]
        )
        continue
      }
      if (!/^[\da-f]{1,4}$/.test(part)) return null
      output.push(Number.parseInt(part, 16))
    }
    return output
  }

  const left = parseSide(
    doubleColonIndex === -1 ? normalized : normalized.slice(0, doubleColonIndex)
  )
  const right = parseSide(
    doubleColonIndex === -1 ? "" : normalized.slice(doubleColonIndex + 2)
  )
  if (!left || !right) return null
  if (doubleColonIndex === -1 && left.length !== 8) return null
  if (doubleColonIndex !== -1 && left.length + right.length >= 8) return null

  const groups =
    doubleColonIndex === -1
      ? left
      : [
          ...left,
          ...Array.from({ length: 8 - left.length - right.length }, () => 0),
          ...right,
        ]
  if (groups.length !== 8) return null

  return groups.flatMap((group) => [group >> 8, group & 0xff])
}

export function isUnsafeNetworkAddress(address: string) {
  const normalized = address.replace(/^\[|\]$/g, "")
  const family = isIP(normalized)

  if (family === 4) {
    const bytes = parseIpv4Bytes(normalized)
    if (!bytes) return true
    const [a, b] = bytes
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    )
  }

  if (family === 6) {
    const bytes = parseIpv6Bytes(normalized)
    if (!bytes) return true
    const isUnspecified = bytes.every((byte) => byte === 0)
    const isLoopback =
      bytes.slice(0, 15).every((byte) => byte === 0) && bytes[15] === 1
    const isIpv4Mapped =
      bytes.slice(0, 10).every((byte) => byte === 0) &&
      bytes[10] === 0xff &&
      bytes[11] === 0xff
    if (isIpv4Mapped) {
      return isUnsafeNetworkAddress(bytes.slice(12).join("."))
    }
    return (
      isUnspecified ||
      isLoopback ||
      (bytes[0] & 0xfe) === 0xfc ||
      (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) ||
      bytes[0] === 0xff ||
      (bytes[0] === 0x20 &&
        bytes[1] === 0x01 &&
        bytes[2] === 0x0d &&
        bytes[3] === 0xb8)
    )
  }

  return true
}

function assertHttpUrl(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Unsafe URL protocol")
  }
  if (url.username || url.password) throw new Error("URL credentials denied")
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase()
  if (
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    throw new Error("Unsafe URL hostname")
  }
}

function isLinkedInHostname(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/\.$/, "")
  return normalized === "linkedin.com" || normalized.endsWith(".linkedin.com")
}

async function defaultAddressResolver(hostname: string) {
  const addresses = await lookup(hostname, { all: true, verbatim: true })
  return addresses.filter(
    (address): address is ResolvedAddress =>
      address.family === 4 || address.family === 6
  )
}

async function resolvePublicAddress(
  url: URL,
  resolveAddresses: AddressResolver
) {
  assertHttpUrl(url)
  const hostname = url.hostname.replace(/^\[|\]$/g, "")
  const literalFamily = isIP(hostname)
  const addresses: readonly ResolvedAddress[] = literalFamily
    ? [{ address: hostname, family: literalFamily as 4 | 6 }]
    : await resolveAddresses(hostname)
  if (addresses.length === 0) throw new Error("URL hostname did not resolve")
  if (addresses.some(({ address }) => isUnsafeNetworkAddress(address))) {
    throw new Error("Private network destination denied")
  }
  return addresses[0]
}

function defaultPublicResourceRequest(
  url: URL,
  {
    address,
    headers,
    timeoutMs,
  }: {
    address: ResolvedAddress
    headers: Record<string, string>
    timeoutMs: number
  }
) {
  return new Promise<PublicResourceResponse>((resolve, reject) => {
    const pinnedLookup: LookupFunction = (_hostname, options, callback) => {
      if (options.all) callback(null, [address])
      else callback(null, address.address, address.family)
    }
    const makeRequest = url.protocol === "https:" ? httpsRequest : httpRequest
    const request = makeRequest(
      url,
      {
        headers,
        lookup: pinnedLookup,
        method: "GET",
      },
      (response) => {
        resolve({
          body: response,
          discard: () => response.destroy(),
          headers: response.headers,
          status: response.statusCode ?? 0,
          url,
        })
      }
    )
    const deadline = setTimeout(() => request.destroy(new Error("Request timed out")), timeoutMs)
    request.once("close", () => clearTimeout(deadline))
    request.once("error", reject)
    request.end()
  })
}

function readHeader(headers: IncomingHttpHeaders, name: string) {
  const value = headers[name.toLowerCase()]
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null)
}

async function readBoundedBody(
  response: PublicResourceResponse,
  maxBytes: number
) {
  const contentLength = readHeader(response.headers, "content-length")
  if (contentLength) {
    const parsedLength = Number(contentLength)
    if (!Number.isSafeInteger(parsedLength) || parsedLength < 0) {
      response.discard()
      throw new Error("Invalid content length")
    }
    if (parsedLength > maxBytes) {
      response.discard()
      throw new Error("Response exceeded byte limit")
    }
  }

  const chunks: Uint8Array[] = []
  let totalBytes = 0
  for await (const chunk of response.body) {
    const bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk)
    totalBytes += bytes.byteLength
    if (totalBytes > maxBytes) {
      response.discard()
      throw new Error("Response exceeded byte limit")
    }
    chunks.push(bytes)
  }

  const body = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return body
}

async function readPublicResource({
  initialUrl,
  maxBytes,
  request,
  resolveAddresses,
  validateUrl,
}: {
  initialUrl: URL
  maxBytes: number
  request: PublicResourceRequester
  resolveAddresses: AddressResolver
  validateUrl?: (url: URL) => boolean
}) {
  let currentUrl = initialUrl

  for (
    let redirectCount = 0;
    redirectCount <= LINKEDIN_REFRESH_MAX_REDIRECTS;
    redirectCount += 1
  ) {
    assertHttpUrl(currentUrl)
    if (validateUrl && !validateUrl(currentUrl)) {
      throw new Error("Redirect destination denied")
    }
    const address = await resolvePublicAddress(currentUrl, resolveAddresses)
    const response = await request(currentUrl, {
      address,
      headers: {
        accept:
          "text/html,application/xhtml+xml,image/avif,image/webp,image/*,*/*;q=0.8",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0 Safari/537.36",
      },
      timeoutMs: LINKEDIN_REFRESH_TIMEOUT_MS,
    })
    assertHttpUrl(response.url)
    if (validateUrl && !validateUrl(response.url)) {
      response.discard()
      throw new Error("Final destination denied")
    }
    await resolvePublicAddress(response.url, resolveAddresses)

    if (response.status >= 300 && response.status < 400) {
      const location = readHeader(response.headers, "location")
      response.discard()
      if (!location) throw new Error("Redirect location missing")
      if (redirectCount === LINKEDIN_REFRESH_MAX_REDIRECTS) {
        throw new Error("Too many redirects")
      }
      currentUrl = new URL(location, response.url)
      continue
    }
    if (response.status < 200 || response.status >= 300) {
      response.discard()
      throw new Error("Resource request failed")
    }

    return {
      bytes: await readBoundedBody(response, maxBytes),
      contentType:
        readHeader(response.headers, "content-type")
          ?.split(";", 1)[0]
          ?.trim()
          .toLowerCase() ?? "",
    }
  }

  throw new Error("Too many redirects")
}

function extractLinkedInImageUrl(html: string) {
  const metadataPatterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["'][^>]*>/i,
  ]
  for (const pattern of metadataPatterns) {
    const match = html.match(pattern)
    if (match?.[1]) return match[1].replaceAll("&amp;", "&")
  }
  return null
}

/** Bounded public HTML using the existing DNS-pinned, redirect-checked transport. */
export async function fetchPublicPreviewHtml(href: string, dependencies: LinkedInImageRefreshDependencies = {}) {
  if (href.length > 2048) throw new Error("URL too long")
  const page = await readPublicResource({
    initialUrl: new URL(href), maxBytes: 256 * 1024,
    request: dependencies.request ?? defaultPublicResourceRequest,
    resolveAddresses: dependencies.resolveAddresses ?? defaultAddressResolver,
    validateUrl: url => !url.port && ["http:", "https:"].includes(url.protocol),
  })
  if (!["text/html", "application/xhtml+xml"].includes(page.contentType)) throw new Error("Not an HTML page")
  return new TextDecoder().decode(page.bytes)
}

export async function fetchLinkedInProfileImage(
  linkedin: string,
  dependencies: LinkedInImageRefreshDependencies = {}
): Promise<LinkedInProfileImage> {
  const resolvedHref = resolvePersonSocialHref("linkedin", linkedin)
  if (!resolvedHref) throw new Error("Invalid LinkedIn profile")
  const profileUrl = new URL(resolvedHref)
  profileUrl.protocol = "https:"

  const request = dependencies.request ?? defaultPublicResourceRequest
  const resolveAddresses =
    dependencies.resolveAddresses ?? defaultAddressResolver
  const profile = await readPublicResource({
    initialUrl: profileUrl,
    maxBytes: dependencies.htmlMaxBytes ?? LINKEDIN_HTML_MAX_BYTES,
    request,
    resolveAddresses,
    validateUrl: (url) => isLinkedInHostname(url.hostname),
  })
  if (profile.contentType !== "text/html") {
    throw new Error("LinkedIn response was not HTML")
  }

  const imageHref = extractLinkedInImageUrl(
    new TextDecoder().decode(profile.bytes)
  )
  if (!imageHref) throw new Error("LinkedIn image was not found")
  const imageUrl = new URL(imageHref, profileUrl)
  const image = await readPublicResource({
    initialUrl: imageUrl,
    maxBytes: dependencies.imageMaxBytes ?? LINKEDIN_IMAGE_MAX_BYTES,
    request,
    resolveAddresses,
  })
  if (!ALLOWED_IMAGE_CONTENT_TYPES.has(image.contentType)) {
    throw new Error("LinkedIn image response was not a supported image")
  }
  return image
}
