function normalizeCategorySearchText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function createPublicMapCategoryAliasMatcher(text: string) {
  const normalizedText = normalizeCategorySearchText(text)
  const searchableText = ` ${normalizedText} `

  return (alias: string) => {
    const normalizedAlias = normalizeCategorySearchText(alias)
    if (!normalizedAlias || !normalizedText) return false

    return searchableText.includes(` ${normalizedAlias} `)
  }
}

export function publicMapTextContainsCategoryAlias({
  alias,
  text,
}: {
  alias: string
  text: string
}) {
  return createPublicMapCategoryAliasMatcher(text)(alias)
}
