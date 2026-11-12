import type { DocumentEmbeddingDisclosure } from "@/features/workspace-ai/lib/document-embedding-policy"
// Synthetic transport terms only; no real provider or commercial qualification.
export const embeddingDisclosureFixture: DocumentEmbeddingDisclosure = {
  model: "embedding-fixture", dimensions: 2, microdollarsPerMillion: 100000,
  maxInputBytes: 100, maxInputTokens: 200, maxCalls: 3,
  processing: {
    provider: "Controlled fixture", destination: "In-process test transport",
    retention: "Synthetic fixture only; no remote retention",
    training: "No remote provider or training",
    qualification: "controlled-processing-v1", tokenizerQualification: "controlled-tokenizer-v1",
    tokenBound: "utf8_bytes", costPolicy: "on_demand_shared_run",
  },
}
