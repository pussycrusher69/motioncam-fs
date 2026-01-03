import { McrawDecoder, createThumbnail } from "./mcraw-decoder"
import type { McrawMetadata } from "./types"

/**
 * Parse MCRAW file metadata in the browser without uploading the full file
 */
export async function parseClientSideMcraw(file: File): Promise<{
  metadata: McrawMetadata
  thumbnail: string
}> {
  console.log("[v0] Parsing MCRAW file client-side:", file.name, file.size, "bytes")

  // Read file into ArrayBuffer
  const arrayBuffer = await file.arrayBuffer()

  // Parse metadata
  const decoder = new McrawDecoder(arrayBuffer)
  const fileMetadata = await decoder.parse()

  console.log("[v0] MCRAW metadata parsed:", fileMetadata.frameCount, "frames")

  // Generate thumbnail from first frame
  let thumbnailDataUrl = ""
  try {
    const frame = await decoder.decodeFrame(0)
    const thumbnail = createThumbnail(frame, 320)

    // Convert to canvas and data URL
    const canvas = document.createElement("canvas")
    canvas.width = thumbnail.width
    canvas.height = thumbnail.height
    const ctx = canvas.getContext("2d")

    if (ctx) {
      const imageData = new ImageData(thumbnail.rgbData, thumbnail.width, thumbnail.height)
      ctx.putImageData(imageData, 0, 0)
      thumbnailDataUrl = canvas.toDataURL("image/jpeg", 0.8)
    }
  } catch (error) {
    console.warn("[v0] Failed to generate thumbnail:", error)
  }

  // Convert to app metadata format
  const metadata: McrawMetadata = {
    id: crypto.randomUUID(),
    filename: file.name,
    size: file.size,
    width: fileMetadata.width,
    height: fileMetadata.height,
    frameCount: fileMetadata.frameCount,
    fps: fileMetadata.fps,
    duration: fileMetadata.duration,
    iso: fileMetadata.frames[0]?.iso || 100,
    exposureTime: formatExposureTime(fileMetadata.frames[0]?.exposureTime || 33333),
    aperture: `f/${fileMetadata.frames[0]?.aperture || 1.8}`,
    cameraModel: fileMetadata.cameraModel,
    sensorFormat: fileMetadata.sensorFormat,
    bitDepth: fileMetadata.bitDepth,
    hasQuadBayer: fileMetadata.hasQuadBayer,
    dateCreated: fileMetadata.dateCreated,
  }

  return { metadata, thumbnail: thumbnailDataUrl }
}

function formatExposureTime(microseconds: number): string {
  const seconds = microseconds / 1000000
  if (seconds >= 1) {
    return `${seconds.toFixed(1)}s`
  }
  const denominator = Math.round(1 / seconds)
  return `1/${denominator}`
}
