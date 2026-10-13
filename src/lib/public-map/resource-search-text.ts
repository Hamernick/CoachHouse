export type PublicMapWeightedSearchField = {
  text: string
  weight: number
}

export function normalizePublicMapSearchText(value: string | null | undefined) {
  if (typeof value !== "string") return ""

  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase()
    .replace(/&/g, " and ")
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function tokenizePublicMapSearchQuery(query: string) {
  return [...new Set(normalizePublicMapSearchText(query).split(" "))].filter(
    Boolean
  )
}

function resolveTokenScore(
  fields: PublicMapWeightedSearchField[],
  token: string
) {
  let bestScore = Number.POSITIVE_INFINITY

  for (const field of fields) {
    const tokenIndex = field.text.indexOf(token)
    if (tokenIndex === -1) continue

    const wordBoundary = tokenIndex === 0 || field.text[tokenIndex - 1] === " "
    const positionScore = tokenIndex === 0 ? 0 : wordBoundary ? 1 : 3
    bestScore = Math.min(bestScore, field.weight * 10 + positionScore)
  }

  return bestScore
}

function resolvePhraseBoost(
  fields: PublicMapWeightedSearchField[],
  normalizedQuery: string
) {
  let bestBoost = 0

  for (const field of fields) {
    if (field.text === normalizedQuery) {
      bestBoost = Math.min(bestBoost, -100 + field.weight * 2)
      continue
    }
    if (field.text.startsWith(normalizedQuery)) {
      bestBoost = Math.min(bestBoost, -60 + field.weight * 2)
      continue
    }
    if (field.text.includes(` ${normalizedQuery}`)) {
      bestBoost = Math.min(bestBoost, -30 + field.weight * 2)
      continue
    }
    if (field.text.includes(normalizedQuery)) {
      bestBoost = Math.min(bestBoost, -10 + field.weight * 2)
    }
  }

  return bestBoost
}

export function scorePublicMapSearchFields({
  fields,
  query,
}: {
  fields: PublicMapWeightedSearchField[]
  query: string
}) {
  const normalizedQuery = normalizePublicMapSearchText(query)
  if (!normalizedQuery) return 0

  const tokens = tokenizePublicMapSearchQuery(normalizedQuery)
  let score = 0
  for (const token of tokens) {
    const tokenScore = resolveTokenScore(fields, token)
    if (!Number.isFinite(tokenScore)) return Number.POSITIVE_INFINITY
    score += tokenScore
  }

  return score + resolvePhraseBoost(fields, normalizedQuery)
}
