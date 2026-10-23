import { createHash } from "node:crypto"
import { mkdir, open, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"

export const EMAIL_SAMPLE_RECIPIENT = "caleb@bandto.com"
export type EmailSample = { id: string; category: string; state: string; source: string; subject: string; html: string; text: string }
export type EmailSampleException = { provider: string; limitation: string }
type SampleMessage = { to: string; subject: string; html: string; text: string; idempotencyKey: string; omitUnsubscribeHeaders: true; tags: { name: string; value: string }[] }
type SampleSender = (message: SampleMessage) => Promise<{ ok: true; id: string | null } | { ok: false; error: string }>
type Receipt = { id: string; fingerprint: string; key: string; status: "attempting" | "accepted" | "rejected" | "uncertain"; providerId?: string | null; attemptedAt?: string; recordedAt?: string }
type Journal = { batch: string; recipient: string; receipts: Receipt[] }
const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;")
const safeName = /^[a-z0-9][a-z0-9-]{0,79}$/

export function sampleMessage(sample: EmailSample, index: number, total: number, batch: string): SampleMessage {
  if (!safeName.test(sample.id) || !safeName.test(batch)) throw new Error("Invalid sample or batch identifier")
  const subject = `[TEST ${String(index + 1).padStart(2, "0")}/${total}] ${sample.subject}`
  const fingerprint = createHash("sha256").update(JSON.stringify({ subject, html: sample.html, text: sample.text })).digest("hex")
  return { to: EMAIL_SAMPLE_RECIPIENT, subject, html: sample.html, text: sample.text, omitUnsubscribeHeaders: true,
    idempotencyKey: `email-sample/v1/${batch}/${sample.id}/${fingerprint}`,
    tags: [{ name: "category", value: "platform-email-sample" }, { name: "template", value: sample.id }] }
}

export async function writeEmailSamplePreviews(output: string, samples: EmailSample[], exceptions: EmailSampleException[]) {
  if (!samples.length || new Set(samples.map(({ id }) => id)).size !== samples.length) throw new Error("Sample catalog must contain unique entries")
  await mkdir(output, { recursive: true, mode: 0o700 })
  for (const sample of samples) {
    sampleMessage(sample, 0, samples.length, "preview")
    await writeFile(path.join(output, `${sample.id}.html`), sample.html, { mode: 0o600 })
    await writeFile(path.join(output, `${sample.id}.txt`), sample.text, { mode: 0o600 })
  }
  const coverage = samples.map(({ id, category, state, source, subject }) => ({ id, category, state, source, subject, html: `${id}.html`, text: `${id}.txt` }))
  await writeFile(path.join(output, "coverage.json"), JSON.stringify({ recipient: EMAIL_SAMPLE_RECIPIENT, fictionalData: true, samples: coverage, exceptions }, null, 2), { mode: 0o600 })
  const cards = samples.map((sample) => `<article><h2>${escapeHtml(sample.subject)}</h2><p>${escapeHtml(sample.category)} / ${escapeHtml(sample.state)} · <a href="${sample.id}.html">HTML</a> · <a href="${sample.id}.txt">Plain text</a></p><iframe title="${escapeHtml(sample.subject)}" sandbox src="${sample.id}.html" loading="lazy"></iframe></article>`).join("")
  await writeFile(path.join(output, "index.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Coach House email previews</title><style>body{margin:32px auto;max-width:760px;padding:0 20px;font:16px/1.5 Arial;color:#171717;background:#fff}h1{font-size:28px}h2{font-size:19px}article{margin:40px 0}iframe{width:100%;height:640px;border:1px solid #ddd}p{color:#555}a{color:#171717}</style></head><body><h1>Coach House email previews</h1><p>${samples.length} fictional samples. Preview links cannot perform account or workflow actions. Sending is separate and restricted to ${EMAIL_SAMPLE_RECIPIENT}.</p>${cards}<h2>Provider coverage</h2><ul>${exceptions.map((entry) => `<li><strong>${escapeHtml(entry.provider)}:</strong> ${escapeHtml(entry.limitation)}</li>`).join("")}</ul></body></html>`, { mode: 0o600 })
}

export async function sendEmailSampleSuite({ output, batch, samples, send, pause = () => new Promise<void>((resolve) => setTimeout(resolve, 600)) }: { output: string; batch: string; samples: EmailSample[]; send: SampleSender; pause?: () => Promise<void> }) {
  if (!samples.length || new Set(samples.map(({ id }) => id)).size !== samples.length) throw new Error("Sample catalog must contain unique entries")
  const messages = samples.map((sample, index) => sampleMessage(sample, index, samples.length, batch))
  await mkdir(output, { recursive: true, mode: 0o700 })
  const lockPath = path.join(output, "send.lock")
  const lock = await open(lockPath, "wx", 0o600).catch(() => { throw new Error("Sample send is locked; verify the previous process before continuing") })
  const receiptPath = path.join(output, `receipts-${batch}.json`)
  try {
    const previous = await readFile(receiptPath, "utf8").catch((error: NodeJS.ErrnoException) => { if (error.code === "ENOENT") return null; throw error })
    const journal: Journal = previous ? JSON.parse(previous) : { batch, recipient: EMAIL_SAMPLE_RECIPIENT, receipts: [] }
    if (journal.batch !== batch || journal.recipient !== EMAIL_SAMPLE_RECIPIENT || !Array.isArray(journal.receipts)) throw new Error("Invalid sample receipt journal")
    const persist = async () => {
      await writeFile(`${receiptPath}.tmp`, JSON.stringify(journal, null, 2), { mode: 0o600 })
      await rename(`${receiptPath}.tmp`, receiptPath)
    }
    for (let index = 0; index < messages.length; index += 1) {
      const message = messages[index], id = samples[index].id
      const fingerprint = message.idempotencyKey.split("/").at(-1)!
      const existing = journal.receipts.find((receipt) => receipt.id === id)
      if (existing && (existing.fingerprint !== fingerprint || existing.key !== message.idempotencyKey)) throw new Error("Sample content changed; use a new batch after reviewing the previous delivery")
      if (existing?.status === "accepted") continue
      if (existing?.status === "attempting" || existing?.status === "uncertain") throw new Error("Uncertain delivery; verify provider state before any retry")
      // The transport does not distinguish all non-2xx outcomes. A failure is
      // therefore never permission to send again automatically.
      if (existing?.status === "rejected") throw new Error("Previous sample was rejected; verify provider state before any retry")
      const receipt: Receipt = existing ?? { id, fingerprint, key: message.idempotencyKey, status: "attempting" }
      if (!existing) journal.receipts.push(receipt)
      receipt.status = "attempting"
      receipt.attemptedAt = new Date().toISOString()
      await persist()
      try {
        const result = await send(message)
        receipt.status = result.ok ? "accepted" : "rejected"
        if (result.ok) receipt.providerId = result.id
      } catch {
        receipt.status = "uncertain"
      }
      receipt.recordedAt = new Date().toISOString()
      await persist()
      if (receipt.status !== "accepted") throw new Error(receipt.status === "uncertain" ? "Uncertain delivery; verify provider state before any retry" : "Provider rejected sample; inspect provider status before retrying")
      if (index < messages.length - 1) await pause()
    }
    return journal
  } finally {
    await lock.close()
    const { unlink } = await import("node:fs/promises")
    await unlink(lockPath)
  }
}
