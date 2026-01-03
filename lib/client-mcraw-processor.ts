import { McrawDecoder } from "./mcraw-decoder"
import { DngEncoder } from "./dng-encoder"
import type { ProcessingSettings } from "./types"
import { analyzeMcrawStructure, logAnalysis } from "./mcraw-analyzer"

export interface ProcessedFrame {
  frameIndex: number
  dngBlob: Blob
  filename: string
}

export interface ProcessingResult {
  successfulFrames: number
  failedFrames: number
  totalFrames: number
}

/**
 * Memory-efficient MCRAW processor that:
 * 1. Loads full file for accurate frame boundary detection
 * 2. Processes frames one at a time
 * 3. Immediately triggers download for each frame
 * 4. Releases memory after each frame
 */
export async function processClientSideMcraw(
  file: File,
  settings: ProcessingSettings,
  onProgress?: (progress: number, currentFrame: number) => void,
  onFrameReady?: (frame: ProcessedFrame) => void,
): Promise<ProcessingResult> {
  console.log("[v0] Starting memory-efficient MCRAW processing")
  console.log("[v0] File size:", (file.size / 1024 / 1024).toFixed(2), "MB")

  console.log("[v0] Loading full file for accurate frame detection...")
  const fullBuffer = await file.arrayBuffer()
  const fileBytes = new Uint8Array(fullBuffer)
  console.log("[v0] File loaded into memory")

  console.log("[v0] Running binary structure analysis...")

  // Find JSON end offset for analyzer
  let jsonEndOffset = 0
  for (let i = 0; i < Math.min(fileBytes.length, 100000); i++) {
    if (fileBytes[i] === 0x7b) {
      // '{'
      let depth = 1
      let j = i + 1
      while (j < fileBytes.length && depth > 0) {
        if (fileBytes[j] === 0x7b) depth++
        else if (fileBytes[j] === 0x7d) depth--
        j++
      }
      if (depth === 0) {
        jsonEndOffset = j
        break
      }
    }
  }

  const analysis = analyzeMcrawStructure(fileBytes, jsonEndOffset)
  logAnalysis(analysis)

  const decoder = new McrawDecoder(fullBuffer)

  console.log("[v0] Parsing MCRAW metadata and scanning frames...")
  const metadata = await decoder.parse()

  if (!metadata) {
    throw new Error("Failed to parse MCRAW metadata")
  }

  const totalFrames = decoder.getFrameCount()
  console.log("[v0] Decoder reports", totalFrames, "frames available")

  if (totalFrames === 0) {
    throw new Error("No frames found in MCRAW file. The file may be corrupted or use an unsupported format.")
  }

  const startFrame = settings.frameRange?.start || 0
  const endFrame = Math.min(settings.frameRange?.end || totalFrames - 1, totalFrames - 1)
  const framesToProcess = endFrame - startFrame + 1

  console.log("[v0] Processing frames", startFrame, "to", endFrame, "(", framesToProcess, "frames)")

  let successfulFrames = 0
  let failedFrames = 0

  for (let i = startFrame; i <= endFrame; i++) {
    const progress = Math.round(((i - startFrame + 1) / framesToProcess) * 100)
    onProgress?.(progress, i + 1)

    try {
      const frame = await decoder.decodeFrame(i)

      if (!frame || !frame.bayerData || frame.bayerData.length === 0) {
        console.warn(`[v0] Frame ${i} has no data, skipping`)
        failedFrames++
        continue
      }

      const dngEncoder = new DngEncoder({
        software: "MCRAW Converter Web",
      })

      const dngBuffer = dngEncoder.encode(frame, metadata.cameraModel || "MotionCam")
      const dngBlob = new Blob([dngBuffer], { type: "image/x-adobe-dng" })

      const baseName = file.name.replace(/\.[^/.]+$/, "")
      const frameNum = String(i).padStart(5, "0")
      const filename = `${baseName}_frame_${frameNum}.dng`

      onFrameReady?.({
        frameIndex: i,
        dngBlob,
        filename,
      })

      successfulFrames++

      frame.bayerData = null as any

      await yieldToMain()
    } catch (error) {
      console.error(`[v0] Error processing frame ${i}:`, error)
      failedFrames++

      if (failedFrames > framesToProcess * 0.8) {
        throw new Error(
          `Too many frame failures (${failedFrames}/${framesToProcess}). File may be corrupted or use unsupported compression.`,
        )
      }
    }
  }

  if (successfulFrames === 0) {
    throw new Error("Failed to process any frames. The MCRAW file may use unsupported compression (zstd).")
  }

  console.log(
    "[v0] Processing complete:",
    successfulFrames,
    "successful,",
    failedFrames,
    "failed out of",
    framesToProcess,
    "frames",
  )

  return {
    successfulFrames,
    failedFrames,
    totalFrames: framesToProcess,
  }
}

/**
 * Yield to main thread to allow UI updates and garbage collection
 */
function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    if ("scheduler" in globalThis && "yield" in (globalThis as any).scheduler) {
      ;(globalThis as any).scheduler.yield().then(resolve)
    } else {
      setTimeout(resolve, 0)
    }
  })
}

/**
 * Download a single DNG file
 */
export function downloadDng(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)

  setTimeout(() => URL.revokeObjectURL(url), 100)
}

/**
 * Create a ZIP file from multiple DNG blobs (for batch download)
 * Uses streaming to avoid memory issues
 */
export async function createDngZipStream(
  frames: ProcessedFrame[],
  onProgress?: (progress: number) => void,
): Promise<Blob> {
  const { zipSync } = await import("fflate")

  const files: Record<string, Uint8Array> = {}

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]
    const buffer = await frame.dngBlob.arrayBuffer()
    files[frame.filename] = new Uint8Array(buffer)

    onProgress?.(Math.round(((i + 1) / frames.length) * 100))

    await yieldToMain()
  }

  const zipped = zipSync(files, { level: 0 })
  return new Blob([zipped], { type: "application/zip" })
}
