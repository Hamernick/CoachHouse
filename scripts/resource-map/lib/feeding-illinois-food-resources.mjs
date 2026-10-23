const DEFAULT_SOURCE_URL =
  "https://www.feedingillinois.org/food-resources-illinois"
const DEFAULT_API_BASE_URL = "https://api.accessfood.org/api/MapInformation"
const DEFAULT_MAP_TOKEN = "5f10ebae-dc87-42df-85b9-79da144cbc6e"
const DEFAULT_REGION_ID = 66
const DEFAULT_REGION_MAP_ID = 96
const SOURCE_ID = "feeding-illinois-food-resources"
const SOURCE_NAME =
  "Feeding Illinois / Greater Chicago Food Depository food partner locator"
const METHOD_VERSION = "feeding-illinois-public-locator-v4-northern-intake"

const NETWORK_INTAKE_BY_REGION_ID = new Map([
  [
    1,
    {
      label: "Find food through Greater Chicago Food Depository",
      url: "https://www.chicagosfoodbank.org/find-food/",
    },
  ],
  [
    2,
    {
      label: "Find food through Northern Illinois Food Bank",
      url: "https://solvehungertoday.org/get-groceries-resources/",
    },
  ],
])

const PROGRAM_CATEGORY_RULES = [
  {
    pattern: /hot meal|meal program|soup kitchen/iu,
    primary: "food_community_meals",
  },
  {
    pattern: /pantry|grocery|food distribution|mobile distribution/iu,
    primary: "food_food_pantries",
  },
]

function readString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return null
}

function readNumber(...values) {
  for (const value of values) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function splitValues(...values) {
  return unique(
    values
      .flatMap((value) =>
        typeof value === "string"
          ? value
              .replace(/&amp;/giu, "&")
              .replace(/&nbsp;/giu, " ")
              .replace(/&quot;/giu, '"')
              .replace(/&#39;|&apos;/giu, "'")
              .split(/[,;|]/u)
          : []
      )
      .map((value) => value.replace(/\s+/gu, " ").trim())
      .filter(Boolean)
  )
}

function normalizeUrl(value) {
  const candidate = readString(value)
  if (!candidate) return null
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//iu.test(candidate)
    ? candidate
    : `https://${candidate}`
  try {
    const url = new URL(withProtocol)
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    ) {
      return null
    }
    url.hash = ""
    return url.toString().replace(/\/$/u, "")
  } catch {
    return null
  }
}

function displayPrograms(location) {
  return splitValues(
    location.foodPrograms,
    location.servicePrograms,
    location.foodServiceTypes
  )
}

function joinList(values) {
  if (values.length === 0) return "food assistance"
  if (values.length === 1) return values[0]
  if (values.length === 2) return `${values[0]} and ${values[1]}`
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`
}

function categoryFields(programs) {
  const corpus = programs.join(" ")
  const matched = PROGRAM_CATEGORY_RULES.filter(({ pattern }) =>
    pattern.test(corpus)
  ).map(({ primary }) => primary)
  const primary = matched[0] ?? "food"
  return {
    category: "food",
    primaryResourceCategory: primary,
    resourceCategories: unique([primary, ...matched, "food"]),
    subcategory: primary === "food" ? null : primary,
  }
}

function buildFullAddress(location) {
  const street = [readString(location.address1), readString(location.address2)]
    .filter(Boolean)
    .join(", ")
  const locality = [
    readString(location.city),
    [readString(location.state), readString(location.zipCode)]
      .filter(Boolean)
      .join(" "),
  ]
    .filter(Boolean)
    .join(", ")
  return [street, locality].filter(Boolean).join(", ") || null
}

function scheduleKey(schedule) {
  return [
    schedule.locationServiceId,
    schedule.dayOfWeek,
    schedule.startTimeDescr,
    schedule.endTimeDescr,
    schedule.weeksOfMonth,
    schedule.daysOfMonth,
    schedule.notes,
  ].join("\u0000")
}

function normalizeSchedules(schedules) {
  const seen = new Set()
  return schedules
    .filter((schedule) => {
      const key = scheduleKey(schedule)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map((schedule) => ({
      closesAt: readString(schedule.endTimeDescr),
      contactForHoursMessage: readString(schedule.contactForHoursMessage),
      day: readString(schedule.weekDayDescr),
      dayOfWeek: readNumber(schedule.dayOfWeek),
      daysOfMonth: readString(schedule.daysOfMonth),
      everyOtherWeek: schedule.everyOtherWeekInd === true,
      locationServiceId: readNumber(schedule.locationServiceId),
      notes: readString(schedule.notes),
      opensAt: readString(schedule.startTimeDescr),
      weeksOfMonth: readString(schedule.weeksOfMonth),
    }))
}

function buildHours(schedules) {
  const normalized = normalizeSchedules(schedules)
  const weekly = {}
  for (const schedule of normalized) {
    const day = schedule.day?.toLowerCase()
    if (!day || !schedule.opensAt || !schedule.closesAt) continue
    const intervals = weekly[day] ?? []
    intervals.push({
      closesAt: schedule.closesAt,
      opensAt: schedule.opensAt,
    })
    weekly[day] = intervals
  }
  const label = normalized
    .filter((schedule) => schedule.day && schedule.opensAt && schedule.closesAt)
    .map(
      (schedule) => `${schedule.day} ${schedule.opensAt}-${schedule.closesAt}`
    )
    .join("; ")
  return {
    hours: Object.keys(weekly).length > 0 ? { label, weekly } : null,
    hoursLabel: label || null,
    schedules: normalized,
  }
}

function buildAccessInstructions({
  address,
  intakeUrl,
  phone,
  title,
  website,
}) {
  const visit = address
    ? `Visit ${title} at ${address} during the listed schedule.`
    : `Contact ${title} for its current service location and schedule.`
  const confirm = phone
    ? `Call ${phone} before traveling to confirm hours and availability.`
    : website
      ? "Check the provider website before traveling to confirm hours and availability."
      : intakeUrl
        ? "Use the linked food-bank finder before traveling to confirm hours and availability."
        : "Use the Feeding Illinois locator before traveling to confirm hours and availability."
  return `${visit} ${confirm}`
}

function buildFieldEvidence({ fields, fetchedAt, rawApiUrl, sourceUrl }) {
  const fieldPaths = [
    "extractedFields.organizationName",
    "extractedFields.serviceTitle",
    "extractedFields.description",
    "extractedFields.address",
    "extractedFields.latitude",
    "extractedFields.longitude",
    ...(fields.phone ? ["extractedFields.phone"] : []),
    ...(fields.email ? ["extractedFields.email"] : []),
    ...(fields.websiteUrl ? ["extractedFields.websiteUrl"] : []),
    ...(fields.intakeUrl ? ["extractedFields.intakeUrl"] : []),
    ...(fields.hours ? ["extractedFields.hours"] : []),
  ]
  return fieldPaths.map((fieldPath) => ({
    confidenceScore: 90,
    derivedFrom: [rawApiUrl],
    evidenceMetadata: {
      methodVersion: METHOD_VERSION,
      verificationStatus: "needs_review",
    },
    evidenceType: "source_snapshot",
    fieldPath,
    observedAt: fetchedAt,
    sourceUrl,
    transformation: "source_specific_deterministic_enrichment",
  }))
}

/**
 * @param {object} options
 * @param {string} options.fetchedAt
 * @param {{
 *   locationId: number | string,
 *   locationName: string,
 *   address1?: string | null,
 *   address2?: string | null,
 *   city?: string | null,
 *   contactEmail?: string | null,
 *   contactPhone?: string | null,
 *   country?: string | null,
 *   foodOfferings?: string | null,
 *   foodPrograms?: string | null,
 *   foodServiceTypes?: string | null,
 *   latitude?: number | string | null,
 *   locationFeatures?: string | null,
 *   longitude?: number | string | null,
 *   phone?: string | null,
 *   regionId?: number | string | null,
 *   serviceArea?: string | null,
 *   serviceAreas?: string | null,
 *   serviceLanguages?: string | null,
 *   servicePrograms?: string | null,
 *   state?: string | null,
 *   website?: string | null,
 *   zipCode?: string | null
 * }} options.location
 * @param {string} options.rawApiUrl
 * @param {Array<{
 *   contactForHoursMessage?: string | null,
 *   dayOfWeek?: number | string | null,
 *   daysOfMonth?: string | null,
 *   endTimeDescr?: string | null,
 *   everyOtherWeekInd?: boolean | null,
 *   locationId?: number | string | null,
 *   locationServiceId?: number | string | null,
 *   notes?: string | null,
 *   startTimeDescr?: string | null,
 *   weekDayDescr?: string | null,
 *   weeksOfMonth?: string | null
 * }>} [options.schedules]
 * @param {string} [options.sourceUrl]
 */
export function buildFeedingIllinoisRecord({
  fetchedAt,
  location,
  rawApiUrl,
  schedules = [],
  sourceUrl = DEFAULT_SOURCE_URL,
}) {
  const locationId = readNumber(location.locationId)
  const title = readString(location.locationName)
  if (locationId === null || !title) {
    throw new Error(
      "Feeding Illinois rows require locationId and locationName."
    )
  }
  const programs = displayPrograms(location)
  const categories = categoryFields(programs)
  const website = normalizeUrl(location.website)
  const phone = readString(location.phone, location.contactPhone)
  const email = readString(location.contactEmail)?.toLowerCase() ?? null
  const networkIntake =
    !website && !phone && !email
      ? (NETWORK_INTAKE_BY_REGION_ID.get(readNumber(location.regionId)) ?? null)
      : null
  const address = buildFullAddress(location)
  const schedule = buildHours(schedules)
  const languages = splitValues(location.serviceLanguages)
  const serviceArea = splitValues(location.serviceAreas, location.serviceArea)
  const accessibility = splitValues(location.locationFeatures)
  const description = `${title} is listed in the Feeding Illinois food-resource locator for ${joinList(
    programs
  )}. Contact the provider before visiting to confirm current hours, availability, and any site-specific requirements.`
  const accessInstructions = buildAccessInstructions({
    address,
    intakeUrl: networkIntake?.url,
    phone,
    title,
    website,
  })
  const sourceCategoryText = programs.join("; ") || "Food assistance"
  const providerLinks = website
    ? [
        {
          isPrimary: true,
          label: "Provider website",
          type: "website",
          url: website,
        },
      ]
    : networkIntake
      ? [
          {
            isPrimary: true,
            label: networkIntake.label,
            type: "intake",
            url: networkIntake.url,
          },
        ]
      : []
  const fields = {
    ...categories,
    accessInstructions,
    accessibilityNotes:
      accessibility.length > 0
        ? `The locator lists: ${accessibility.join(", ")}.`
        : "The locator does not state location-specific accessibility details.",
    address,
    addressStreet: readString(location.address1),
    appointmentInfo: accessInstructions,
    city: readString(location.city),
    cost: "The locator presents this location as food assistance; it does not state location-specific costs.",
    country: readString(location.country) ?? "US",
    coverageArea: serviceArea,
    deliveryModes: ["in_person"],
    description,
    email,
    eligibility:
      "The locator does not state location-specific eligibility. Contact the provider to confirm residency, age, registration, or document requirements.",
    enrichment: {
      methodVersion: METHOD_VERSION,
      needsReview: true,
      sourceComparisonCount: schedule.schedules.length > 0 ? 2 : 1,
      verification: {
        contradictions: [],
        status: "needs_review",
        unsupportedClaims: [],
      },
    },
    foodOfferings: splitValues(location.foodOfferings),
    foodPrograms: programs,
    hours: schedule.hours,
    hoursLabel: schedule.hoursLabel,
    intakeUrl: networkIntake?.url ?? null,
    languages,
    latitude: readNumber(location.latitude),
    links: providerLinks,
    locationType: "physical",
    longitude: readNumber(location.longitude),
    organizationName: title,
    phone,
    primaryResourceCategory: categories.primaryResourceCategory,
    providerName: title,
    resourceCategories: categories.resourceCategories,
    serviceArea,
    serviceDescription: description,
    services: [
      {
        description,
        howToAccess: accessInstructions,
        name: joinList(programs),
      },
    ],
    serviceTitle: title,
    sourceCategoryText,
    state: readString(location.state),
    timezone: "America/Chicago",
    title,
    websiteUrl: website,
    zipCode: readString(location.zipCode),
  }

  return {
    extractedFields: fields,
    fetchedAt,
    fieldEvidence: buildFieldEvidence({
      fields,
      fetchedAt,
      rawApiUrl,
      sourceUrl,
    }),
    lastUpdatedAt: fetchedAt,
    rawSnapshot: {
      location,
      rawApiUrl,
      schedules: schedule.schedules,
    },
    sourceId: SOURCE_ID,
    sourceName: SOURCE_NAME,
    sourceRecordId: String(locationId),
    sourceType: "provider_directory",
    sourceUrl,
  }
}

function normalizeDuplicateKeyPart(value) {
  return (readString(value) ?? "")
    .normalize("NFKD")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
}

function duplicateKey(record) {
  const fields = record.extractedFields ?? {}
  return [fields.title, fields.address, fields.sourceCategoryText]
    .map(normalizeDuplicateKeyPart)
    .join("\u0000")
}

function completenessScore(record) {
  const fields = record.extractedFields ?? {}
  return [
    fields.websiteUrl,
    fields.phone,
    fields.email,
    fields.hours,
    fields.latitude,
    fields.longitude,
  ].reduce((score, value) => score + (value ? 1 : 0), 0)
}

export function dedupeFeedingIllinoisRecords(records) {
  const byLocation = new Map()
  for (const record of records) {
    const key = duplicateKey(record)
    const current = byLocation.get(key)
    if (!current || completenessScore(record) > completenessScore(current)) {
      byLocation.set(key, record)
    }
  }
  return [...byLocation.values()]
}

export function buildLocationSearchUrl({
  apiBaseUrl = DEFAULT_API_BASE_URL,
  latitude = 41.8781,
  longitude = -87.6298,
  page = 0,
  radius = 60,
  regionId = DEFAULT_REGION_ID,
  regionMapId = DEFAULT_REGION_MAP_ID,
}) {
  const url = new URL(`${apiBaseUrl}/LocationSearch`)
  const params = {
    dayAv: "",
    dietRestrictionAv: "",
    foodOfferingAv: "",
    foodProgramAv: "",
    includeLocationOperatingHours: "true",
    isMapV2: "true",
    languagesAv: "",
    lat: String(latitude),
    lng: String(longitude),
    locationFeatureAv: "",
    page: String(page),
    radius: String(radius),
    regionId: String(regionId),
    regionMapId: String(regionMapId),
    serviceCategoriesAv: "",
    serviceTypeAv: "",
    showOutOfNetwork: "0",
  }
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}

export function buildRegionMapUrl({
  apiBaseUrl = DEFAULT_API_BASE_URL,
  mapToken = DEFAULT_MAP_TOKEN,
}) {
  const url = new URL(`${apiBaseUrl}/RegionMap`)
  url.searchParams.set("securityToken", mapToken)
  url.searchParams.set("isMapV2", "true")
  return url.toString()
}

export function buildSchedulesUrl({
  apiBaseUrl = DEFAULT_API_BASE_URL,
  locationIds,
  regionId = DEFAULT_REGION_ID,
}) {
  const url = new URL(`${apiBaseUrl}/LocationServiceSchedules`)
  url.searchParams.set("LocationIds", locationIds.join(","))
  url.searchParams.set("MapRegionId", String(regionId))
  return url.toString()
}

export const FEEDING_ILLINOIS_DEFAULTS = {
  apiBaseUrl: DEFAULT_API_BASE_URL,
  mapToken: DEFAULT_MAP_TOKEN,
  regionId: DEFAULT_REGION_ID,
  regionMapId: DEFAULT_REGION_MAP_ID,
  sourceId: SOURCE_ID,
  sourceName: SOURCE_NAME,
  sourceUrl: DEFAULT_SOURCE_URL,
}
