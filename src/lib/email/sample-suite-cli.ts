import path from "node:path"
import { buildEmailSampleCatalog, EMAIL_SAMPLE_EXCEPTIONS } from "./sample-suite-catalog"
import { EMAIL_SAMPLE_RECIPIENT, sendEmailSampleSuite, writeEmailSamplePreviews } from "./sample-suite"

export async function runEmailSampleSuite(args: string[]) {
  let output: string | undefined, batch: string | undefined, shouldSend = false
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--send") shouldSend = true
    else if (args[index] === "--output") output = args[++index]
    else if (args[index] === "--batch") batch = args[++index]
    else throw new Error(`Unknown sample-suite argument: ${args[index]}`)
  }
  if (!output || output.startsWith("--")) throw new Error("Provide --output with a task-local artifact directory")
  if (shouldSend && !batch) throw new Error("Explicit --batch is required with --send")
  const directory = path.resolve(output)
  const samples = buildEmailSampleCatalog()
  await writeEmailSamplePreviews(directory, samples, EMAIL_SAMPLE_EXCEPTIONS)
  if (!shouldSend) return { mode: "preview", samples: samples.length, gallery: path.join(directory, "index.html") }
  // Load transport only for an explicit send; previews do not require provider credentials.
  const { sendResendEmail } = await import("./resend")
  const journal = await sendEmailSampleSuite({ output: directory, batch: batch!, samples, send: sendResendEmail })
  return { mode: "send", recipient: EMAIL_SAMPLE_RECIPIENT, accepted: journal.receipts.filter(({ status }) => status === "accepted").length, receipt: path.join(directory, `receipts-${batch}.json`) }
}
