import Papa from "papaparse"
import { CONTACT_DETAIL_FIELDS } from "@/lib/people/contact-schema"
import type {
  ImportContact,
  ImportField,
  ImportMapping,
  ImportSource,
} from "../types"

export const MAX_PEOPLE_IMPORT_BYTES = 1_000_000
export const MAX_PEOPLE_IMPORT_ROWS = 500
export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  name: "Full name",
  firstName: "First name",
  lastName: "Last name",
  email: "Email",
  phone: "Phone",
  title: "Title",
  ...(Object.fromEntries(
    Object.entries(CONTACT_DETAIL_FIELDS).map(([key, field]) => [
      key,
      field.label,
    ])
  ) as Record<keyof typeof CONTACT_DETAIL_FIELDS, string>),
}
const aliases: Record<ImportField, string[]> = {
  name: ["name", "fullname", "displayname"],
  firstName: ["firstname", "givenname"],
  lastName: ["lastname", "familyname", "surname"],
  email: ["email", "emailaddress", "email1value", "email1"],
  phone: [
    "phone",
    "phonenumber",
    "phone1value",
    "mobilephone",
    "mobile",
    "businessphone",
  ],
  title: ["title", "jobtitle", "organization1title"],
  organization: ["organization", "company", "organization1name"],
  location: ["location", "city"],
  website: ["website", "url"],
  timezone: ["timezone"],
  relationshipStage: ["relationshipstage", "stage"],
  followUpDate: ["followupdate", "nextfollowup"],
}
const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "")
export function defaultImportMapping(headers: string[]): ImportMapping {
  return Object.fromEntries(
    Object.entries(aliases).map(([field, names]) => [
      field,
      headers.find((header) => names.includes(key(header))) ?? "",
    ])
  ) as ImportMapping
}
export function mappedContacts(
  source: ImportSource,
  mapping: ImportMapping
): ImportContact[] {
  const cell = (row: string[], field: ImportField) =>
    (row[source.headers.indexOf(mapping[field])] ?? "").trim()
  return source.rows.map((row) => ({
    name:
      cell(row, "name") ||
      [cell(row, "firstName"), cell(row, "lastName")].filter(Boolean).join(" "),
    email: cell(row, "email"),
    phone: cell(row, "phone"),
    title: cell(row, "title"),
    ...(Object.keys(CONTACT_DETAIL_FIELDS).some((field) =>
      cell(row, field as ImportField)
    )
      ? {
          details: Object.fromEntries(
            Object.keys(CONTACT_DETAIL_FIELDS).flatMap((field) => {
              const value = cell(row, field as ImportField)
              return value ? [[field, value]] : []
            })
          ),
        }
      : {}),
  }))
}
export function parsePeopleImport(
  source: string,
  filename: string
): ImportSource {
  if (new TextEncoder().encode(source).length > MAX_PEOPLE_IMPORT_BYTES)
    throw new Error("Choose a file smaller than 1 MB.")
  if (/\.vcf$/i.test(filename)) return parseVcard(source)
  if (!/\.csv$/i.test(filename))
    throw new Error("Choose a CSV or vCard (.vcf) file.")
  const result = Papa.parse<string[]>(source.replace(/^\uFEFF/, ""), {
    skipEmptyLines: "greedy",
    preview: MAX_PEOPLE_IMPORT_ROWS + 2,
  })
  if (result.errors.some((error) => error.code !== "UndetectableDelimiter"))
    throw new Error(
      "This CSV could not be read. Check its quotes and separators."
    )
  const [rawHeaders, ...rows] = result.data
  const headers = rawHeaders?.map((value) => value.trim()) ?? []
  if (
    !headers.length ||
    headers.length > 128 ||
    headers.some((value) => !value) ||
    new Set(headers.map((value) => value.toLowerCase())).size !== headers.length
  )
    throw new Error("Use up to 128 unique, non-empty column headings.")
  if (!rows.length) throw new Error("This file has no contacts.")
  if (rows.length > MAX_PEOPLE_IMPORT_ROWS)
    throw new Error("Import up to 500 contacts at a time.")
  if (rows.some((row) => row.length > headers.length))
    throw new Error("Some rows have more values than headings.")
  return { format: "csv", headers, rows }
}
function parseVcard(source: string): ImportSource {
  const unescape = (value: string) =>
    value.replace(/\\[nN]/g, " ").replace(/\\([,;\\])/g, "$1")
  const rows: string[][] = []
  let card: Record<string, string> | null = null
  for (const line of source
    .replace(/^\uFEFF/, "")
    .replace(/\r?\n[ \t]/g, "")
    .split(/\r?\n/)) {
    if (!line.trim()) continue
    if (/^BEGIN:VCARD$/i.test(line)) {
      if (card) throw new Error("This vCard is incomplete.")
      card = {}
      continue
    }
    if (/^END:VCARD$/i.test(line)) {
      if (!card || !["3.0", "4.0"].includes(card.VERSION))
        throw new Error("Export contacts as vCard 3.0 or 4.0.")
      rows.push([
        card.FN || card.N || "",
        card.EMAIL || "",
        (card.TEL || "").replace(/^tel:/i, ""),
        card.TITLE || "",
      ])
      if (rows.length > MAX_PEOPLE_IMPORT_ROWS)
        throw new Error("Import up to 500 contacts at a time.")
      card = null
      continue
    }
    if (!card) continue
    const colon = line.indexOf(":")
    if (colon < 0) continue
    const property = line.slice(0, colon)
    const field = property.split(";")[0].split(".").at(-1)!.toUpperCase()
    if (
      !["VERSION", "FN", "N", "EMAIL", "TEL", "TITLE"].includes(field) ||
      card[field]
    )
      continue
    if (/ENCODING=|CHARSET=(?!UTF-8)/i.test(property))
      throw new Error("Export an unencoded UTF-8 vCard 3.0 or 4.0.")
    const value = line.slice(colon + 1)
    card[field] =
      field === "N"
        ? value
            .split(/(?<!\\);/)
            .slice(0, 2)
            .reverse()
            .map(unescape)
            .join(" ")
            .trim()
        : unescape(value)
  }
  if (card) throw new Error("This vCard is incomplete.")
  if (!rows.length) throw new Error("This file has no contacts.")
  return { format: "vcf", headers: ["Name", "Email", "Phone", "Title"], rows }
}

export function parsePastedPeople(
  source: string,
  hasHeaders = true
): ImportSource {
  if (new TextEncoder().encode(source).length > MAX_PEOPLE_IMPORT_BYTES)
    throw new Error("Paste up to 1 MB at a time.")
  if (!hasHeaders) {
    const parsed = Papa.parse<string[]>(source, {
      skipEmptyLines: "greedy",
      preview: MAX_PEOPLE_IMPORT_ROWS + 1,
    })
    if (parsed.errors.some((error) => error.code !== "UndetectableDelimiter"))
      throw new Error("Check the pasted columns and quotes.")
    const width = Math.max(0, ...parsed.data.map((row) => row.length))
    source = Papa.unparse([
      Array.from({ length: width }, (_, i) => `Column ${i + 1}`),
      ...parsed.data,
    ])
  }
  return { ...parsePeopleImport(source, "pasted.csv"), format: "paste" }
}
