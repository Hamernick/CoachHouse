import { createHmac, createSign, randomUUID } from "node:crypto"
import { headers } from "next/headers"

import { env } from "@/lib/env"
import type { CoachingCoachId } from "../types"

type GoogleTokenCache = {
  accessToken: string
  expiresAt: number
}

type GoogleEventResponse = {
  status?: string
  id?: string
  htmlLink?: string
  hangoutLink?: string
  conferenceData?: {
    createRequest?: {
      status?: {
        statusCode?: string
      }
    }
    entryPoints?: Array<{
      entryPointType?: string
      uri?: string
    }>
  }
}

type BrokerEventResponse = {
  googleEventId: string | null
  googleEventHtmlLink: string | null
  googleMeetUrl: string | null
}

const tokenCache = new Map<string, GoogleTokenCache>()
let brokerIdentityTokenCache: GoogleTokenCache | null = null
const DEFAULT_COACHING_PARTICIPANT_EMAILS: Record<CoachingCoachId, string> = {
  joel: "joel@coachhousesolutions.org",
  paula: "paula@coachhousesolutions.org",
}

function base64Url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url")
}

function normalizePrivateKey(value: string) {
  return value.replace(/\\n/g, "\n")
}

export function getCoachCalendarId(coachId: CoachingCoachId) {
  return coachId === "paula" ? env.GOOGLE_COACHING_PAULA_CALENDAR_ID : env.GOOGLE_COACHING_JOEL_CALENDAR_ID
}

function getImpersonatedUser(coachId?: CoachingCoachId) {
  if (coachId === "joel" && env.GOOGLE_COACHING_JOEL_IMPERSONATED_USER) {
    return env.GOOGLE_COACHING_JOEL_IMPERSONATED_USER
  }
  if (coachId === "paula" && env.GOOGLE_COACHING_PAULA_IMPERSONATED_USER) {
    return env.GOOGLE_COACHING_PAULA_IMPERSONATED_USER
  }
  return env.GOOGLE_COACHING_IMPERSONATED_USER ?? null
}

export function getGoogleCoachingParticipantEmail(coachId: CoachingCoachId) {
  return (
    getImpersonatedUser(coachId) ?? DEFAULT_COACHING_PARTICIPANT_EMAILS[coachId] ?? getCoachCalendarId(coachId) ?? null
  )
}

function normalizeInternalAttendeeEmails(emails: string[] = []) {
  return Array.from(new Set(emails.map((email) => email.trim()).filter((email) => email.length > 0)))
}

function buildGoogleEventAttendees({
  attendeeEmail,
  internalAttendeeEmails,
}: {
  attendeeEmail: string | null
  internalAttendeeEmails: string[]
}) {
  return normalizeInternalAttendeeEmails([attendeeEmail ?? "", ...internalAttendeeEmails]).map((email) => ({ email }))
}

export function isBrokerConfigured() {
  return Boolean(env.GOOGLE_COACHING_BROKER_URL && env.GOOGLE_COACHING_BROKER_SECRET)
}

function isBrokerWorkloadIdentityConfigured() {
  return Boolean(
    env.GOOGLE_COACHING_GCP_PROJECT_NUMBER &&
    env.GOOGLE_COACHING_WORKLOAD_IDENTITY_POOL_ID &&
    env.GOOGLE_COACHING_WORKLOAD_IDENTITY_PROVIDER_ID &&
    env.GOOGLE_COACHING_INVOKER_SERVICE_ACCOUNT_EMAIL
  )
}

function isDirectGoogleConfigured(coachId?: CoachingCoachId) {
  const hasCredentials = Boolean(env.GOOGLE_COACHING_CLIENT_EMAIL && env.GOOGLE_COACHING_PRIVATE_KEY)
  if (!coachId) {
    return hasCredentials && Boolean(env.GOOGLE_COACHING_JOEL_CALENDAR_ID && env.GOOGLE_COACHING_PAULA_CALENDAR_ID)
  }
  return hasCredentials && Boolean(getCoachCalendarId(coachId))
}

export function isGoogleCoachingConfigured(coachId?: CoachingCoachId) {
  return isBrokerConfigured() || isDirectGoogleConfigured(coachId)
}

async function getAccessToken(coachId?: CoachingCoachId) {
  const nowSeconds = Math.floor(Date.now() / 1000)
  const impersonatedUser = getImpersonatedUser(coachId)
  const cacheKey = impersonatedUser ? `subject:${impersonatedUser}` : "service-account"
  const cached = tokenCache.get(cacheKey)
  if (cached && cached.expiresAt - 60 > nowSeconds) {
    return cached.accessToken
  }

  if (!env.GOOGLE_COACHING_CLIENT_EMAIL || !env.GOOGLE_COACHING_PRIVATE_KEY) {
    throw new Error("Google coaching calendar credentials are not configured.")
  }

  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const claims: Record<string, string | number> = {
    iss: env.GOOGLE_COACHING_CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/calendar",
    aud: "https://oauth2.googleapis.com/token",
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  }
  if (impersonatedUser) {
    claims.sub = impersonatedUser
  }

  const body = base64Url(JSON.stringify(claims))
  const unsignedJwt = `${header}.${body}`
  const signature = createSign("RSA-SHA256")
    .update(unsignedJwt)
    .sign(normalizePrivateKey(env.GOOGLE_COACHING_PRIVATE_KEY))
  const assertion = `${unsignedJwt}.${base64Url(signature)}`

  const response = await fetch("https://oauth2.googleapis.com/token", {
    signal: AbortSignal.timeout(5000),
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  })

  if (!response.ok) {
    throw new Error(`Unable to authenticate Google Calendar (${response.status}).`)
  }

  const payload = (await response.json()) as {
    access_token?: string
    expires_in?: number
  }
  if (!payload.access_token) {
    throw new Error("Google Calendar token response did not include an access token.")
  }

  tokenCache.set(cacheKey, {
    accessToken: payload.access_token,
    expiresAt: nowSeconds + (payload.expires_in ?? 3600),
  })
  return payload.access_token
}

export async function requestGoogleCalendarDirect<T>({
  coachId,
  path,
  method = "GET",
  body,
  requestHeaders,
}: {
  coachId?: CoachingCoachId
  path: string
  method?: "GET" | "POST" | "PATCH" | "DELETE"
  body?: unknown
  requestHeaders?: Record<string, string>
}) {
  const token = await getAccessToken(coachId)
  const response = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    signal: AbortSignal.timeout(8000),
    method,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...requestHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    throw Object.assign(new Error(`Google Calendar request failed (${response.status}).`), { status: response.status })
  }

  if (response.status === 204) {
    return null as T
  }

  return (await response.json()) as T
}

function normalizeBrokerUrl() {
  return env.GOOGLE_COACHING_BROKER_URL?.replace(/\/+$/, "")
}

function isLocalBrokerUrl(value: string) {
  try {
    const url = new URL(value)
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1"
  } catch {
    return false
  }
}

function brokerFetchErrorMessage(brokerUrl: string) {
  if (isLocalBrokerUrl(brokerUrl)) {
    return "Local Google Calendar broker proxy is not running."
  }
  return "Google Calendar broker is unreachable."
}

function readJwtExpiresAtSeconds(token: string) {
  const [, payload] = token.split(".")
  if (!payload) return null
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      exp?: unknown
    }
    return typeof decoded.exp === "number" ? decoded.exp : null
  } catch {
    return null
  }
}

async function getVercelOidcToken() {
  if (process.env.VERCEL_OIDC_TOKEN) return process.env.VERCEL_OIDC_TOKEN

  try {
    const requestHeaders = await headers()
    return requestHeaders.get("x-vercel-oidc-token")
  } catch {
    return null
  }
}

async function getBrokerIdentityToken() {
  const nowSeconds = Math.floor(Date.now() / 1000)
  if (brokerIdentityTokenCache && brokerIdentityTokenCache.expiresAt - 60 > nowSeconds) {
    return brokerIdentityTokenCache.accessToken
  }

  const subjectToken = await getVercelOidcToken()
  if (!subjectToken) {
    throw new Error("Vercel OIDC token is not available for the Google Calendar broker.")
  }

  const audience =
    `//iam.googleapis.com/projects/${env.GOOGLE_COACHING_GCP_PROJECT_NUMBER}` +
    `/locations/global/workloadIdentityPools/${env.GOOGLE_COACHING_WORKLOAD_IDENTITY_POOL_ID}` +
    `/providers/${env.GOOGLE_COACHING_WORKLOAD_IDENTITY_PROVIDER_ID}`
  const stsResponse = await fetch("https://sts.googleapis.com/v1/token", {
    signal: AbortSignal.timeout(5000),
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      audience,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
      subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
      subject_token: subjectToken,
    }),
  })

  if (!stsResponse.ok) {
    throw new Error(`Unable to exchange Vercel OIDC token with Google STS (${stsResponse.status}).`)
  }
  const stsToken = (await stsResponse.json()) as { access_token?: string }
  if (!stsToken.access_token) {
    throw new Error("Google STS response did not include an access token.")
  }

  const brokerUrl = normalizeBrokerUrl()
  if (!brokerUrl || !env.GOOGLE_COACHING_INVOKER_SERVICE_ACCOUNT_EMAIL) {
    throw new Error("Google Calendar broker identity configuration is incomplete.")
  }

  const identityResponse = await fetch(
    `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(env.GOOGLE_COACHING_INVOKER_SERVICE_ACCOUNT_EMAIL)}:generateIdToken`,
    {
      signal: AbortSignal.timeout(5000),
      method: "POST",
      headers: {
        authorization: `Bearer ${stsToken.access_token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        audience: brokerUrl,
        includeEmail: true,
      }),
    }
  )

  if (!identityResponse.ok) {
    throw new Error(`Unable to mint Google identity token for broker (${identityResponse.status}).`)
  }
  const identity = (await identityResponse.json()) as { token?: string }
  if (!identity.token) {
    throw new Error("Google identity token response did not include a token.")
  }

  brokerIdentityTokenCache = {
    accessToken: identity.token,
    expiresAt: readJwtExpiresAtSeconds(identity.token) ?? nowSeconds + 2700,
  }
  return brokerIdentityTokenCache.accessToken
}

export async function requestGoogleCalendarBroker<T>({ operation, payload }: { operation: string; payload: unknown }) {
  if (!env.GOOGLE_COACHING_BROKER_URL || !env.GOOGLE_COACHING_BROKER_SECRET) {
    throw new Error("Google coaching calendar broker is not configured.")
  }

  const brokerUrl = normalizeBrokerUrl()
  if (!brokerUrl) {
    throw new Error("Google coaching calendar broker URL is not configured.")
  }

  const timestamp = String(Date.now())
  const body = JSON.stringify({ operation, payload })
  const signature = createHmac("sha256", env.GOOGLE_COACHING_BROKER_SECRET).update(`${timestamp}.${body}`).digest("hex")
  const identityToken =
    isBrokerWorkloadIdentityConfigured() && !isLocalBrokerUrl(brokerUrl) ? await getBrokerIdentityToken() : null
  let response: Response
  try {
    response = await fetch(brokerUrl, {
      signal: AbortSignal.timeout(15000),
      method: "POST",
      headers: {
        ...(identityToken ? { authorization: `Bearer ${identityToken}` } : {}),
        "content-type": "application/json",
        "x-coach-house-timestamp": timestamp,
        "x-coach-house-signature": signature,
      },
      body,
    })
  } catch {
    throw new Error(brokerFetchErrorMessage(brokerUrl))
  }

  if (!response.ok) {
    throw Object.assign(new Error(`Google Calendar broker request failed (${response.status}).`), { status: response.status })
  }

  return (await response.json()) as T
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function extractMeetUrl(event: GoogleEventResponse) {
  return (
    event.hangoutLink ??
    event.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video")?.uri ??
    null
  )
}

function conferenceStatus(event: GoogleEventResponse) {
  return event.conferenceData?.createRequest?.status?.statusCode ?? null
}

async function waitForMeetUrl({
  coachId,
  calendarId,
  event,
}: {
  coachId: CoachingCoachId
  calendarId: string
  event: GoogleEventResponse
}) {
  let currentEvent = event
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const meetUrl = extractMeetUrl(currentEvent)
    if (meetUrl) return { event: currentEvent, meetUrl }

    const status = conferenceStatus(currentEvent)
    if (status === "failure") {
      throw new Error("Google Calendar could not create the Meet link.")
    }
    if (!currentEvent.id) return { event: currentEvent, meetUrl: null }

    await sleep(350 * (attempt + 1))
    currentEvent = await requestGoogleCalendarDirect<GoogleEventResponse>({
      coachId,
      path: `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(currentEvent.id)}?conferenceDataVersion=1`,
    })
  }

  return { event: currentEvent, meetUrl: extractMeetUrl(currentEvent) }
}

export { listGoogleBusyWindows } from "./calendar-conflicts"

export async function createGoogleCoachingEvent({
  coachId,
  summary,
  description,
  startsAt,
  endsAt,
  timezone,
  attendeeEmail,
  internalAttendeeEmails = [],
  eventId,
}: {
  coachId: CoachingCoachId
  summary: string
  description: string
  startsAt: string
  endsAt: string
  timezone: string
  attendeeEmail: string | null
  internalAttendeeEmails?: string[]
  eventId?: string
}) {
  const internalAttendees = normalizeInternalAttendeeEmails(internalAttendeeEmails)
  const attendees = buildGoogleEventAttendees({ attendeeEmail, internalAttendeeEmails: internalAttendees })
  if (isBrokerConfigured()) {
    return await requestGoogleCalendarBroker<BrokerEventResponse>({
      operation: "createEvent",
      payload: {
        coachId,
        summary,
        description,
        startsAt,
        endsAt,
        timezone,
        attendeeEmail,
        internalAttendeeEmails: internalAttendees,
        eventId,
      },
    })
  }

  const calendarId = getCoachCalendarId(coachId)
  if (!calendarId) {
    throw new Error("Coach calendar is not configured.")
  }

  const event = await requestGoogleCalendarDirect<GoogleEventResponse>({
    coachId,
    path: `/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`,
    method: "POST",
    body: {
      ...(eventId ? { id: eventId } : {}),
      summary,
      description: attendeeEmail
        ? `${description}\n\nAttendee: ${attendeeEmail}\nUse this Google Calendar invite for updates or rescheduling.`
        : `${description}\n\nUse this Google Calendar invite for updates or rescheduling.`,
      ...(attendees.length > 0
        ? {
            attendees,
          }
        : {}),
      start: { dateTime: startsAt, timeZone: timezone },
      end: { dateTime: endsAt, timeZone: timezone },
      conferenceData: {
        createRequest: {
          requestId: randomUUID(),
          ...(getImpersonatedUser(coachId)
            ? {
                conferenceSolutionKey: {
                  type: "hangoutsMeet",
                },
              }
            : {}),
        },
      },
    },
  }).catch(async (error: unknown) => {
    if (eventId && (error as { status?: number }).status === 409)
      return requestGoogleCalendarDirect<GoogleEventResponse>({
        coachId,
        path: `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      })
    throw error
  })

  if (event.status === "cancelled") throw new Error("Coach canceled the calendar event during confirmation.")
  const conference = await waitForMeetUrl({ coachId, calendarId, event })
  if (getImpersonatedUser(coachId) && !conference.meetUrl) {
    throw new Error("Google Calendar created the event but did not return a Meet link.")
  }

  return {
    googleEventId: conference.event.id ?? null,
    googleEventHtmlLink: conference.event.htmlLink ?? null,
    googleMeetUrl: conference.meetUrl,
  }
}

export async function updateGoogleCoachingEvent({
  coachId,
  googleEventId,
  startsAt,
  endsAt,
  timezone,
}: {
  coachId: CoachingCoachId
  googleEventId: string
  startsAt: string
  endsAt: string
  timezone: string
}) {
  if (isBrokerConfigured()) {
    await requestGoogleCalendarBroker<{ ok: true }>({
      operation: "updateEvent",
      payload: { coachId, googleEventId, startsAt, endsAt, timezone },
    })
    return
  }

  const calendarId = getCoachCalendarId(coachId)
  if (!calendarId) {
    throw new Error("Coach calendar is not configured.")
  }

  await requestGoogleCalendarDirect<GoogleEventResponse>({
    coachId,
    path: `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}?sendUpdates=all`,
    method: "PATCH",
    body: {
      start: { dateTime: startsAt, timeZone: timezone },
      end: { dateTime: endsAt, timeZone: timezone },
    },
  })
}

export async function deleteGoogleCoachingEvent({
  coachId,
  googleEventId,
}: {
  coachId: CoachingCoachId
  googleEventId: string
}) {
  if (isBrokerConfigured()) {
    await requestGoogleCalendarBroker<{ ok: true }>({
      operation: "deleteEvent",
      payload: { coachId, googleEventId },
    })
    return
  }

  const calendarId = getCoachCalendarId(coachId)
  if (!calendarId) return

  await requestGoogleCalendarDirect<null>({
    coachId,
    path: `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}?sendUpdates=all`,
    method: "DELETE",
  })
}
