import type { DocumentEmbeddingDisclosure } from "../lib/document-embedding-policy"

export function ResearchEmbeddingDisclosure({ embedding }: { embedding: DocumentEmbeddingDisclosure }) {
  const processing = embedding.processing
  return <div className="space-y-1 break-words text-xs text-muted-foreground" aria-label="Document search processing">
    <p>Document search sends permitted document excerpts and search queries to {processing.provider} ({embedding.model}). Included in this run’s approved maximum; no background indexing.</p>
    <details>
      <summary className="flex min-h-11 w-fit cursor-pointer items-center rounded-sm focus-visible:outline-2 focus-visible:outline-ring">Document processing details</summary>
      <div className="space-y-1">
        <p>Destination: {processing.destination}</p>
        <p>Retention: {processing.retention}</p>
        <p>Training: {processing.training}</p>
        <p>Up to {embedding.maxCalls.toLocaleString()} calls, {embedding.maxInputBytes.toLocaleString()} UTF-8 bytes per call and {embedding.maxInputTokens.toLocaleString()} input tokens per run.</p>
        <p>Embedding rate: {new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 6 }).format(embedding.microdollarsPerMillion / 1_000_000)} per million input tokens.</p>
        <p>Confirmed embedding usage is included in the run’s charge. Failed or canceled runs charge zero credits.</p>
      </div>
    </details>
  </div>
}
