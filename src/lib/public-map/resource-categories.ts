import { PUBLIC_MAP_RESOURCE_SUBCATEGORY_DEFINITION_OVERRIDES } from "./resource-category-subcategory-overrides"
import { createPublicMapCategoryAliasMatcher } from "./resource-category-alias-matching"

export const PUBLIC_MAP_RESOURCE_CATEGORY_ORDER = [
  "health",
  "food",
  "housing",
  "education",
  "employment",
  "finance",
  "legal",
  "family",
  "community",
  "emergency",
  "environment",
  "safety",
  "organizations",
  "international",
  "animals",
] as const

export type PublicMapResourceTopLevelCategoryKey =
  (typeof PUBLIC_MAP_RESOURCE_CATEGORY_ORDER)[number]

export const PUBLIC_MAP_RESOURCE_SUBCATEGORY_GROUPS = {
  health: [
    ["health_primary_care", "Primary Care"],
    ["health_dental", "Dental"],
    ["health_vision", "Vision"],
    ["health_mental_health", "Mental Health"],
    ["health_crisis_hotlines", "Crisis & Hotlines"],
    ["health_substance_use_recovery", "Substance Use & Recovery"],
    ["health_disability_services", "Disability Services"],
    ["health_womens_health", "Women's Health"],
    ["health_mens_health", "Men's Health"],
    ["health_childrens_health", "Children's Health"],
    ["health_senior_health", "Senior Health"],
    ["health_sexual_reproductive_health", "Reproductive Health"],
    ["health_chronic_illness", "Chronic Illness"],
    ["health_preventive_care", "Preventive Care"],
    ["health_insurance", "Health Insurance"],
    ["health_care_navigation", "Care Navigation"],
  ],
  food: [
    ["food_community_fridges", "Community Fridges"],
    ["food_food_pantries", "Food Pantries"],
    ["food_community_meals", "Community Meals"],
    ["food_groceries", "Groceries"],
    ["food_nutrition", "Nutrition"],
    ["food_water", "Water"],
    ["food_baby_formula", "Baby Formula"],
    ["food_school_meals", "School Meals"],
    ["food_senior_meals", "Senior Meals"],
    ["food_community_gardens", "Community Gardens"],
    ["food_delivery", "Food Delivery"],
  ],
  housing: [
    ["housing_emergency_shelter", "Shelter"],
    ["housing_homeless_services", "Homeless Services"],
    ["housing_transitional_housing", "Transitional Housing"],
    ["housing_permanent_supportive_housing", "Permanent Supportive Housing"],
    ["housing_affordable_housing", "Affordable Housing"],
    ["housing_rental_assistance", "Rental Assistance"],
    ["housing_eviction_prevention", "Eviction Prevention"],
    ["housing_homeownership", "Homeownership"],
    ["housing_utility_assistance", "Utility Assistance"],
    ["housing_home_repair", "Home Repair"],
    ["housing_weatherization", "Weatherization"],
  ],
  education: [
    ["education_early_childhood", "Early Childhood"],
    ["education_k_12", "K-12"],
    ["education_after_school", "After School"],
    ["education_tutoring", "Tutoring"],
    ["education_literacy", "Literacy"],
    ["education_esl_english", "ESL / English"],
    ["education_ged", "GED"],
    ["education_adult_education", "Adult Education"],
    ["education_higher_education", "Higher Education"],
    ["education_college_access", "College Access"],
    ["education_scholarships", "Scholarships"],
    ["education_financial_aid", "Financial Aid"],
    ["education_vocational_trade_school", "Vocational / Trade School"],
    ["education_stem", "STEM"],
    ["education_arts_education", "Arts Education"],
    ["education_special_education", "Special Education"],
    ["education_digital_literacy", "Digital Literacy"],
    ["education_career_counseling", "Career Counseling"],
    ["education_mentorship", "Mentorship"],
    ["education_life_skills", "Life Skills"],
  ],
  employment: [
    ["employment_job_search", "Job Search"],
    ["employment_resume_help", "Resume Help"],
    ["employment_interview_preparation", "Interview Preparation"],
    ["employment_career_coaching", "Career Coaching"],
    ["employment_workforce_development", "Workforce Development"],
    ["employment_skills_training", "Skills Training"],
    ["employment_apprenticeships", "Apprenticeships"],
    ["employment_certifications", "Certifications"],
    ["employment_internships", "Internships"],
    ["employment_entrepreneurship", "Entrepreneurship"],
    ["employment_small_business", "Small Business"],
    ["employment_professional_networking", "Professional Networking"],
  ],
  finance: [
    ["finance_cash_assistance", "Cash Assistance"],
    ["finance_emergency_assistance", "Urgent Assistance"],
    ["finance_benefits_enrollment", "Benefits Enrollment"],
    ["finance_public_benefits", "Public Benefits"],
    ["finance_tax_preparation", "Tax Preparation"],
    ["finance_financial_coaching", "Financial Coaching"],
    ["finance_budgeting", "Budgeting"],
    ["finance_banking", "Banking"],
    ["finance_credit_building", "Credit Building"],
    ["finance_debt_counseling", "Debt Counseling"],
    ["finance_microgrants", "Microgrants"],
    ["finance_small_business_funding", "Small Business Funding"],
  ],
  legal: [
    ["legal_legal_aid", "Legal Aid"],
    ["legal_immigration", "Immigration"],
    ["legal_family_law", "Family Law"],
    ["legal_housing_law", "Housing Law"],
    ["legal_consumer_protection", "Consumer Protection"],
    ["legal_civil_rights", "Civil Rights"],
    ["legal_reentry", "Reentry"],
    ["legal_expungement", "Expungement"],
    ["legal_mediation", "Mediation"],
    ["legal_identification_documentation", "Identification & Documentation"],
  ],
  family: [
    ["family_childcare", "Childcare"],
    ["family_parenting", "Parenting"],
    ["family_youth_services", "Youth Services"],
    ["family_seniors", "Seniors"],
    ["family_veterans", "Veterans"],
    ["family_lgbtq", "LGBTQ+"],
    ["family_domestic_violence", "Domestic Violence Support"],
    ["family_foster_care", "Foster Care"],
    ["family_adoption", "Adoption"],
    ["family_family_support", "Family Support"],
    ["family_caregivers", "Caregivers"],
  ],
  community: [
    ["community_faith_organizations", "Faith Organizations"],
    ["community_volunteer_opportunities", "Volunteer Opportunities"],
    ["community_community_organizing", "Community Organizing"],
    ["community_civic_engagement", "Civic Engagement"],
    ["community_voter_services", "Voter Services"],
    ["community_events", "Events"],
    ["community_recreation", "Recreation"],
    ["community_sports", "Sports"],
    ["community_arts_culture", "Arts & Culture"],
    ["community_libraries", "Libraries"],
    ["community_community_centers", "Community Centers"],
    ["community_transportation", "Transportation"],
    ["community_internet_access", "Internet Access"],
    ["community_device_access", "Device Access"],
    ["community_neighborhood_associations", "Neighborhood Associations"],
  ],
  emergency: [
    ["emergency_disaster_relief", "Disaster Relief"],
    ["emergency_crisis_response", "Crisis Response"],
    ["emergency_emergency_shelter", "Urgent Shelter"],
    ["emergency_emergency_food", "Urgent Food"],
    ["emergency_emergency_cash", "Urgent Cash"],
    ["emergency_mutual_aid", "Mutual Aid"],
    ["emergency_fire_recovery", "Fire Recovery"],
    ["emergency_flood_recovery", "Flood Recovery"],
    ["emergency_emergency_preparedness", "Disaster Preparedness"],
    ["emergency_disaster_recovery", "Disaster Recovery"],
  ],
  environment: [
    ["environment_climate", "Climate"],
    ["emergency_cooling_centers", "Cooling Centers"],
    ["emergency_warming_centers", "Warming Centers"],
    ["environment_agriculture", "Agriculture"],
    ["environment_food_systems", "Food Systems"],
    ["environment_community_gardens", "Community Gardens"],
    ["environment_conservation", "Conservation"],
    ["environment_sustainability", "Sustainability"],
    ["environment_environmental_justice", "Environmental Justice"],
    ["environment_energy", "Energy"],
    ["environment_water", "Water"],
    ["environment_air_quality", "Air Quality"],
    ["environment_pollution", "Pollution"],
    ["environment_recycling", "Recycling"],
    ["environment_land_use", "Land Use"],
    ["environment_parks_open_space", "Parks & Open Space"],
  ],
  safety: [
    ["safety_violence_prevention", "Violence Prevention"],
    ["safety_street_outreach", "Street Outreach"],
    ["safety_community_safety", "Community Safety"],
    ["safety_gun_violence_prevention", "Gun Violence Prevention"],
    ["safety_human_trafficking", "Human Trafficking"],
    ["safety_survivor_support", "Survivor Support"],
    ["safety_conflict_mediation", "Conflict Mediation"],
  ],
  organizations: [
    ["organizations_fiscal_sponsorship", "Fiscal Sponsorship"],
    ["organizations_capacity_building", "Capacity Building"],
    ["organizations_grant_support", "Grant Support"],
    ["organizations_fundraising", "Fundraising"],
    ["organizations_board_development", "Board Development"],
    ["organizations_strategic_planning", "Strategic Planning"],
    ["organizations_research", "Research"],
    ["organizations_technical_assistance", "Technical Assistance"],
    ["organizations_training", "Training"],
    ["organizations_volunteer_management", "Volunteer Management"],
  ],
  international: [
    ["international_refugee_services", "Refugee Services"],
    ["international_asylum_support", "Asylum Support"],
    ["international_humanitarian_aid", "Humanitarian Aid"],
    ["international_global_development", "Global Development"],
    ["international_disaster_response", "Disaster Response"],
    ["international_international_education", "International Education"],
  ],
  animals: [
    ["animals_animal_welfare", "Animal Welfare"],
    ["animals_pet_food_assistance", "Pet Food Assistance"],
    ["animals_veterinary_assistance", "Veterinary Assistance"],
    ["animals_rescue", "Rescue"],
    ["animals_adoption", "Adoption"],
    ["animals_wildlife_conservation", "Wildlife Conservation"],
  ],
} as const

export type PublicMapResourceSubcategoryKey =
  (typeof PUBLIC_MAP_RESOURCE_SUBCATEGORY_GROUPS)[PublicMapResourceTopLevelCategoryKey][number][0]

export type PublicMapResourceCategoryKey =
  | PublicMapResourceTopLevelCategoryKey
  | PublicMapResourceSubcategoryKey

export type PublicMapResourceCategoryDefinition = {
  key: PublicMapResourceCategoryKey
  label: string
  parentKey: PublicMapResourceTopLevelCategoryKey | null
  markerColor: string
  tailwindToken: string
  iconName: string
  aliases: string[]
  description: string
}

export const PUBLIC_MAP_RESOURCE_TOP_LEVEL_CATEGORY_DEFINITIONS = [
  {
    key: "health",
    label: "Health",
    parentKey: null,
    markerColor: "#059669",
    tailwindToken: "emerald-600",
    iconName: "heart-pulse",
    aliases: ["health", "medical", "clinic", "care access", "primary care"],
    description:
      "Health care, prevention, insurance, navigation, and recovery.",
  },
  {
    key: "food",
    label: "Food",
    parentKey: null,
    markerColor: "#2563eb",
    tailwindToken: "blue-600",
    iconName: "shopping-cart",
    aliases: ["food", "meal", "meals", "pantry", "groceries", "nutrition"],
    description: "Food access, groceries, meals, nutrition, and water support.",
  },
  {
    key: "housing",
    label: "Housing",
    parentKey: null,
    markerColor: "#4f46e5",
    tailwindToken: "indigo-600",
    iconName: "home",
    aliases: ["housing", "shelter", "homeless", "rent", "utility"],
    description:
      "Shelter, housing stability, rent, utilities, and home repair.",
  },
  {
    key: "education",
    label: "Education",
    parentKey: null,
    markerColor: "#f59e0b",
    tailwindToken: "amber-500",
    iconName: "graduation-cap",
    aliases: ["education", "school", "student", "learning", "literacy"],
    description: "Early childhood, K-12, adult learning, and college access.",
  },
  {
    key: "employment",
    label: "Employment",
    parentKey: null,
    markerColor: "#f97316",
    tailwindToken: "orange-500",
    iconName: "briefcase-business",
    aliases: ["employment", "jobs", "workforce", "career", "placement"],
    description: "Job search, skills, credentials, and entrepreneurship.",
  },
  {
    key: "finance",
    label: "Finance",
    parentKey: null,
    markerColor: "#0d9488",
    tailwindToken: "teal-600",
    iconName: "hand-coins",
    aliases: ["finance", "funding", "benefits", "cash", "tax", "credit"],
    description: "Assistance, benefits, taxes, coaching, credit, and grants.",
  },
  {
    key: "legal",
    label: "Legal",
    parentKey: null,
    markerColor: "#7c3aed",
    tailwindToken: "violet-600",
    iconName: "scale",
    aliases: ["legal", "rights", "immigration", "expungement", "law"],
    description: "Legal aid, rights, immigration, reentry, and documentation.",
  },
  {
    key: "family",
    label: "Family",
    parentKey: null,
    markerColor: "#db2777",
    tailwindToken: "pink-600",
    iconName: "heart-handshake",
    aliases: ["family", "childcare", "parenting", "youth", "seniors"],
    description:
      "Children, parents, seniors, caregivers, veterans, and LGBTQ+ support.",
  },
  {
    key: "community",
    label: "Community",
    parentKey: null,
    markerColor: "#16a34a",
    tailwindToken: "green-600",
    iconName: "users-round",
    aliases: ["community", "mutual aid", "neighbors", "transportation"],
    description:
      "Civic, cultural, recreation, transit, internet, and local support.",
  },
  {
    key: "emergency",
    label: "Crisis support",
    parentKey: null,
    markerColor: "#dc2626",
    tailwindToken: "red-600",
    iconName: "siren",
    aliases: ["emergency", "crisis", "disaster"],
    description:
      "Crisis response, urgent shelter, disaster relief, and recovery.",
  },
  {
    key: "environment",
    label: "Environment",
    parentKey: null,
    markerColor: "#65a30d",
    tailwindToken: "lime-600",
    iconName: "leaf",
    aliases: [
      "environment",
      "climate",
      "sustainability",
      "conservation",
      "water",
    ],
    description:
      "Climate, conservation, water, energy, parks, and environmental justice.",
  },
  {
    key: "safety",
    label: "Safety",
    parentKey: null,
    markerColor: "#2563eb",
    tailwindToken: "blue-600",
    iconName: "shield",
    aliases: ["safety", "violence prevention", "street outreach", "survivor"],
    description:
      "Violence prevention, survivor support, outreach, and mediation.",
  },
  {
    key: "organizations",
    label: "Organizations",
    parentKey: null,
    markerColor: "#0ea5e9",
    tailwindToken: "sky-500",
    iconName: "building-2",
    aliases: ["organizations", "nonprofit", "capacity", "fiscal sponsorship"],
    description:
      "Capacity building, grants, fundraising, training, and technical assistance.",
  },
  {
    key: "international",
    label: "International",
    parentKey: null,
    markerColor: "#0284c7",
    tailwindToken: "sky-600",
    iconName: "globe-2",
    aliases: ["international", "refugee", "asylum", "humanitarian", "global"],
    description:
      "Refugee, asylum, humanitarian, global development, and international education.",
  },
  {
    key: "animals",
    label: "Animals",
    parentKey: null,
    markerColor: "#9333ea",
    tailwindToken: "purple-600",
    iconName: "paw-print",
    aliases: ["animals", "pet", "veterinary", "rescue", "wildlife"],
    description:
      "Animal welfare, pet support, veterinary assistance, rescue, and wildlife.",
  },
] as const satisfies readonly PublicMapResourceCategoryDefinition[]

const PUBLIC_MAP_RESOURCE_TOP_LEVEL_CATEGORY_BY_KEY = Object.fromEntries(
  PUBLIC_MAP_RESOURCE_TOP_LEVEL_CATEGORY_DEFINITIONS.map((category) => [
    category.key,
    category,
  ])
) as Record<
  PublicMapResourceTopLevelCategoryKey,
  (typeof PUBLIC_MAP_RESOURCE_TOP_LEVEL_CATEGORY_DEFINITIONS)[number]
>

const PUBLIC_MAP_RESOURCE_SUBCATEGORY_ICON_OVERRIDES: Partial<
  Record<PublicMapResourceSubcategoryKey, string>
> = {
  food_community_fridges: "shopping-basket",
  community_libraries: "book-open",
  community_community_centers: "building-2",
  community_transportation: "bus",
  community_internet_access: "radio",
  community_device_access: "radio",
  emergency_warming_centers: "wind",
  emergency_crisis_response: "siren",
  emergency_disaster_relief: "siren",
  emergency_emergency_preparedness: "siren",
  health_crisis_hotlines: "radio",
  food_water: "droplets",
  housing_emergency_shelter: "bed",
  environment_water: "droplets",
  environment_parks_open_space: "leaf",
  animals_animal_welfare: "paw-print",
  animals_pet_food_assistance: "paw-print",
  animals_veterinary_assistance: "paw-print",
  animals_rescue: "paw-print",
  animals_adoption: "paw-print",
  animals_wildlife_conservation: "paw-print",
}

export const PUBLIC_MAP_RESOURCE_SUBCATEGORY_ORDER = Object.values(
  PUBLIC_MAP_RESOURCE_SUBCATEGORY_GROUPS
).flatMap((subcategories) =>
  subcategories.map(([key]) => key)
) as PublicMapResourceSubcategoryKey[]

export const PUBLIC_MAP_RESOURCE_SUBCATEGORY_DEFINITIONS = Object.entries(
  PUBLIC_MAP_RESOURCE_SUBCATEGORY_GROUPS
).flatMap(([parentKey, subcategories]) => {
  const typedParentKey = parentKey as PublicMapResourceTopLevelCategoryKey
  const parentDefinition =
    PUBLIC_MAP_RESOURCE_TOP_LEVEL_CATEGORY_BY_KEY[typedParentKey]

  return subcategories.map(([key, label]) => {
    const typedKey = key as PublicMapResourceSubcategoryKey
    const override =
      PUBLIC_MAP_RESOURCE_SUBCATEGORY_DEFINITION_OVERRIDES[typedKey]

    return {
      key,
      label,
      parentKey: typedParentKey,
      markerColor: override?.markerColor ?? parentDefinition.markerColor,
      tailwindToken: override?.tailwindToken ?? parentDefinition.tailwindToken,
      iconName:
        override?.iconName ??
        PUBLIC_MAP_RESOURCE_SUBCATEGORY_ICON_OVERRIDES[typedKey] ??
        parentDefinition.iconName,
      aliases: [label.toLowerCase(), ...(override?.aliases ?? [])],
      description:
        override?.description ??
        `${label} resources under ${parentDefinition.label}.`,
    }
  })
}) as PublicMapResourceCategoryDefinition[]

export const PUBLIC_MAP_RESOURCE_ALL_CATEGORY_ORDER = [
  ...PUBLIC_MAP_RESOURCE_CATEGORY_ORDER,
  ...PUBLIC_MAP_RESOURCE_SUBCATEGORY_ORDER,
] as PublicMapResourceCategoryKey[]

export const PUBLIC_MAP_RESOURCE_CATEGORY_DEFINITIONS = [
  ...PUBLIC_MAP_RESOURCE_TOP_LEVEL_CATEGORY_DEFINITIONS,
  ...PUBLIC_MAP_RESOURCE_SUBCATEGORY_DEFINITIONS,
] as PublicMapResourceCategoryDefinition[]

export const PUBLIC_MAP_RESOURCE_CATEGORY_LABELS = Object.fromEntries(
  PUBLIC_MAP_RESOURCE_CATEGORY_DEFINITIONS.map((category) => [
    category.key,
    category.label,
  ])
) as Record<PublicMapResourceCategoryKey, string>

export const PUBLIC_MAP_RESOURCE_CATEGORY_COLORS = Object.fromEntries(
  PUBLIC_MAP_RESOURCE_CATEGORY_DEFINITIONS.map((category) => [
    category.key,
    category.markerColor,
  ])
) as Record<PublicMapResourceCategoryKey, string>

const PUBLIC_MAP_RESOURCE_CATEGORY_DEFINITION_BY_KEY = Object.fromEntries(
  PUBLIC_MAP_RESOURCE_CATEGORY_DEFINITIONS.map((category) => [
    category.key,
    category,
  ])
) as Record<PublicMapResourceCategoryKey, PublicMapResourceCategoryDefinition>

const PUBLIC_MAP_RESOURCE_CATEGORY_PARENT_BY_KEY = Object.fromEntries(
  PUBLIC_MAP_RESOURCE_SUBCATEGORY_DEFINITIONS.map((category) => [
    category.key,
    category.parentKey,
  ])
) as Partial<
  Record<PublicMapResourceCategoryKey, PublicMapResourceTopLevelCategoryKey>
>

const PUBLIC_MAP_RESOURCE_LEGACY_CATEGORY_KEY_MAP: Record<
  string,
  PublicMapResourceCategoryKey
> = {
  community_resource: "community",
  dental: "health_dental",
  education_resource: "education",
  funding: "finance",
  jobs: "employment",
  legal_benefits: "legal",
  medical: "health",
  mental_health: "health_mental_health",
  online_media: "community_internet_access",
  shelter: "housing_emergency_shelter",
  transportation: "community_transportation",
  water: "food_water",
  womens_health: "health_womens_health",
}

function normalizeCategoryToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/\+/g, " plus ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

export function getPublicMapResourceCategoryDefinition(
  key: PublicMapResourceCategoryKey
) {
  return PUBLIC_MAP_RESOURCE_CATEGORY_DEFINITION_BY_KEY[key]
}

export function isPublicMapResourceTopLevelCategoryKey(
  value: unknown
): value is PublicMapResourceTopLevelCategoryKey {
  return PUBLIC_MAP_RESOURCE_CATEGORY_ORDER.includes(
    value as PublicMapResourceTopLevelCategoryKey
  )
}

export function isPublicMapResourceCategoryKey(
  value: unknown
): value is PublicMapResourceCategoryKey {
  return PUBLIC_MAP_RESOURCE_ALL_CATEGORY_ORDER.includes(
    value as PublicMapResourceCategoryKey
  )
}

export function resolvePublicMapResourceCategoryInputKey(
  value: unknown
): PublicMapResourceCategoryKey | null {
  if (typeof value !== "string") return null
  const raw = value.trim()
  if (!raw) return null
  const normalized = normalizeCategoryToken(raw)

  if (isPublicMapResourceCategoryKey(normalized)) return normalized

  const legacyKey = PUBLIC_MAP_RESOURCE_LEGACY_CATEGORY_KEY_MAP[normalized]
  if (legacyKey) return legacyKey

  const exactLabelMatch = PUBLIC_MAP_RESOURCE_CATEGORY_DEFINITIONS.find(
    (category) => normalizeCategoryToken(category.label) === normalized
  )
  if (exactLabelMatch) return exactLabelMatch.key

  const matchesAlias = createPublicMapCategoryAliasMatcher(raw)
  const aliasMatch = PUBLIC_MAP_RESOURCE_CATEGORY_DEFINITIONS.find((category) =>
    category.aliases.some(matchesAlias)
  )
  return aliasMatch?.key ?? null
}

export function resolvePublicMapResourceTopLevelCategory(
  key: PublicMapResourceCategoryKey
): PublicMapResourceTopLevelCategoryKey {
  return (
    PUBLIC_MAP_RESOURCE_CATEGORY_PARENT_BY_KEY[key] ??
    (key as PublicMapResourceTopLevelCategoryKey)
  )
}

export function publicMapResourceCategoryMatchesTopLevel({
  category,
  topLevelCategory,
}: {
  category: PublicMapResourceCategoryKey
  topLevelCategory: PublicMapResourceTopLevelCategoryKey
}) {
  return resolvePublicMapResourceTopLevelCategory(category) === topLevelCategory
}

export function resolvePublicMapResourceCategoryColor(
  key: PublicMapResourceCategoryKey | null | undefined
) {
  return PUBLIC_MAP_RESOURCE_CATEGORY_COLORS[key ?? "community"]
}
