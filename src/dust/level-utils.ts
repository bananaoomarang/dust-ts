export function b64decode(str: string): ArrayBuffer {
  const binary_string = window.atob(str)
  const len = binary_string.length
  const bytes = new Uint8Array(new ArrayBuffer(len))
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i)
  }
  return bytes
}

export async function compressLevel (data: Uint32Array) {
  const stream = new Blob([JSON.stringify(Array.from(data))], {
    type: 'application/json'
  }).stream()
  const compressedStream = stream.pipeThrough(new CompressionStream('gzip'))
  const res = new Response(compressedStream)
  const blob = await res.blob()
  const buffer = await blob.arrayBuffer()
  const compressedBase64 = btoa(
    String.fromCharCode(
      ...new Uint8Array(buffer)
    )
  );
  return compressedBase64
}

export async function decompressLevel (data: string) {
  const stream = new Blob([b64decode(data)], {
    type: 'application/json'
  }).stream()
  const decompressStream = stream.pipeThrough(
    new DecompressionStream('gzip')
  )
  const res = new Response(decompressStream)
  const blob = await res.blob()
  const json = await blob.text()
  return JSON.parse(json)
}
