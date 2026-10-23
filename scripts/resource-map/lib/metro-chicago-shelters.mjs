const SOURCE_ID = "211-metro-chicago-housing-services"
const SOURCE_NAME = "211 Metro Chicago shelter and housing-services directory"
const SOURCE_URL = "https://211metrochicago.org/search-for-resources/"
const METHOD_VERSION = "211-metro-chicago-shelters-v3-official-provider-links"

const PROGRAM_WEBSITE_OVERRIDES = new Map([
  [
    "80919766",
    "https://www.aidschicago.org/our-work/housing/permanent-housing/",
  ],
  ["80919768", "https://www.aidschicago.org/i-need/housing/"],
  ["80919772", "https://www.aidschicago.org/i-need/housing/"],
  ["80919773", "https://www.aidschicago.org/i-need/housing/"],
  ["80919825", "https://www.familypromisechicagons.org/about"],
  ["80919900", "https://www.csls.org/services"],
  ["82808175", "https://childlink.org/programs/"],
  ["86742794", "https://www.lpcschicago.org/what-we-do"],
  [
    "87878951",
    "https://www.josselyn.org/community-programs/resiliency-center/",
  ],
])

const PUBLIC_RESOURCE_SERVICE_PATTERN =
  /Domestic Violence Shelters|Youth Shelters|Community Shelters|Emergency Shelter Clearinghouses|Homeless Permanent Supportive Housing|Family Permanent Supportive Housing|Transitional Housing\/Shelter|Drop In Centers|Single Room Occupancy Housing|Rapid Re-Housing Programs/iu

export const METRO_CHICAGO_HOUSING_CATEGORY_IDS = [
  129, 138, 142, 151, 275, 294, 6460,
]

const CATEGORY_FIELDS = new Map([
  [
    129,
    {
      primary: "housing_emergency_shelter",
      categories: [
        "housing_emergency_shelter",
        "family_domestic_violence",
        "housing",
        "family",
      ],
    },
  ],
  [
    138,
    {
      primary: "housing_emergency_shelter",
      categories: [
        "housing_emergency_shelter",
        "family_youth_services",
        "housing_homeless_services",
        "housing",
        "family",
      ],
    },
  ],
  [
    142,
    {
      primary: "housing_emergency_shelter",
      categories: [
        "housing_emergency_shelter",
        "housing_homeless_services",
        "housing",
      ],
    },
  ],
  [
    151,
    {
      primary: "housing_homeless_services",
      categories: [
        "housing_homeless_services",
        "emergency_emergency_shelter",
        "housing",
        "emergency",
      ],
    },
  ],
  [
    275,
    {
      primary: "housing_permanent_supportive_housing",
      categories: [
        "housing_permanent_supportive_housing",
        "housing_homeless_services",
        "housing",
      ],
    },
  ],
  [
    294,
    {
      primary: "housing_transitional_housing",
      categories: [
        "housing_transitional_housing",
        "housing_homeless_services",
        "housing",
      ],
    },
  ],
  [
    6460,
    {
      primary: "housing_homeless_services",
      categories: [
        "housing_homeless_services",
        "community_community_centers",
        "housing",
        "community",
      ],
    },
  ],
])

const DAY_NAMES = new Map([
  ["sun", "sunday"],
  ["mon", "monday"],
  ["tue", "tuesday"],
  ["wed", "wednesday"],
  ["thu", "thursday"],
  ["fri", "friday"],
  ["sat", "saturday"],
])

function readString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.replace(/\s+/gu, " ").trim()
    }
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

function decodeHtml(value) {
  const text = readString(value)
  if (!text) return null
  return text
    .replace(/<br\s*\/?\s*>/giu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;|&#160;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&quot;|&#34;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/\s+/gu, " ")
    .trim()
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

function parseJson(value) {
  if (value && typeof value === "object") return value
  const text = readString(value)
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function normalizeHours(program) {
  const raw =
    parseJson(program.hours) ??
    parseJson(program.site?.hours) ??
    parseJson(program.agency?.hours)
  const days = Array.isArray(raw?.days) ? raw.days : []
  const weekly = {}
  const labels = []
  for (const entry of days) {
    const shortDay = readString(entry.dayOfWeek)?.slice(0, 3).toLowerCase()
    const day = DAY_NAMES.get(shortDay)
    const opensAt = readString(entry.opens)
    const closesAt = readString(entry.closes)
    if (!day || !opensAt || !closesAt) continue
    const intervals = weekly[day] ?? []
    intervals.push({ opensAt, closesAt })
    weekly[day] = intervals
    labels.push(
      `${day.charAt(0).toUpperCase()}${day.slice(1)} ${opensAt}-${closesAt}`
    )
  }
  return Object.keys(weekly).length > 0
    ? { label: labels.join("; "), weekly }
    : null
}

function splitList(value) {
  return unique(
    (readString(value) ?? "")
      .split(/[;,\n\r]+/u)
      .map((entry) => entry.trim())
      .filter(Boolean)
  )
}

function categoryIdFor(program, requestedCategoryId) {
  const matched = (program.categories ?? [])
    .map((category) => readNumber(category.id))
    .find((id) => CATEGORY_FIELDS.has(id))
  return matched ?? requestedCategoryId
}

export function isPublicMetroChicagoHousingProgram(program) {
  const categoryText = (program?.categories ?? [])
    .map((category) => readString(category?.name))
    .filter(Boolean)
    .join("; ")
  return PUBLIC_RESOURCE_SERVICE_PATTERN.test(categoryText)
}

function publicSearchUrl(categoryId) {
  const url = new URL(SOURCE_URL)
  url.searchParams.set("external_category", "HOU")
  url.searchParams.set("category_id", String(categoryId))
  return url.toString()
}

function buildDescription(program, agencyName) {
  const sourceDescription = decodeHtml(program.description)
  if (sourceDescription && sourceDescription.length >= 80) {
    return sourceDescription
  }
  return `${program.name}, provided by ${agencyName}, is listed by 211 Metro Chicago as an active shelter or homeless-service program. Contact the provider to confirm current availability and intake steps.`
}

function buildProgramTitle(programName, agencyName) {
  const normalizedProgram = programName.toLocaleLowerCase("en-US")
  const normalizedAgency = agencyName.toLocaleLowerCase("en-US")
  return normalizedProgram.includes(normalizedAgency)
    ? programName
    : `${agencyName} - ${programName}`
}

/**
 * @typedef {{
 *   days?: Array<{
 *     opens?: string | null,
 *     closes?: string | null,
 *     dayOfWeek?: string | null
 *   }>
 * }} MetroChicagoHours
 */

/**
 * @param {object} options
 * @param {string | null} [options.cityName]
 * @param {string} options.fetchedAt
 * @param {{
 *   id: number | string,
 *   name: string,
 *   agency_status?: string | null,
 *   application_process?: string | null,
 *   categories?: Array<{ id?: number | string | null, name?: string | null }>,
 *   contact_email_address?: string | null,
 *   contact_phone?: string | null,
 *   coverage_area?: string | null,
 *   coverage_areas?: string | null,
 *   description?: string | null,
 *   documents_required?: string | null,
 *   eligibility?: string | null,
 *   hours?: string | MetroChicagoHours | null,
 *   languages?: string | null,
 *   modified_at?: string | null,
 *   physical_location?: string | null,
 *   program_fee?: string | null,
 *   updated_at?: string | null,
 *   website?: string | null,
 *   agency: {
 *     name: string,
 *     email?: string | null,
 *     hours?: string | MetroChicagoHours | null,
 *     phone?: string | null,
 *     physical_location?: string | null,
 *     website?: string | null
 *   },
 *   site?: {
 *     city_id?: number | string | null,
 *     contact_email?: string | null,
 *     contact_phone?: string | null,
 *     disability_access?: string | null,
 *     hours?: string | MetroChicagoHours | null,
 *     lat?: number | string | null,
 *     lng?: number | string | null,
 *     name?: string | null,
 *     physical_address?: string | null,
 *     zip?: { name?: string | null } | null
 *   } | null
 * }} options.program
 * @param {string} options.rawApiUrl
 * @param {number} options.requestedCategoryId
 */
export function buildMetroChicagoShelterRecord({
  cityName = null,
  fetchedAt,
  program,
  rawApiUrl,
  requestedCategoryId,
}) {
  const programId = readNumber(program.id)
  const programName = readString(program.name)
  const agencyName = readString(program.agency?.name)
  if (programId === null || !programName || !agencyName) {
    throw new Error(
      "211 shelter rows require program, service, and agency IDs."
    )
  }
  const categoryId = categoryIdFor(program, requestedCategoryId)
  const categories = CATEGORY_FIELDS.get(categoryId) ?? CATEGORY_FIELDS.get(151)
  const sourceUrl = publicSearchUrl(categoryId)
  const address = readString(
    program.physical_location,
    program.site?.physical_address,
    program.agency?.physical_location
  )
  const phone = readString(
    program.contact_phone,
    program.site?.contact_phone,
    program.agency?.phone
  )
  const email = readString(
    program.contact_email_address,
    program.site?.contact_email,
    program.agency?.email
  )?.toLowerCase()
  const website = normalizeUrl(
    PROGRAM_WEBSITE_OVERRIDES.get(String(programId)) ??
      program.website ??
      program.agency?.website
  )
  const hours = normalizeHours(program)
  const description = buildDescription(program, agencyName)
  const eligibility =
    readString(program.eligibility) ??
    "211 Metro Chicago does not state program-specific eligibility. Contact the provider to confirm who can use this service."
  const applicationProcess =
    readString(program.application_process) ??
    `Contact ${agencyName}${phone ? ` at ${phone}` : ""} to confirm availability and intake steps before visiting.`
  const accessInstructions = `${applicationProcess} Shelter availability can change quickly; confirm before traveling.`
  const coverageArea = splitList(
    readString(program.coverage_area, program.coverage_areas)
  )
  const documentsNeeded = splitList(program.documents_required)
  const languages = splitList(program.languages)
  const providerLinks = website
    ? [
        {
          isPrimary: true,
          label: "Provider website",
          type: "website",
          url: website,
        },
      ]
    : []
  const title = buildProgramTitle(programName, agencyName)
  const latitude = readNumber(program.site?.lat)
  const longitude = readNumber(program.site?.lng)
  const fields = {
    accessInstructions,
    accessibilityNotes:
      readString(program.site?.disability_access) ??
      "211 Metro Chicago does not state site-specific accessibility details.",
    address,
    appointmentInfo: accessInstructions,
    city: readString(cityName),
    cost:
      readString(program.program_fee) ??
      "211 Metro Chicago does not state a program fee.",
    country: "US",
    coverageArea,
    deliveryModes: unique([
      address ? "in_person" : null,
      phone ? "phone" : null,
    ]),
    description,
    documentsNeeded,
    email,
    eligibility,
    enrichment: {
      methodVersion: METHOD_VERSION,
      needsReview: true,
      sourceComparisonCount: 1,
      verification: {
        contradictions: [],
        status: "needs_review",
        unsupportedClaims: [],
      },
    },
    hours,
    hoursLabel: hours?.label ?? null,
    languages,
    latitude,
    links: providerLinks,
    locationType: address ? "physical" : "service_area",
    longitude,
    organizationName: agencyName,
    phone,
    primaryResourceCategory: categories.primary,
    providerName: agencyName,
    resourceCategories: categories.categories,
    serviceArea: coverageArea,
    serviceDescription: description,
    services: [
      {
        description,
        howToAccess: accessInstructions,
        name: programName,
      },
    ],
    serviceTitle: title,
    sourceCategoryText: (program.categories ?? [])
      .map((category) => readString(category.name))
      .filter(Boolean)
      .join("; "),
    state: "IL",
    timezone: "America/Chicago",
    title,
    websiteUrl: website,
    whoItHelps: eligibility,
    zipCode: readString(program.site?.zip?.name),
  }

  return {
    extractedFields: fields,
    fetchedAt,
    fieldEvidence: [
      "organizationName",
      "serviceTitle",
      "description",
      "eligibility",
      "accessInstructions",
      "address",
      "phone",
      "websiteUrl",
      "hours",
    ]
      .filter((field) => fields[field] !== null && fields[field] !== undefined)
      .map((field) => ({
        confidenceScore: 95,
        derivedFrom: [rawApiUrl],
        evidenceMetadata: {
          methodVersion: METHOD_VERSION,
          providerModifiedAt: readString(program.modified_at),
          verificationStatus: "needs_review",
        },
        evidenceType: "source_snapshot",
        fieldPath: `extractedFields.${field}`,
        observedAt: fetchedAt,
        sourceUrl,
        transformation: "source_specific_deterministic_enrichment",
      })),
    lastUpdatedAt: readString(
      program.modified_at,
      program.updated_at,
      fetchedAt
    ),
    rawSnapshot: { program, rawApiUrl, requestedCategoryId },
    sourceId: SOURCE_ID,
    sourceName: SOURCE_NAME,
    sourceRecordId: String(programId),
    sourceType: "provider_directory",
    sourceUrl,
  }
}

export function buildMetroChicagoProgramsUrl({ categoryId, page = 1 }) {
  const url = new URL("https://api.211metrochicago.org/api/programs")
  url.searchParams.set("category_id", String(categoryId))
  url.searchParams.set("page", String(page))
  return url.toString()
}

export const METRO_CHICAGO_HOUSING_DEFAULTS = {
  sourceId: SOURCE_ID,
  sourceName: SOURCE_NAME,
  sourceUrl: SOURCE_URL,
}
