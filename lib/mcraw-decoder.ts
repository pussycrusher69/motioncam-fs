/**
 * MCRAW Decoder Library
 *
 * JavaScript implementation to parse and decode MCRAW files from MotionCam Pro.
 * Based on: https://github.com/xtrul/motioncam-decoder
 *           https://github.com/LeonardSander/motioncam-fs
 *
 * MCRAW Container Structure:
 * 1. JSON metadata block (starts with '{', ends with matching '}')
 * 2. Frame data blocks with format: [4-byte type][4-byte size][data]
 *    - Type 2: Video frame data (zstd compressed or raw)
 *    - Type 3: Audio data
 */

import * as fzstd from "fzstd"

// Block types
const BLOCK_TYPE_FRAME = 2
const BLOCK_TYPE_AUDIO = 3

// MCRAW constants
const MCRAW_MAGIC = new Uint8Array([0x4d, 0x43, 0x52, 0x41, 0x57]) // "MCRAW"
const ZSTD_MAGIC = new Uint8Array([0x28, 0xb5, 0x2f, 0xfd])

export interface McrawFrameMetadata {
  width: number
  height: number
  bitsPerSample: number
  cfaPattern: string
  iso: number
  exposureTime: number
  aperture: number
  focalLength: number
  timestamp: number
  blackLevel: number[]
  whiteLevel: number
  colorMatrix?: number[][]
  forwardMatrix?: number[][]
  cameraNeutral?: number[]
  noiseProfile?: number[][]
  orientation?: number
}

export interface McrawFileMetadata {
  cameraModel: string
  cameraManufacturer: string
  sensorFormat: string
  width: number
  height: number
  frameCount: number
  fps: number
  duration: number
  bitDepth: number
  hasQuadBayer: boolean
  hasAudio: boolean
  audioSampleRate?: number
  audioChannels?: number
  frames: McrawFrameMetadata[]
  dateCreated: string
  softwareVersion?: string
  frameDetectionConfidence?: "high" | "medium" | "low"
  originalFps?: number
}

export interface DecodedFrame {
  frameIndex: number
  width: number
  height: number
  bayerData: Uint16Array
  metadata: McrawFrameMetadata
  timestamp: number
}

interface FrameInfo {
  offset: number
  size: number
  blockType: number
  isCompressed: boolean
  timestamp: number
  perFrameMetadata?: {
    iso?: number
    exposureTime?: number
    timestamp?: number
  }
}

export class McrawDecoder {
  private data: ArrayBuffer
  private view: DataView
  private bytes: Uint8Array
  private metadata: McrawFileMetadata | null = null
  private rawMetadata: any = null
  private frameInfos: FrameInfo[] = []
  private frameDataStart = 0
  private dataStartOffset = 0

  constructor(data: ArrayBuffer) {
    this.data = data
    this.view = new DataView(data)
    this.bytes = new Uint8Array(data)
  }

  getFrameCount(): number {
    return this.frameInfos.length
  }

  getMetadata(): McrawFileMetadata | null {
    return this.metadata
  }

  /**
   * Parse the MCRAW file
   */
  async parse(): Promise<McrawFileMetadata> {
    console.log("[v0] Starting MCRAW parse, file size:", this.data.byteLength)

    // Step 1: Find and parse JSON metadata
    const jsonResult = this.findJsonMetadata()
    if (!jsonResult) {
      throw new Error("Failed to find JSON metadata in MCRAW file")
    }

    this.rawMetadata = jsonResult.metadata
    this.frameDataStart = jsonResult.endOffset
    this.dataStartOffset = jsonResult.endOffset

    console.log("[v0] JSON metadata found, frame data starts at:", this.frameDataStart)
    console.log("[v0] Raw metadata keys:", Object.keys(this.rawMetadata))

    // Log numSegments if available - this tells us expected frame count
    if (this.rawMetadata.numSegments) {
      console.log("[v0] Expected frames (numSegments):", this.rawMetadata.numSegments)
    }

    // Step 2: Scan for frame blocks starting from where JSON ends
    this.scanFrameBlocks(this.frameDataStart)

    console.log("[v0] Scan complete:", this.frameInfos.length, "frames detected")

    // Step 3: Calculate FPS
    const calculatedFps = this.calculateFpsFromTimestamps()

    // Step 4: Build normalized metadata
    this.metadata = this.buildMetadata(calculatedFps)

    console.log("[v0] Parse complete:", this.frameInfos.length, "frames, FPS:", this.metadata.fps)

    return this.metadata
  }

  /**
   * Find JSON metadata block in the file
   */
  private findJsonMetadata(): { metadata: any; endOffset: number } | null {
    // Check for standard MCRAW header first
    let isMcrawHeader = true
    for (let i = 0; i < MCRAW_MAGIC.length && i < this.bytes.length; i++) {
      if (this.bytes[i] !== MCRAW_MAGIC[i]) {
        isMcrawHeader = false
        break
      }
    }

    if (isMcrawHeader && this.bytes.length > 15) {
      console.log("[v0] Standard MCRAW header detected")
      const metadataOffset = this.view.getUint32(7, true)
      const metadataSize = this.view.getUint32(11, true)

      if (metadataOffset > 0 && metadataSize > 0 && metadataOffset + metadataSize <= this.bytes.length) {
        const jsonBytes = this.bytes.slice(metadataOffset, metadataOffset + metadataSize)
        const jsonStr = new TextDecoder().decode(jsonBytes)
        try {
          const metadata = JSON.parse(jsonStr)
          return { metadata, endOffset: metadataOffset + metadataSize }
        } catch (e) {
          console.warn("[v0] Failed to parse JSON from standard header location")
        }
      }
    }

    // Alternative: Find JSON block by scanning for '{'
    console.log("[v0] Scanning for JSON metadata block...")

    let jsonStart = -1
    let jsonEnd = -1
    let braceCount = 0
    const scanLimit = Math.min(this.bytes.length, 50 * 1024 * 1024)

    for (let i = 0; i < scanLimit; i++) {
      if (this.bytes[i] === 0x7b && jsonStart === -1) {
        jsonStart = i
        braceCount = 1
      } else if (jsonStart !== -1) {
        if (this.bytes[i] === 0x7b) braceCount++
        else if (this.bytes[i] === 0x7d) {
          braceCount--
          if (braceCount === 0) {
            jsonEnd = i + 1
            break
          }
        }
      }
    }

    if (jsonStart === -1 || jsonEnd === -1) {
      console.error("[v0] No JSON metadata found in file")
      return null
    }

    console.log("[v0] JSON found at:", jsonStart, "-", jsonEnd, "size:", jsonEnd - jsonStart)

    const jsonBytes = this.bytes.slice(jsonStart, jsonEnd)
    const jsonStr = new TextDecoder().decode(jsonBytes)

    try {
      const metadata = JSON.parse(jsonStr)
      return { metadata, endOffset: jsonEnd }
    } catch (e) {
      console.error("[v0] Failed to parse JSON metadata:", e)
      return null
    }
  }

  /**
   * Scan for frame blocks in the file data
   * Tries multiple strategies:
   * 1. Type-prefixed blocks: [4-byte type][4-byte size][data]
   * 2. Size-prefixed zstd: [4-byte size][zstd data]
   * 3. Direct zstd magic scan
   * 4. Fixed-size based on numSegments
   * 5. Raw uncompressed Bayer data based on resolution
   */
  private scanFrameBlocks(startOffset: number): void {
    console.log("[v0] Scanning for frames starting at offset:", startOffset)

    const dumpBytes: string[] = []
    for (let i = startOffset; i < Math.min(startOffset + 64, this.bytes.length); i++) {
      dumpBytes.push(this.bytes[i].toString(16).padStart(2, "0"))
    }
    console.log("[v0] First 64 bytes after JSON:", dumpBytes.join(" "))

    // Strategy 1: Try type-prefixed block format [type:u32][size:u32][data]
    let blocksFound = this.scanTypePrefixedBlocks(startOffset)
    if (blocksFound > 0) {
      console.log("[v0] Strategy 1 (type-prefixed): Found", blocksFound, "frames")
      return
    }

    // Strategy 2: Try size-prefixed format [size:u32][data] where data starts with zstd magic
    blocksFound = this.scanSizePrefixedZstd(startOffset)
    if (blocksFound > 0) {
      console.log("[v0] Strategy 2 (size-prefixed zstd): Found", blocksFound, "frames")
      return
    }

    // Strategy 3: Scan for zstd magic bytes directly
    blocksFound = this.scanZstdMagic(startOffset)
    if (blocksFound > 0) {
      console.log("[v0] Strategy 3 (zstd magic scan): Found", blocksFound, "frames")
      return
    }

    // Strategy 4: Use numSegments and calculate fixed frame size
    blocksFound = this.applyFixedFrameSize(startOffset)
    if (blocksFound > 0) {
      console.log("[v0] Strategy 4 (fixed size from numSegments): Found", blocksFound, "frames")
      return
    }

    // Strategy 5: Try raw uncompressed Bayer data based on resolution
    blocksFound = this.scanRawBayerBlocks(startOffset)
    if (blocksFound > 0) {
      console.log("[v0] Strategy 5 (raw Bayer blocks): Found", blocksFound, "frames")
      return
    }

    console.log("[v0] WARNING: No frames detected with any strategy!")
  }

  private scanTypePrefixedBlocks(startOffset: number): number {
    const BLOCK_TYPE_FRAME = 2
    const BLOCK_TYPE_AUDIO = 3

    let offset = startOffset
    const view = new DataView(this.data)

    // Calculate expected uncompressed frame size for comparison
    const width = this.rawMetadata?.cameraMetadata?.sensorWidth || 4032
    const height = this.rawMetadata?.cameraMetadata?.sensorHeight || 3024
    const expected12BitSize = Math.floor((width * height * 12) / 8) // 12-bit packed
    const expected16BitSize = width * height * 2 // 16-bit

    console.log(`[v0] Expected sizes: 12-bit=${expected12BitSize}, 16-bit=${expected16BitSize}`)

    let frameCount = 0
    let audioCount = 0
    let consecutiveInvalidCount = 0
    const maxConsecutiveInvalid = 5

    let currentFrameMetadata: any = null

    let blocksParsed = 0

    while (offset < this.data.byteLength - 8 && consecutiveInvalidCount < maxConsecutiveInvalid) {
      if (offset + 8 > this.data.byteLength) break

      const blockType = view.getUint32(offset, true)
      const blockSize = view.getUint32(offset + 4, true)

      if (blocksParsed < 10) {
        console.log(
          `[v0] Block ${blocksParsed}: offset=${offset}, type=${blockType}, size=${blockSize}, remaining=${this.data.byteLength - offset}`,
        )
      }
      blocksParsed++

      // Validate block
      const isValidFrame = blockType === BLOCK_TYPE_FRAME && blockSize >= 1024 && blockSize <= 50 * 1024 * 1024
      const isValidAudio = blockType === BLOCK_TYPE_AUDIO && blockSize >= 100 && blockSize <= 10 * 1024 * 1024

      if (!isValidFrame && !isValidAudio) {
        if (blocksParsed <= 10) {
          console.log(`[v0] Block ${blocksParsed - 1} INVALID: type=${blockType} (want 2 or 3), size=${blockSize}`)
        }
        consecutiveInvalidCount++
        offset++
        continue
      }

      if (isValidFrame) {
        const dataOffset = offset + 8

        const isCompressed = blockSize < expected12BitSize * 0.9

        const frameMetadata = currentFrameMetadata || {}

        this.frameInfos.push({
          offset: dataOffset,
          size: blockSize,
          blockType: BLOCK_TYPE_FRAME,
          timestamp: frameMetadata.timestamp || frameCount * (1000000 / 24),
          isCompressed: isCompressed,
          perFrameMetadata: frameMetadata,
        })

        frameCount++
        consecutiveInvalidCount = 0
        offset += 8 + blockSize

        // Reset frame metadata after using it
        currentFrameMetadata = null
      } else if (isValidAudio) {
        const audioData = this.bytes.slice(offset + 8, offset + 8 + blockSize)

        try {
          const audioJson = new TextDecoder().decode(audioData)
          const audioMetadata = JSON.parse(audioJson)

          // Store metadata for next frame
          currentFrameMetadata = audioMetadata

          if (audioCount < 3) {
            console.log(`[v0] Audio block ${audioCount}: keys =`, Object.keys(audioMetadata))
          }
        } catch (e) {
          // Not JSON, probably actual audio data
          if (audioCount < 3) {
            console.log(`[v0] Audio block ${audioCount}: binary audio data, ${blockSize} bytes`)
          }
        }

        audioCount++
        consecutiveInvalidCount = 0
        offset += 8 + blockSize
      }
    }

    console.log(`[v0] Type-prefixed scan: ${frameCount} frames, ${audioCount} audio blocks`)
    return frameCount
  }

  private scanSizePrefixedZstd(startOffset: number): number {
    let offset = startOffset

    while (offset < this.bytes.length - 8) {
      const size = this.view.getUint32(offset, true)

      // Check if next 4 bytes after size are zstd magic
      if (size >= 1024 && size <= 50 * 1024 * 1024 && offset + 4 + size <= this.bytes.length) {
        if (this.isZstdCompressed(offset + 4)) {
          this.frameInfos.push({
            offset: offset + 4,
            size: size,
            blockType: BLOCK_TYPE_FRAME,
            isCompressed: true,
            timestamp: this.frameInfos.length * (1000 / 24),
          })
          offset += 4 + size
          continue
        }
      }
      break
    }

    return this.frameInfos.length
  }

  private scanZstdMagic(startOffset: number): number {
    const frameOffsets: number[] = []

    // Find all zstd magic signatures
    for (let i = startOffset; i < this.bytes.length - 4; i++) {
      if (
        this.bytes[i] === 0x28 &&
        this.bytes[i + 1] === 0xb5 &&
        this.bytes[i + 2] === 0x2f &&
        this.bytes[i + 3] === 0xfd
      ) {
        frameOffsets.push(i)
        i += 100
      }
    }

    console.log("[v0] Found", frameOffsets.length, "zstd signatures")

    // If we found zstd signatures, create frame infos
    for (let i = 0; i < frameOffsets.length; i++) {
      const offset = frameOffsets[i]
      const nextOffset = i < frameOffsets.length - 1 ? frameOffsets[i + 1] : this.bytes.length
      const size = nextOffset - offset

      if (size >= 100 && size <= 100 * 1024 * 1024) {
        this.frameInfos.push({
          offset,
          size,
          blockType: BLOCK_TYPE_FRAME,
          isCompressed: true,
          timestamp: i * (1000 / 24),
        })
      }
    }

    return this.frameInfos.length
  }

  private applyFixedFrameSize(startOffset: number): number {
    const numSegments = this.rawMetadata.numSegments
    if (!numSegments || numSegments <= 0) {
      return 0
    }

    const dataSize = this.bytes.length - startOffset
    const frameSize = Math.floor(dataSize / numSegments)

    console.log("[v0] Using fixed frame size:", frameSize, "for", numSegments, "segments")

    if (frameSize < 1024) {
      console.log("[v0] Frame size too small, skipping fixed size strategy")
      return 0
    }

    for (let i = 0; i < numSegments; i++) {
      const offset = startOffset + i * frameSize
      if (offset + frameSize <= this.bytes.length) {
        this.frameInfos.push({
          offset,
          size: frameSize,
          blockType: BLOCK_TYPE_FRAME,
          isCompressed: this.isZstdCompressed(offset),
          timestamp: i * (1000 / 24),
        })
      }
    }

    return this.frameInfos.length
  }

  private scanRawBayerBlocks(startOffset: number): number {
    // Get expected frame size from metadata
    const width =
      this.rawMetadata?.cameraMetadata?.imageSensorMetadata?.outputWidth ||
      this.rawMetadata?.device?.forwardMatrix?.length > 0
        ? 4032
        : 0
    const height =
      this.rawMetadata?.cameraMetadata?.imageSensorMetadata?.outputHeight ||
      this.rawMetadata?.device?.forwardMatrix?.length > 0
        ? 3024
        : 0

    if (width === 0 || height === 0) {
      console.log("[v0] Cannot determine resolution for raw Bayer scan")
      return 0
    }

    // Bayer data: width * height * 2 bytes (16-bit)
    const expectedFrameSize = width * height * 2
    console.log("[v0] Expected raw frame size:", expectedFrameSize, "bytes (", width, "x", height, ")")

    const dataSize = this.bytes.length - startOffset
    const possibleFrames = Math.floor(dataSize / expectedFrameSize)

    if (possibleFrames === 0) {
      // Try with compression - compressed might be ~10-30% of raw size
      const compressedEstimate = expectedFrameSize * 0.15 // ~15% compression ratio
      console.log("[v0] No raw frames fit, trying compressed estimate:", compressedEstimate)
      return 0
    }

    console.log("[v0] Possible raw frames:", possibleFrames)

    for (let i = 0; i < possibleFrames; i++) {
      const offset = startOffset + i * expectedFrameSize
      this.frameInfos.push({
        offset,
        size: expectedFrameSize,
        blockType: BLOCK_TYPE_FRAME,
        isCompressed: false,
        timestamp: i * (1000 / 24),
      })
    }

    return this.frameInfos.length
  }

  private isZstdCompressed(offset: number): boolean {
    if (offset + 4 > this.bytes.length) return false
    return (
      this.bytes[offset] === 0x28 &&
      this.bytes[offset + 1] === 0xb5 &&
      this.bytes[offset + 2] === 0x2f &&
      this.bytes[offset + 3] === 0xfd
    )
  }

  /**
   * Calculate FPS from frame timestamps using median delta
   */
  private calculateFpsFromTimestamps(): number {
    if (this.frameInfos.length < 2) {
      return 24
    }

    const deltas: number[] = []
    for (let i = 1; i < this.frameInfos.length; i++) {
      const delta = this.frameInfos[i].timestamp - this.frameInfos[i - 1].timestamp
      if (delta > 0) {
        deltas.push(delta)
      }
    }

    if (deltas.length === 0) {
      console.log("[v0] No valid timestamp deltas found, defaulting to 24fps")
      return 24
    }

    deltas.sort((a, b) => a - b)
    const medianDelta = deltas[Math.floor(deltas.length / 2)]

    console.log("[v0] Timestamp analysis: medianDelta =", medianDelta, "deltas sample:", deltas.slice(0, 5))

    let rawFps: number
    if (medianDelta > 10000000) {
      // Likely nanoseconds (delta ~41666666 for 24fps)
      rawFps = 1000000000 / medianDelta
      console.log("[v0] Timestamps appear to be in nanoseconds, rawFps:", rawFps)
    } else if (medianDelta > 10000) {
      // Likely microseconds (delta ~41666 for 24fps)
      rawFps = 1000000 / medianDelta
      console.log("[v0] Timestamps appear to be in microseconds, rawFps:", rawFps)
    } else if (medianDelta > 10) {
      // Likely milliseconds (delta ~41.6 for 24fps)
      rawFps = 1000 / medianDelta
      console.log("[v0] Timestamps appear to be in milliseconds, rawFps:", rawFps)
    } else {
      // Very small deltas - might be seconds or frame count
      rawFps = 1 / medianDelta
      console.log("[v0] Timestamps appear to be in seconds, rawFps:", rawFps)
    }

    // Round to common frame rates if close
    const commonRates = [18, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 120]
    for (const rate of commonRates) {
      if (Math.abs(rawFps - rate) / rate < 0.05) {
        console.log("[v0] Rounded FPS from", rawFps, "to common rate:", rate)
        return rate
      }
    }

    const result = Math.round(rawFps)
    console.log("[v0] Using calculated FPS:", result)
    return result > 0 && result < 1000 ? result : 24
  }

  /**
   * Build normalized metadata
   */
  private buildMetadata(calculatedFps: number): McrawFileMetadata {
    const raw = this.rawMetadata
    const extraData = raw.extraData || {}
    const postProcess = extraData.postProcessSettings || {}
    const deviceMeta = postProcess.metadata || {}

    // Extract dimensions from all possible locations
    const width = raw.width || raw.sensorWidth || deviceMeta.width || extraData.width || 4032
    const height = raw.height || raw.sensorHeight || deviceMeta.height || extraData.height || 3024

    // Extract FPS - prefer metadata over calculated
    let fps = calculatedFps
    const metaFps = raw.fps || raw.frameRate || extraData.fps || extraData.frameRate || postProcess.fps
    if (metaFps && metaFps > 0 && metaFps < 1000) {
      fps = metaFps
      console.log("[v0] Using FPS from metadata:", fps)
    }

    // Extract ISO from all possible locations
    const iso = this.extractIso()
    console.log("[v0] Extracted ISO:", iso)

    // Extract exposure
    const exposureTime =
      raw.exposureTime || raw.shutterSpeed || deviceMeta.exposureTime || extraData.exposureTime || 0.033

    // Extract aperture
    const aperture =
      raw.aperture || deviceMeta.aperture || extraData.aperture || (raw.apertures && raw.apertures[0]) || 2.8

    // Extract focal length
    const focalLength =
      raw.focalLength ||
      deviceMeta.focalLength ||
      extraData.focalLength ||
      (raw.focalLengths && raw.focalLengths[0]) ||
      24

    // Build per-frame metadata
    const frameMetadata: McrawFrameMetadata = {
      width,
      height,
      bitsPerSample: raw.bitsPerPixel || raw.bitDepth || 16,
      cfaPattern: raw.cfaPattern || raw.sensorArrangment || deviceMeta.cfaPattern || "RGGB",
      iso,
      exposureTime,
      aperture,
      focalLength,
      timestamp: 0,
      blackLevel: raw.blackLevel || deviceMeta.blackLevel || [0, 0, 0, 0],
      whiteLevel: raw.whiteLevel || deviceMeta.whiteLevel || 16383,
      colorMatrix: raw.colorMatrix1 || deviceMeta.colorMatrix,
      forwardMatrix: raw.forwardMatrix1,
      cameraNeutral: raw.asShotNeutral || deviceMeta.asShot,
    }

    const frames: McrawFrameMetadata[] = []
    for (let i = 0; i < this.frameInfos.length; i++) {
      frames.push({
        ...frameMetadata,
        timestamp: this.frameInfos[i].timestamp,
      })
    }

    let confidence: "high" | "medium" | "low" = "low"
    if (this.frameInfos.length > 100) confidence = "high"
    else if (this.frameInfos.length > 20) confidence = "medium"

    return {
      cameraModel: raw.cameraModel || deviceMeta.model || "MotionCam Pro",
      cameraManufacturer: raw.manufacturer || deviceMeta.manufacturer || "MotionCam",
      sensorFormat: raw.sensorFormat || "Bayer",
      width,
      height,
      frameCount: this.frameInfos.length,
      fps,
      duration: (this.frameInfos.length / fps) * 1000,
      bitDepth: frameMetadata.bitsPerSample,
      hasQuadBayer: raw.hasQuadBayer || false,
      hasAudio: raw.hasAudio || false,
      audioSampleRate: raw.audioSampleRate,
      audioChannels: raw.audioChannels,
      frames,
      dateCreated: raw.dateCreated || new Date().toISOString(),
      softwareVersion: raw.softwareVersion || "1.0",
      frameDetectionConfidence: confidence,
      originalFps: calculatedFps,
    }
  }

  /**
   * Extract ISO - now also checks per-frame metadata
   */
  private extractIso(): number {
    for (const frameInfo of this.frameInfos) {
      if (frameInfo.iso && frameInfo.iso > 0) {
        console.log("[v0] ISO from per-frame metadata:", frameInfo.iso)
        return frameInfo.iso
      }
    }

    const raw = this.rawMetadata
    const extraData = raw.extraData || {}
    const postProcess = extraData.postProcessSettings || {}
    const deviceMeta = postProcess.metadata || {}
    const dngSettings = postProcess.dng || {}

    // Direct locations
    if (raw.iso && raw.iso > 0) {
      console.log("[v0] ISO from raw.iso:", raw.iso)
      return raw.iso
    }
    if (extraData.iso && extraData.iso > 0) {
      console.log("[v0] ISO from extraData.iso:", extraData.iso)
      return extraData.iso
    }
    if (deviceMeta.iso && deviceMeta.iso > 0) {
      console.log("[v0] ISO from deviceMeta.iso:", deviceMeta.iso)
      return deviceMeta.iso
    }
    if (postProcess.iso && postProcess.iso > 0) {
      console.log("[v0] ISO from postProcess.iso:", postProcess.iso)
      return postProcess.iso
    }
    if (dngSettings.iso && dngSettings.iso > 0) {
      console.log("[v0] ISO from dng settings:", dngSettings.iso)
      return dngSettings.iso
    }

    // Check for sensitivity (alternative name)
    if (raw.sensitivity && raw.sensitivity > 0) {
      console.log("[v0] ISO from raw.sensitivity:", raw.sensitivity)
      return raw.sensitivity
    }
    if (deviceMeta.sensitivity && deviceMeta.sensitivity > 0) {
      console.log("[v0] ISO from deviceMeta.sensitivity:", deviceMeta.sensitivity)
      return deviceMeta.sensitivity
    }

    // Check for ISO in exposure metadata
    if (deviceMeta.exposureIso && deviceMeta.exposureIso > 0) {
      console.log("[v0] ISO from deviceMeta.exposureIso:", deviceMeta.exposureIso)
      return deviceMeta.exposureIso
    }

    // Log available keys to help debug
    console.log("[v0] ISO not found in standard locations. extraData keys:", Object.keys(extraData))
    console.log("[v0] postProcessSettings keys:", Object.keys(postProcess))
    if (Object.keys(deviceMeta).length > 0) {
      console.log("[v0] deviceMeta (postProcess.metadata) keys:", Object.keys(deviceMeta))
    }
    if (Object.keys(dngSettings).length > 0) {
      console.log("[v0] dng settings keys:", Object.keys(dngSettings))
    }

    console.log("[v0] WARNING: Using default ISO 100 - actual ISO not found in metadata")
    return 100
  }

  /**
   * Decode a specific frame
   */
  async decodeFrame(frameIndex: number): Promise<DecodedFrame> {
    if (!this.metadata) {
      throw new Error("Must call parse() before decoding frames")
    }

    if (frameIndex < 0 || frameIndex >= this.frameInfos.length) {
      throw new Error(`Frame index ${frameIndex} out of range (0-${this.frameInfos.length - 1})`)
    }

    const frameInfo = this.frameInfos[frameIndex]
    const frameMetadata = this.metadata.frames[frameIndex]

    if (frameInfo.offset + frameInfo.size > this.data.byteLength) {
      throw new Error(`Frame ${frameIndex} data extends beyond file`)
    }

    const frameData = new Uint8Array(this.data, frameInfo.offset, frameInfo.size)

    console.log(
      `[v0] Decoding frame ${frameIndex}: offset=${frameInfo.offset}, size=${frameInfo.size}, compressed=${frameInfo.isCompressed}`,
    )

    let rawData: Uint8Array

    if (frameInfo.isCompressed) {
      // Decompress with fzstd
      try {
        rawData = fzstd.decompress(frameData)
        console.log(`[v0] Frame ${frameIndex}: decompressed ${frameData.length} -> ${rawData.length} bytes`)
      } catch (e) {
        console.error(`[v0] Failed to decompress frame ${frameIndex}:`, e)
        throw new Error(`Failed to decompress frame ${frameIndex}: ${e}`)
      }
    } else {
      // Data is already raw - but might still be in a custom format
      rawData = frameData
      console.log(`[v0] Frame ${frameIndex}: raw data ${rawData.length} bytes`)
    }

    // Convert to Bayer data
    const { width, height, bitsPerSample } = frameMetadata
    const pixelCount = width * height
    const expectedSize16 = pixelCount * 2 // 16-bit
    const expectedSize12 = Math.ceil(pixelCount * 1.5) // 12-bit packed

    console.log(
      `[v0] Frame ${frameIndex}: raw=${rawData.length}, expected16=${expectedSize16}, expected12=${expectedSize12}, pixels=${pixelCount}`,
    )

    let bayerData: Uint16Array

    if (rawData.length === expectedSize16) {
      console.log(`[v0] Frame ${frameIndex}: 16-bit raw data`)
      bayerData = new Uint16Array(rawData.buffer, rawData.byteOffset, pixelCount)
    } else if (rawData.length >= expectedSize12 && rawData.length < expectedSize16) {
      console.log(`[v0] Frame ${frameIndex}: 12-bit packed data, unpacking...`)
      bayerData = this.unpackBits(rawData, pixelCount, 12)
    } else if (rawData.length === pixelCount) {
      // 8-bit data - scale up
      console.log(`[v0] Frame ${frameIndex}: 8-bit data, scaling up`)
      bayerData = new Uint16Array(pixelCount)
      for (let i = 0; i < pixelCount; i++) {
        bayerData[i] = rawData[i] << 8
      }
    } else {
      console.log(`[v0] Frame ${frameIndex}: Size mismatch! Trying to determine actual format...`)

      // Check if the data size suggests a different resolution
      const possiblePixels16 = rawData.length / 2
      const possiblePixels12 = Math.floor(rawData.length / 1.5)

      const sqrt16 = Math.sqrt(possiblePixels16)
      const sqrt12 = Math.sqrt(possiblePixels12)

      console.log(
        `[v0] Possible resolutions: 16-bit=${Math.round(sqrt16)}x${Math.round(sqrt16)}, 12-bit=${Math.round(sqrt12)}x${Math.round(sqrt12)}`,
      )

      // Try common iPhone resolutions
      const commonResolutions = [
        [4032, 3024],
        [3024, 4032], // iPhone 15 Pro Max
        [4000, 3000],
        [3000, 4000],
        [1920, 1080],
        [1080, 1920], // Video
        [1280, 720],
        [720, 1280],
      ]

      let foundRes = false
      for (const [w, h] of commonResolutions) {
        const pixels = w * h
        const size12 = Math.ceil(pixels * 1.5)
        const size16 = pixels * 2

        if (Math.abs(rawData.length - size12) < 1000) {
          console.log(`[v0] Detected resolution: ${w}x${h} (12-bit)`)
          bayerData = this.unpackBits(rawData, pixels, 12)
          // Update metadata with actual resolution
          frameMetadata.width = w
          frameMetadata.height = h
          foundRes = true
          break
        }
        if (Math.abs(rawData.length - size16) < 1000) {
          console.log(`[v0] Detected resolution: ${w}x${h} (16-bit)`)
          bayerData = new Uint16Array(rawData.buffer, rawData.byteOffset, pixels)
          frameMetadata.width = w
          frameMetadata.height = h
          foundRes = true
          break
        }
      }

      if (!foundRes) {
        // Last resort: treat as raw 16-bit with truncation/padding
        console.log(`[v0] Using raw data as-is with size ${rawData.length}`)
        const actualPixels = Math.floor(rawData.length / 2)
        bayerData = new Uint16Array(actualPixels)
        const view16 = new DataView(rawData.buffer, rawData.byteOffset, actualPixels * 2)
        for (let i = 0; i < actualPixels; i++) {
          bayerData[i] = view16.getUint16(i * 2, true)
        }
      }
    }

    return {
      frameIndex,
      width: frameMetadata.width,
      height: frameMetadata.height,
      bayerData: bayerData!,
      metadata: frameMetadata,
      timestamp: frameInfo.timestamp,
    }
  }

  /**
   * Unpack bit-packed data
   */
  private unpackBits(packed: Uint8Array, pixelCount: number, bits: number): Uint16Array {
    const result = new Uint16Array(pixelCount)
    const shift = 16 - bits

    if (bits === 10) {
      for (let i = 0, j = 0; i < pixelCount - 3 && j < packed.length - 4; i += 4, j += 5) {
        result[i] = ((packed[j] << 2) | (packed[j + 1] >> 6)) << shift
        result[i + 1] = (((packed[j + 1] & 0x3f) << 4) | (packed[j + 2] >> 4)) << shift
        result[i + 2] = (((packed[j + 2] & 0x0f) << 6) | (packed[j + 3] >> 2)) << shift
        result[i + 3] = (((packed[j + 3] & 0x03) << 8) | packed[j + 4]) << shift
      }
    } else if (bits === 12) {
      for (let i = 0, j = 0; i < pixelCount - 1 && j < packed.length - 2; i += 2, j += 3) {
        result[i] = ((packed[j] << 4) | (packed[j + 1] >> 4)) << shift
        result[i + 1] = (((packed[j + 1] & 0x0f) << 8) | packed[j + 2]) << shift
      }
    } else {
      const view = new DataView(packed.buffer, packed.byteOffset, packed.byteLength)
      for (let i = 0; i < Math.min(pixelCount, packed.length / 2); i++) {
        result[i] = view.getUint16(i * 2, true)
      }
    }

    return result
  }

  private extractPerFrameMetadata(
    dataOffset: number,
    blockSize: number,
  ): { data: { iso?: number; exposureTime?: number; timestamp?: number }; metadataSize: number } | null {
    // Check if frame data starts with JSON (some MCRAW versions embed per-frame JSON)
    if (this.bytes[dataOffset] === 0x7b) {
      // '{'
      // Find closing brace
      let depth = 1
      let i = dataOffset + 1
      const maxScan = Math.min(dataOffset + 10000, dataOffset + blockSize) // Don't scan too far

      while (i < maxScan && depth > 0) {
        if (this.bytes[i] === 0x7b) depth++
        else if (this.bytes[i] === 0x7d) depth--
        i++
      }

      if (depth === 0) {
        const jsonSize = i - dataOffset
        try {
          const jsonStr = new TextDecoder().decode(this.bytes.slice(dataOffset, i))
          const json = JSON.parse(jsonStr)

          return {
            data: {
              iso: json.iso || json.sensitivity || json.ISO,
              exposureTime: json.exposureTime || json.shutterSpeed || json.exposure,
              timestamp: json.timestamp || json.time,
            },
            metadataSize: jsonSize,
          }
        } catch {
          // Not valid JSON, continue
        }
      }
    }

    // Check for binary header format: [8-byte timestamp][4-byte iso][4-byte exposure]
    // This is speculative based on common formats
    if (blockSize > 16) {
      const possibleTimestamp = this.view.getFloat64(dataOffset, true)
      const possibleIso = this.view.getUint32(dataOffset + 8, true)
      const possibleExposure = this.view.getFloat32(dataOffset + 12, true)

      // Sanity check values
      if (possibleIso >= 50 && possibleIso <= 102400 && possibleExposure > 0 && possibleExposure < 60) {
        console.log("[v0] Found binary per-frame header: iso=", possibleIso, "exposure=", possibleExposure)
        return {
          data: {
            iso: possibleIso,
            exposureTime: possibleExposure,
            timestamp: possibleTimestamp,
          },
          metadataSize: 16,
        }
      }
    }

    return null
  }
}

/**
 * Create thumbnail from decoded frame
 */
export function createThumbnail(
  frame: DecodedFrame,
  targetWidth = 320,
): {
  width: number
  height: number
  rgbData: Uint8ClampedArray
} {
  const { width, height, bayerData, metadata } = frame
  const aspectRatio = height / width
  const thumbWidth = targetWidth
  const thumbHeight = Math.round(targetWidth * aspectRatio)

  const rgbData = new Uint8ClampedArray(thumbWidth * thumbHeight * 4)

  const scaleX = width / thumbWidth
  const scaleY = height / thumbHeight

  const blackLevel = metadata.blackLevel?.[0] || 0
  const whiteLevel = metadata.whiteLevel || 16383
  const range = whiteLevel - blackLevel

  const cfaPattern = metadata.cfaPattern || "RGGB"

  for (let ty = 0; ty < thumbHeight; ty++) {
    for (let tx = 0; tx < thumbWidth; tx++) {
      const sx = Math.floor(tx * scaleX)
      const sy = Math.floor(ty * scaleY)

      // Sample 2x2 Bayer block
      const bx = sx & ~1
      const by = sy & ~1

      if (bx + 1 >= width || by + 1 >= height) continue

      const idx00 = by * width + bx
      const idx01 = by * width + bx + 1
      const idx10 = (by + 1) * width + bx
      const idx11 = (by + 1) * width + bx + 1

      const v00 = Math.max(0, (bayerData[idx00] || 0) - blackLevel) / range
      const v01 = Math.max(0, (bayerData[idx01] || 0) - blackLevel) / range
      const v10 = Math.max(0, (bayerData[idx10] || 0) - blackLevel) / range
      const v11 = Math.max(0, (bayerData[idx11] || 0) - blackLevel) / range

      let r: number, g: number, b: number

      if (cfaPattern === "RGGB") {
        r = v00
        g = (v01 + v10) / 2
        b = v11
      } else if (cfaPattern === "BGGR") {
        b = v00
        g = (v01 + v10) / 2
        r = v11
      } else if (cfaPattern === "GRBG") {
        g = (v00 + v11) / 2
        r = v01
        b = v10
      } else {
        g = (v00 + v11) / 2
        b = v01
        r = v10
      }

      // Apply gamma
      r = Math.pow(Math.min(1, r), 1 / 2.2)
      g = Math.pow(Math.min(1, g), 1 / 2.2)
      b = Math.pow(Math.min(1, b), 1 / 2.2)

      const outIdx = (ty * thumbWidth + tx) * 4
      rgbData[outIdx] = Math.round(r * 255)
      rgbData[outIdx + 1] = Math.round(g * 255)
      rgbData[outIdx + 2] = Math.round(b * 255)
      rgbData[outIdx + 3] = 255
    }
  }

  return { width: thumbWidth, height: thumbHeight, rgbData }
}
