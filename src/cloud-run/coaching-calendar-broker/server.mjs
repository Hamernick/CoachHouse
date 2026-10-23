import http from "node:http"
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto"
import { blockingCalendarIds, eventIdentity, listBlockingEventWindows, readCompleteFreeBusy, validateBusyWindows } from "./calendar-availability.mjs"

const PORT = Number(process.env.PORT ?? 8080)
const MAX_BODY_BYTES = 24_000
const SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar"
const METADATA_BASE = "http://metadata.google.internal/computeMetadata/v1"
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token"

let metadataTokenCache = null
const calendarTokenCache = new Map()
let serviceAccountCalendarTokenCache = null
let serviceAccountEmailCache = null

function json(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  })
  res.end(JSON.stringify(payload))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ""
    req.setEncoding("utf8")
    req.on("data", (chunk) => {
      raw += chunk
      if (raw.length > MAX_BODY_BYTES) {
        reject(new Error("Request body is too large."))
        req.destroy()
      }
    })
    req.on("end", () => resolve(raw))
    req.on("error", reject)
  })
}

function safeEqualHex(left, right) {
  if (!left || !right || left.length !== right.length) return false
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"))
}

function verifySignature({ rawBody, headers }) {
  const secret = process.env.COACHING_CALENDAR_BROKER_SECRET
  const timestamp = Array.isArray(headers["x-coach-house-timestamp"])
    ? headers["x-coach-house-timestamp"][0]
    : headers["x-coach-house-timestamp"]
  const signature = Array.isArray(headers["x-coach-house-signature"])
    ? headers["x-coach-house-signature"][0]
    : headers["x-coach-house-signature"]

  if (!secret || !timestamp || !signature) return false
  const issuedAt = Number(timestamp)
  if (!Number.isFinite(issuedAt) || Math.abs(Date.now() - issuedAt) > SIGNATURE_MAX_AGE_MS) {
    return false
  }

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex")
  return safeEqualHex(expected, signature)
}

async function readJson(req) {
  const rawBody = await readBody(req)
  if (!verifySignature({ rawBody, headers: req.headers })) {
    const error = new Error("Invalid broker signature.")
    error.status = 401
    throw error
  }
  return JSON.parse(rawBody)
}

async function metadata(path) {
  const response = await fetch(`${METADATA_BASE}/${path}`, {
    headers: { "Metadata-Flavor": "Google" },
  })
  if (!response.ok) throw new Error(`Metadata request failed (${response.status}).`)
  return response
}

async function getMetadataAccessToken() {
  const now = Date.now()
  if (metadataTokenCache && metadataTokenCache.expiresAt - 60_000 > now) {
    return metadataTokenCache.accessToken
  }

  const response = await metadata("instance/service-accounts/default/token")
  const payload = await response.json()
  if (!payload.access_token) throw new Error("Metadata token response did not include an access token.")
  metadataTokenCache = {
    accessToken: payload.access_token,
    expiresAt: now + Number(payload.expires_in ?? 3000) * 1000,
  }
  return metadataTokenCache.accessToken
}

async function getServiceAccountEmail() {
  if (process.env.GOOGLE_COACHING_SERVICE_ACCOUNT_EMAIL) {
    return process.env.GOOGLE_COACHING_SERVICE_ACCOUNT_EMAIL
  }
  if (serviceAccountEmailCache) return serviceAccountEmailCache
  const response = await metadata("instance/service-accounts/default/email")
  serviceAccountEmailCache = (await response.text()).trim()
  return serviceAccountEmailCache
}

async function getServiceAccountCalendarAccessToken() {
  const now = Date.now()
  if (serviceAccountCalendarTokenCache && serviceAccountCalendarTokenCache.expiresAt - 60_000 > now) {
    return serviceAccountCalendarTokenCache
  }

  const metadataToken = await getMetadataAccessToken()
  const serviceAccountEmail = await getServiceAccountEmail()
  const response = await fetch(
    `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(serviceAccountEmail)}:generateAccessToken`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${metadataToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        scope: [CALENDAR_SCOPE],
        lifetime: "3600s",
      }),
    },
  )
  if (!response.ok) throw new Error(`Unable to mint Calendar access token (${response.status}).`)

  const payload = await response.json()
  if (!payload.accessToken || !payload.expireTime) {
    throw new Error("IAM Credentials response did not include a Calendar access token.")
  }
  serviceAccountCalendarTokenCache = {
    accessToken: payload.accessToken,
    expiresAt: Date.parse(payload.expireTime),
  }
  return serviceAccountCalendarTokenCache
}

function calendarIdFor(coachId) {
  if (coachId === "joel") return process.env.GOOGLE_COACHING_JOEL_CALENDAR_ID
  if (coachId === "paula") return process.env.GOOGLE_COACHING_PAULA_CALENDAR_ID
  return null
}

function impersonatedUserFor(coachId) {
  if (coachId === "joel" && process.env.GOOGLE_COACHING_JOEL_IMPERSONATED_USER) {
    return process.env.GOOGLE_COACHING_JOEL_IMPERSONATED_USER
  }
  if (coachId === "paula" && process.env.GOOGLE_COACHING_PAULA_IMPERSONATED_USER) {
    return process.env.GOOGLE_COACHING_PAULA_IMPERSONATED_USER
  }
  return process.env.GOOGLE_COACHING_IMPERSONATED_USER ?? null
}

async function signJwt(payload) {
  const metadataToken = await getMetadataAccessToken()
  const serviceAccountEmail = await getServiceAccountEmail()
  const response = await fetch(
    `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(serviceAccountEmail)}:signJwt`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${metadataToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ payload: JSON.stringify(payload) }),
    },
  )
  if (!response.ok) throw new Error(`Unable to sign delegated Calendar JWT (${response.status}).`)

  const body = await response.json()
  if (!body.signedJwt) throw new Error("IAM Credentials signJwt response did not include signedJwt.")
  return body.signedJwt
}

async function exchangeSignedJwtForAccessToken(signedJwt) {
  const response = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedJwt,
    }),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(
      `Unable to exchange delegated Calendar JWT (${response.status})${detail ? `: ${detail.slice(0, 500)}` : ""}.`,
    )
  }

  const body = await response.json()
  if (!body.access_token) throw new Error("OAuth token response did not include an access token.")
  return {
    accessToken: body.access_token,
    expiresAt: Date.now() + Number(body.expires_in ?? 3600) * 1000,
  }
}

async function getDelegatedCalendarAccessToken(subject) {
  const nowSeconds = Math.floor(Date.now() / 1000)
  const serviceAccountEmail = await getServiceAccountEmail()
  const signedJwt = await signJwt({
    iss: serviceAccountEmail,
    sub: subject,
    scope: CALENDAR_SCOPE,
    aud: OAUTH_TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  })
  return await exchangeSignedJwtForAccessToken(signedJwt)
}

async function getCalendarAccessTokenForCoach(coachId) {
  const subject = impersonatedUserFor(coachId)
  const cacheKey = subject ? `subject:${subject}` : "service-account"
  const cached = calendarTokenCache.get(cacheKey)
  if (cached && cached.expiresAt - 60_000 > Date.now()) {
    return cached.accessToken
  }

  const token = subject
    ? await getDelegatedCalendarAccessToken(subject)
    : await getServiceAccountCalendarAccessToken()
  calendarTokenCache.set(cacheKey, token)
  return token.accessToken
}

async function requestCalendar({ coachId, path, method = "GET", body, requestHeaders }) {
  const token = await getCalendarAccessTokenForCoach(coachId)
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
    const detail = await response.text().catch(() => "")
    const error = new Error(
      `Google Calendar request failed (${response.status})${detail ? `: ${detail.slice(0, 500)}` : ""}.`,
    )
    error.status = response.status
    throw error
  }
  if (response.status === 204) return null
  return await response.json()
}

function requireCalendarId(coachId) {
  const calendarId = calendarIdFor(coachId)
  if (!calendarId) {
    const error = new Error("Coach calendar is not configured.")
    error.status = 400
    throw error
  }
  return calendarId
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function extractMeetUrl(event) {
  return (
    event.hangoutLink ??
    event.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video")?.uri ??
    null
  )
}

function normalizeInternalAttendeeEmails(emails = []) {
  return Array.from(
    new Set(
      emails
        .filter((email) => typeof email === "string")
        .map((email) => email.trim())
        .filter((email) => email.length > 0),
    ),
  )
}

function buildGoogleEventAttendees({ attendeeEmail, internalAttendeeEmails }) {
  return normalizeInternalAttendeeEmails([attendeeEmail ?? "", ...internalAttendeeEmails]).map((email) => ({ email }))
}

function conferenceStatus(event) {
  return event.conferenceData?.createRequest?.status?.statusCode ?? null
}

async function waitForMeetUrl({ coachId, calendarId, event }) {
  let currentEvent = event
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const meetUrl = extractMeetUrl(currentEvent)
    if (meetUrl) return { event: currentEvent, meetUrl }

    const status = conferenceStatus(currentEvent)
    if (status === "failure") {
      const error = new Error("Google Calendar could not create the Meet link.")
      error.status = 502
      throw error
    }
    if (!currentEvent.id) return { event: currentEvent, meetUrl: null }

    await sleep(350 * (attempt + 1))
    currentEvent = await requestCalendar({
      coachId,
      path: `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(currentEvent.id)}?conferenceDataVersion=1`,
    })
  }

  return { event: currentEvent, meetUrl: extractMeetUrl(currentEvent) }
}

export async function freeBusy(payload, request = requestCalendar) {
  const { coachId, timeMin, timeMax, excludeGoogleEventId } = payload
  validateBusyWindows([{ startsAt: timeMin, endsAt: timeMax }])
  const additional = coachId === "paula" ? process.env.GOOGLE_COACHING_PAULA_BLOCKING_CALENDAR_IDS : process.env.GOOGLE_COACHING_JOEL_BLOCKING_CALENDAR_IDS
  const calendarIds = blockingCalendarIds(requireCalendarId(coachId), additional)
  let identity
  if (excludeGoogleEventId) {
    try {
      const event = await request({ coachId: "joel", path: `/calendars/${encodeURIComponent(requireCalendarId("joel"))}/events/${encodeURIComponent(excludeGoogleEventId)}` })
      identity = eventIdentity(event, excludeGoogleEventId)
    } catch (error) {
      if (error.status !== 404) throw error
    }
  }
  const busy = identity
    ? await listBlockingEventWindows({ request, calendarIds, coachId, timeMin, timeMax, identity })
    : readCompleteFreeBusy(await request({ coachId, path: "/freeBusy", method: "POST", body: { timeMin, timeMax, items: calendarIds.map((id) => ({ id })) } }), calendarIds)
  return { busy, availabilityVersion: 2 }
}

export async function getEventForTitle(payload, request = requestCalendar) {
  const calendarId = requireCalendarId(payload.coachId)
  return request({ coachId: payload.coachId, path: `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(payload.googleEventId)}?conferenceDataVersion=1` })
}

export async function updateEventTitle(payload, request = requestCalendar) {
  if (!payload.etag || !payload.summary?.trim() || payload.sendUpdates !== "all") throw Object.assign(new Error("Invalid title update."), { status: 400 })
  const calendarId = requireCalendarId(payload.coachId)
  await request({
    coachId: payload.coachId,
    path: `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(payload.googleEventId)}?conferenceDataVersion=1&sendUpdates=all`,
    method: "PATCH",
    requestHeaders: { "If-Match": payload.etag },
    body: { summary: payload.summary },
  })
  return getEventForTitle(payload, request)
}

async function createEvent(payload) {
  const calendarId = requireCalendarId(payload.coachId)
  const impersonatedUser = impersonatedUserFor(payload.coachId)
  const internalAttendees = normalizeInternalAttendeeEmails(payload.internalAttendeeEmails)
  const attendees = buildGoogleEventAttendees({
    attendeeEmail: payload.attendeeEmail,
    internalAttendeeEmails: internalAttendees,
  })
  const event = await requestCalendar({
    coachId: payload.coachId,
    path: `/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`,
    method: "POST",
    body: {
      ...(payload.eventId ? { id: payload.eventId } : {}),
      summary: payload.summary,
      description: payload.attendeeEmail
        ? `${payload.description}\n\nAttendee: ${payload.attendeeEmail}\nUse this Google Calendar invite for updates or rescheduling.`
        : `${payload.description}\n\nUse this Google Calendar invite for updates or rescheduling.`,
      ...(attendees.length > 0
        ? {
            attendees,
          }
        : {}),
      start: { dateTime: payload.startsAt, timeZone: payload.timezone },
      end: { dateTime: payload.endsAt, timeZone: payload.timezone },
      conferenceData: {
        createRequest: {
          requestId: randomUUID(),
          ...(impersonatedUser
            ? {
                conferenceSolutionKey: {
                  type: "hangoutsMeet",
                },
              }
            : {}),
        },
      },
    },
  }).catch(async (error) => {
    if (payload.eventId && error.status === 409) return requestCalendar({ coachId: payload.coachId, path: `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(payload.eventId)}` })
    throw error
  })
  if (event.status === "cancelled") throw new Error("Coach canceled the calendar event during confirmation.")
  const conference = await waitForMeetUrl({ coachId: payload.coachId, calendarId, event })
  if (impersonatedUser && !conference.meetUrl) {
    const error = new Error("Google Calendar created the event but did not return a Meet link.")
    error.status = 502
    throw error
  }

  return {
    googleEventId: conference.event.id ?? null,
    googleEventHtmlLink: conference.event.htmlLink ?? null,
    googleMeetUrl: conference.meetUrl,
  }
}

async function updateEvent(payload) {
  const calendarId = requireCalendarId(payload.coachId)
  await requestCalendar({
    coachId: payload.coachId,
    path: `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(payload.googleEventId)}?sendUpdates=all`,
    method: "PATCH",
    body: {
      start: { dateTime: payload.startsAt, timeZone: payload.timezone },
      end: { dateTime: payload.endsAt, timeZone: payload.timezone },
    },
  })
  return { ok: true }
}

async function deleteEvent(payload) {
  const calendarId = requireCalendarId(payload.coachId)
  await requestCalendar({
    coachId: payload.coachId,
    path: `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(payload.googleEventId)}?sendUpdates=all`,
    method: "DELETE",
  })
  return { ok: true }
}

async function getEvent(payload) {
  const calendarId = requireCalendarId(payload.coachId)
  const event = await requestCalendar({ coachId: payload.coachId, path: `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(payload.googleEventId)}` })
  return { status: event.status, startsAt: event.start?.dateTime ?? null, endsAt: event.end?.dateTime ?? null }
}

async function dispatch({ operation, payload }) {
  if (operation === "getEventForTitle") return await getEventForTitle(payload)
  if (operation === "updateEventTitle") return await updateEventTitle(payload)
  if (operation === "getEvent") return await getEvent(payload)
  if (operation === "freeBusy") return await freeBusy(payload)
  if (operation === "createEvent") return await createEvent(payload)
  if (operation === "updateEvent") return await updateEvent(payload)
  if (operation === "deleteEvent") return await deleteEvent(payload)
  const error = new Error("Unknown broker operation.")
  error.status = 400
  throw error
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") {
      json(res, 200, {
        ok: true,
        joelConfigured: Boolean(process.env.GOOGLE_COACHING_JOEL_CALENDAR_ID),
        paulaConfigured: Boolean(process.env.GOOGLE_COACHING_PAULA_CALENDAR_ID),
      })
      return
    }
    if (req.method !== "POST" || req.url !== "/") {
      json(res, 404, { error: "Not found." })
      return
    }

    const request = await readJson(req)
    const result = await dispatch(request)
    json(res, 200, result)
  } catch (error) {
    const status = Number(error.status) || 500
    console.error(error)
    json(res, status, { error: error instanceof Error ? error.message : "Calendar broker failed." })
  }
})

if (process.env.NODE_ENV !== "test") server.listen(PORT, "0.0.0.0", () => {
  console.log(`Coach House coaching calendar broker listening on ${PORT}`)
})
