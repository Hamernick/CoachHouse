const STREET_WORDS: Record<string, string> = {
  north: "n", south: "s", east: "e", west: "w", street: "st", road: "rd",
  avenue: "ave", boulevard: "blvd", drive: "dr", lane: "ln", court: "ct",
  place: "pl", parkway: "pkwy",
}
const normalize = (value: string | null) => (value ?? "").toLowerCase().replace(/[.,]/g, " ").replace(/\s+/g, " ").trim()

export function resourceStreetKey(item: { addressStreet: string | null; city: string | null; state: string | null; country: string | null }) {
  const city = normalize(item.city)
  let street = normalize(item.addressStreet)
  if (!city || !street || !normalize(item.state) || !/\d/.test(street)) return null
  // Some providers append the locality to address_line1. Keep unit/suite text.
  const citySuffix = street.indexOf(` ${city} `)
  if (citySuffix >= 0) {
    const suffix = street.slice(citySuffix + city.length + 2).split(" ")
    if (suffix[0] === normalize(item.state)) suffix.shift()
    if (/^\d{5}(?:-\d{4})?$/.test(suffix[0] ?? "")) suffix.shift()
    street = [street.slice(0, citySuffix), ...suffix].join(" ").trim()
  }
  street = street.split(" ").map((word) => STREET_WORDS[word] ?? word).join(" ")
  const country = normalize(item.country).replace(/^(us|usa|united states of america)$/, "united states")
  if (!country) return null
  return [street, city, normalize(item.state), country].join("|")
}

