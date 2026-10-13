import type { ExternalResourceMapItem } from "@/lib/public-map/resource-map-items"
import type { PublicMapResourceCategoryKey } from "@/lib/public-map/resource-categories"
import type { NonprofitDirectoryItem } from "../nonprofit-types"

// Shared presentation shape, not a claim that an IRS identity is a verified service.
export function nonprofitDirectoryMapItem(
  item: NonprofitDirectoryItem,
  category: PublicMapResourceCategoryKey | null = null
): ExternalResourceMapItem {
  return {
    id: `nonprofit:${item.ein}`,
    itemType: "external_resource",
    title: item.name,
    subtitle: null,
    description: item.description,
    latitude: null,
    longitude: null,
    address: null,
    addressStreet: null,
    city: item.city,
    state: item.state,
    country: null,
    orgCategory: null,
    resourceCategories: category ? [category] : [],
    primaryResourceCategory: category ?? "community",
    verificationStatus: "external_data",
    visibility: "published",
    sourceLabel: "IRS filings",
    sourceUrl: null,
    lastVerifiedAt: null,
    aliases: [item.ein, `${item.ein.slice(0, 2)}-${item.ein.slice(2)}`],
    nonprofit: {
      ein: item.ein,
      websiteSourcePeriod: item.websiteSourcePeriod,
      phoneSourcePeriod: item.phoneSourcePeriod,
      descriptionSourcePeriod: item.descriptionSourcePeriod,
      websiteBasis: item.websiteBasis,
      phoneBasis: item.phoneBasis,
    },
    links: item.website
      ? [
          {
            id: "website",
            label: "Organization website",
            url: item.website,
            type: "website",
            domain: new URL(item.website).hostname,
            isPrimary: true,
          },
        ]
      : [],
    contacts: item.phone
      ? [
          {
            id: "phone",
            label: "Phone",
            value: item.phone,
            type: "phone",
            url: `tel:${item.phone}`,
            isPrimary: true,
          },
        ]
      : [],
  }
}
