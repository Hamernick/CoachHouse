import { createHash } from "node:crypto"

const SOURCE_ID = "cook-county-immigrant-refugee-organizations"
const SOURCE_NAME =
  "Cook County local organizations serving immigrants and refugees - June 2026"
const SOURCE_URL =
  "https://www.cookcountyil.gov/sites/g/files/ywwepo161/files/documents/2026-06/Local%20Organizations%20Serving%20Immigrant%20%26%20Refugees_%281%29.pdf"
const METHOD_VERSION = "cook-county-immigrant-refugee-directory-v1"

const CATEGORY_RULES = [
  ["family_domestic_violence", /domestic violence|gender-based violence/iu],
  [
    "legal_immigration",
    /immigration|citizenship|daca|refugee resettlement|new americans|immigrant family|welcoming cent(?:er|re)|asylum/iu,
  ],
  ["legal_legal_aid", /legal service|legal aid|law office|tenant rights/iu],
  [
    "housing_homeless_services",
    /homeless|housing counseling|housing service/iu,
  ],
  ["finance_public_benefits", /public benefit|benefits assistance/iu],
  ["health_mental_health", /mental health|behavioral health|counseling/iu],
  [
    "health_primary_care",
    /healthcare|health care|health cent(?:er|re)|medical|clinical service/iu,
  ],
  ["employment_workforce_development", /employment|workforce|job training/iu],
  ["education_esl_english", /english language|\besl\b/iu],
  ["education_adult_education", /adult education|language course/iu],
  ["family_youth_services", /youth service|youth(?: \w+)? program/iu],
  ["family_seniors", /senior service|elderly/iu],
  ["family_childcare", /child care|childcare|early education/iu],
  [
    "community_community_organizing",
    /community organizing|civic engagement|civic education|civic leadership|community planning|policy(?: and)? advocacy|civil rights|base-building|organiz(?:e|ing)[\s,]+and[\s]+advocat|organizing and advocacy|community outreach|community engagement|neighborhood outreach/iu,
  ],
  [
    "community_community_centers",
    /community resource|community service|community support|family support|social service|case management|essential items|safe spaces|food pantry/iu,
  ],
]

const TOP_LEVEL_BY_PREFIX = new Map([
  ["education", "education"],
  ["employment", "employment"],
  ["family", "family"],
  ["finance", "finance"],
  ["health", "health"],
  ["housing", "housing"],
  ["legal", "legal"],
  ["community", "community"],
])

function readString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.replace(/\s+/gu, " ").trim()
    }
  }
  return null
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
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

function recordId(row) {
  return createHash("sha256")
    .update(`${row.name}\u0000${row.website ?? ""}`)
    .digest("hex")
    .slice(0, 20)
}

function titleCasePlace(value) {
  const text = readString(value)
  if (!text) return null
  return text
    .toLocaleLowerCase("en-US")
    .replace(/(^|[\s'-])\p{L}/gu, (letter) => letter.toLocaleUpperCase("en-US"))
}

function resolveCategories(row) {
  const corpus =
    readString(
      [row.services, row.serviceArea, row.communityServed]
        .filter(Boolean)
        .join(" ")
    ) ?? ""
  const matched = CATEGORY_RULES.filter(([, pattern]) =>
    pattern.test(corpus)
  ).map(([category]) => category)
  const primary = matched[0] ?? "organizations"
  const topLevels = matched.map((category) =>
    TOP_LEVEL_BY_PREFIX.get(category.split("_")[0])
  )
  return {
    primaryResourceCategory: primary,
    resourceCategories: unique([primary, ...matched, ...topLevels]),
  }
}

function serviceLabel(row, primaryCategory) {
  const labels = {
    community_community_centers: "Community resources",
    community_community_organizing: "Community organizing",
    education_adult_education: "Adult education",
    education_esl_english: "English-language learning",
    employment_workforce_development: "Workforce development",
    family_childcare: "Childcare and family services",
    family_domestic_violence: "Domestic violence support",
    family_seniors: "Senior services",
    family_youth_services: "Youth services",
    finance_public_benefits: "Public benefits assistance",
    health_mental_health: "Mental health services",
    health_primary_care: "Health services",
    housing_homeless_services: "Housing and homeless services",
    legal_immigration: "Immigration services",
    legal_legal_aid: "Legal aid",
    organizations: "Immigrant and refugee community organization",
  }
  return labels[primaryCategory] ?? readString(row.services) ?? row.name
}

function parseLocation(row, geocode) {
  const components = geocode?.addressComponents ?? {}
  const address = readString(row.address)
  const fallback = address?.match(/,\s*([^,]+),?\s+(IL)\s+(\d{5})\b/iu)
  return {
    address,
    city: titleCasePlace(readString(components.city, fallback?.[1])),
    latitude: Number.isFinite(geocode?.coordinates?.y)
      ? geocode.coordinates.y
      : null,
    longitude: Number.isFinite(geocode?.coordinates?.x)
      ? geocode.coordinates.x
      : null,
    state: readString(components.state, fallback?.[2], "IL")?.toUpperCase(),
    zipCode: readString(components.zip, fallback?.[3]),
  }
}

/**
 * @param {object} options
 * @param {string} options.fetchedAt
 * @param {{
 *   addressComponents?: { city?: string | null, state?: string | null, zip?: string | null },
 *   coordinates?: { x?: number | null, y?: number | null }
 * } | null} [options.geocode]
 * @param {{
 *   name: string,
 *   website: string,
 *   address?: string | null,
 *   communityServed?: string | null,
 *   serviceArea?: string | null,
 *   services?: string | null
 * }} options.row
 * @param {string} [options.sourceUrl]
 */
export function buildCookCountyImmigrantResourceRecord({
  fetchedAt,
  geocode = null,
  row,
  sourceUrl = SOURCE_URL,
}) {
  const name = readString(row.name)
  const website = normalizeUrl(row.website)
  if (!name || !website) {
    throw new Error("Cook County directory rows require a name and website.")
  }
  const location = parseLocation(row, geocode)
  const categories = resolveCategories(row)
  const serviceName = serviceLabel(row, categories.primaryResourceCategory)
  const statedServices = readString(row.services)
  const services =
    statedServices ??
    "The directory does not provide a detailed service list for this organization."
  const serviceArea = readString(row.serviceArea)
  const communityServed = readString(row.communityServed)
  const description = `${name} appears in Cook County's June 2026 directory of organizations serving immigrants and refugees. The directory lists these services: ${services}`
  const eligibility = communityServed
    ? `The directory identifies the community served as ${communityServed}. It does not state location-specific eligibility or document requirements.`
    : "The directory does not state location-specific eligibility or document requirements. Contact the provider to confirm who can use the service."
  const accessInstructions = location.address
    ? `Review current service and intake information on the provider website, then contact ${name} before visiting ${location.address}.`
    : `Review current service, location, and intake information on the provider website before visiting or applying.`
  const extractedFields = {
    accessInstructions,
    address: location.address,
    appointmentInfo: accessInstructions,
    city: location.city,
    country: "US",
    coverageArea: serviceArea ? [serviceArea] : [],
    deliveryModes: unique([location.address ? "in_person" : null, "online"]),
    description,
    eligibility,
    enrichment: {
      methodVersion: METHOD_VERSION,
      needsReview: true,
      publicResourceEligible: Boolean(statedServices),
      sourceComparisonCount: 1,
      verification: {
        contradictions: [],
        status: "needs_review",
        unsupportedClaims: [],
      },
    },
    latitude: location.latitude,
    links: [
      {
        isPrimary: true,
        label: "Provider website",
        type: "website",
        url: website,
      },
    ],
    locationType: location.address ? "physical" : "service_area",
    longitude: location.longitude,
    organizationName: name,
    primaryResourceCategory: categories.primaryResourceCategory,
    providerName: name,
    resourceCategories: categories.resourceCategories,
    serviceArea: serviceArea ? [serviceArea] : [],
    serviceDescription: description,
    services: [
      {
        description,
        howToAccess: accessInstructions,
        name: serviceName,
      },
    ],
    serviceTitle: name,
    sourceCategoryText: services,
    state: location.state,
    timezone: "America/Chicago",
    title: name,
    websiteUrl: website,
    whoItHelps: communityServed,
    zipCode: location.zipCode,
  }

  return {
    extractedFields,
    fetchedAt,
    fieldEvidence: [
      "organizationName",
      "serviceTitle",
      "description",
      "eligibility",
      "accessInstructions",
      "websiteUrl",
      ...(location.address ? ["address"] : []),
    ].map((field) => ({
      confidenceScore: 90,
      derivedFrom: [sourceUrl],
      evidenceMetadata: {
        methodVersion: METHOD_VERSION,
        verificationStatus: "needs_review",
      },
      evidenceType: "source_snapshot",
      fieldPath: `extractedFields.${field}`,
      observedAt: fetchedAt,
      sourceUrl,
      transformation: "source_specific_deterministic_enrichment",
    })),
    lastUpdatedAt: fetchedAt,
    rawSnapshot: { directoryRow: row, geocode },
    sourceId: SOURCE_ID,
    sourceName: SOURCE_NAME,
    sourceRecordId: recordId(row),
    sourceType: "government_provider_directory",
    sourceUrl,
  }
}

export function buildCensusGeocodeUrl(address) {
  const url = new URL(
    "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress"
  )
  url.searchParams.set("address", address)
  url.searchParams.set("benchmark", "Public_AR_Current")
  url.searchParams.set("format", "json")
  return url.toString()
}

export const COOK_COUNTY_IMMIGRANT_RESOURCE_DEFAULTS = {
  sourceId: SOURCE_ID,
  sourceName: SOURCE_NAME,
  sourceUrl: SOURCE_URL,
}
