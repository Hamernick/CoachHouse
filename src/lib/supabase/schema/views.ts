import type { Json } from "./json"

export type ResourceMapPublicItemsView = {
  Row: {
    item_id: string
    item_type: string
    organization_id: string
    service_id: string
    platform_org_id: string | null
    title: string
    subtitle: string | null
    description: string | null
    organization_name: string
    organization_tagline: string | null
    organization_description: string | null
    website_url: string | null
    donate_url: string | null
    logo_url: string | null
    favicon_url: string | null
    mission: string | null
    vision: string | null
    values: string[]
    aliases: string[]
    service_kind: string
    delivery_modes: string[]
    eligibility: string | null
    cost: string | null
    who_it_helps: string | null
    insurance_accepted: string | null
    intake_url: string | null
    appointment_info: string | null
    documents_needed: string[]
    accessibility_notes: string | null
    urgent_availability: string | null
    languages: string[]
    hours: Json
    timezone: string | null
    appointment_required: boolean
    availability_status: string
    availability_notes: string | null
    temporary_closed_until: string | null
    location_hours: Json
    coverage_area: string[]
    minimum_age: number | null
    maximum_age: number | null
    location_type: string | null
    address_line1: string | null
    address_line2: string | null
    city: string | null
    state: string | null
    county: string | null
    postal_code: string | null
    country: string | null
    latitude: number | null
    longitude: number | null
    geocoding_accuracy: string | null
    service_radius_miles: number | null
    location_url: string | null
    resource_categories: string[]
    primary_resource_category: string | null
    public_contacts: Json
    public_links: Json
    source_label: string | null
    source_url: string | null
    source_attribution: string | null
    verification_status: string
    last_verified_at: string | null
    last_updated_at: string
  }
  Relationships: []
}

export type PublicViews = {
  // Existing SQL projection; service-only reads preserve the publication filters.
  nonprofit_directory_public: {
    Row: { ein: string; name: string; state: string | null; search_document: unknown; item: Json }
    Relationships: []
  }
  resource_map_public_items: ResourceMapPublicItemsView
}
