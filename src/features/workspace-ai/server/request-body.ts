import "server-only"

export async function readAiRequestBody(request: Request) {
  const limit=12000
  if (Number(request.headers.get("content-length"))>limit) throw new Error("Request is too large.")
  const reader=request.body?.getReader()
  if (!reader) throw new Error("Enter a request.")
  const chunks:Uint8Array[]=[]
  let bytes=0
  try {
    while (true) {
      const {done,value}=await reader.read()
      if(done) break
      bytes+=value.byteLength
      if(bytes>limit) { await reader.cancel(); throw new Error("Request is too large.") }
      chunks.push(value)
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown
  } finally { reader.releaseLock() }
}
