export type ComposerToken = { kind: "context" | "create"; start: number; end: number; query: string }
/** Only a typed token at the caret; emails, URLs, mention tokens and code stay prose. */
export function composerToken(value: string, caret: number): ComposerToken | null {
  const before = value.slice(0,caret)
  if ((before.match(/`/g)?.length ?? 0) % 2) return null
  const mention = /(?:^|[\s(])@([^\s@{}]*)$/.exec(before)
  if (mention) return { kind: "context", start: caret - mention[1].length - 1, end: caret, query: mention[1] }
  const slash = /^\s*\/([^/\n]*)$/.exec(before)
  return slash ? { kind: "create", start: before.indexOf("/"), end: caret, query: slash[1] } : null
}
export function replaceComposerToken(value: string, token: ComposerToken | null, caret: number, text: string) {
  const start = token?.start ?? caret, end = token?.end ?? caret
  const inserted = `${text} `
  return { value: value.slice(0,start) + inserted + value.slice(end), caret: start + inserted.length }
}
