/** Arithmetic only; never evaluates JavaScript or property/function access. */
export function calculateParticleExpression(input: string): number {
  if (!input.trim() || input.length > 240 || /[^\d.\s+\-*/()]/.test(input))
    throw new Error("Use numbers, parentheses, +, −, * and /.")
  const tokens = input.match(/\d+(?:\.\d*)?|\.\d+|[()+\-*/]/g) ?? []
  let cursor = 0
  const atom = (): number => {
    const token = tokens[cursor++]
    if (token === "+") return atom()
    if (token === "-") return -atom()
    if (token === "(") {
      const value = sum()
      if (tokens[cursor++] !== ")") throw new Error("Close the parentheses.")
      return value
    }
    if (!token || !/^\d|^\.\d/.test(token))
      throw new Error("Complete the calculation.")
    return Number(token)
  }
  const product = (): number => {
    let value = atom()
    while (tokens[cursor] === "*" || tokens[cursor] === "/") {
      const operator = tokens[cursor++]
      const next = atom()
      value = operator === "*" ? value * next : value / next
    }
    return value
  }
  const sum = (): number => {
    let value = product()
    while (tokens[cursor] === "+" || tokens[cursor] === "-") {
      const operator = tokens[cursor++]
      const next = product()
      value = operator === "+" ? value + next : value - next
    }
    return value
  }
  const value = sum()
  if (cursor !== tokens.length || !Number.isFinite(value))
    throw new Error("Enter a valid, finite calculation.")
  return value
}
