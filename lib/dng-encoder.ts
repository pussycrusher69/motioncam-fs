/**
 * DNG (Digital Negative) Encoder
 *
 * Creates Adobe DNG files from decoded MCRAW frames.
 * DNG is based on TIFF format with additional tags for RAW data.
 */

import type { DecodedFrame } from "./mcraw-decoder"

// TIFF Tag IDs
const TIFF_TAGS = {
  ImageWidth: 256,
  ImageLength: 257,
  BitsPerSample: 258,
  Compression: 259,
  PhotometricInterpretation: 262,
  Make: 271,
  Model: 272,
  StripOffsets: 273,
  Orientation: 274,
  SamplesPerPixel: 277,
  RowsPerStrip: 278,
  StripByteCounts: 279,
  XResolution: 282,
  YResolution: 283,
  PlanarConfiguration: 284,
  ResolutionUnit: 296,
  Software: 305,
  DateTime: 306,
  SubIFDs: 330,
  CFARepeatPatternDim: 33421,
  CFAPattern: 33422,
  DNGVersion: 50706,
  DNGBackwardVersion: 50707,
  UniqueCameraModel: 50708,
  CFAPlaneColor: 50710,
  CFALayout: 50711,
  BlackLevelRepeatDim: 50713,
  BlackLevel: 50714,
  WhiteLevel: 50717,
  DefaultScale: 50718,
  DefaultCropOrigin: 50719,
  DefaultCropSize: 50720,
  ColorMatrix1: 50721,
  ColorMatrix2: 50722,
  CameraCalibration1: 50723,
  CameraCalibration2: 50724,
  AsShotNeutral: 50728,
  AsShotWhiteXY: 50729,
  BaselineExposure: 50730,
  BaselineNoise: 50731,
  BaselineSharpness: 50732,
  BayerGreenSplit: 50733,
  LinearResponseLimit: 50734,
  CalibrationIlluminant1: 50778,
  CalibrationIlluminant2: 50779,
  ActiveArea: 50829,
  ForwardMatrix1: 50964,
  ForwardMatrix2: 50965,
  OpcodeList1: 51008,
  OpcodeList2: 51009,
  OpcodeList3: 51022,
  NoiseProfile: 51041,
  // EXIF tags
  ExposureTime: 33434,
  FNumber: 33437,
  ISOSpeedRatings: 34855,
  ExifVersion: 36864,
  DateTimeOriginal: 36867,
  DateTimeDigitized: 36868,
  FocalLength: 37386,
  SubSecTime: 37520,
  SubSecTimeOriginal: 37521,
  SubSecTimeDigitized: 37522,
} as const

// TIFF data types
const TIFF_TYPES = {
  BYTE: 1,
  ASCII: 2,
  SHORT: 3,
  LONG: 4,
  RATIONAL: 5,
  SBYTE: 6,
  UNDEFINED: 7,
  SSHORT: 8,
  SLONG: 9,
  SRATIONAL: 10,
  FLOAT: 11,
  DOUBLE: 12,
} as const

interface TiffTag {
  id: number
  type: number
  count: number
  value: number | number[] | string | ArrayBuffer
}

export interface DngEncoderOptions {
  software?: string
  artist?: string
  copyright?: string
  compression?: "none" | "lossless"
}

export class DngEncoder {
  private options: DngEncoderOptions

  constructor(options: DngEncoderOptions = {}) {
    this.options = {
      software: "MotionCam Web Decoder",
      ...options,
    }
  }

  /**
   * Encode a decoded frame to DNG format
   */
  encode(frame: DecodedFrame, cameraModel = "MotionCam Pro"): ArrayBuffer {
    const { width, height, bayerData, metadata } = frame

    // Calculate sizes
    const rawDataSize = bayerData.byteLength
    const headerSize = 8 // TIFF header

    // Build IFD tags
    const tags: TiffTag[] = this.buildTags(frame, cameraModel)

    // Calculate IFD size
    const ifdEntrySize = 12
    const numTags = tags.length
    const ifdSize = 2 + numTags * ifdEntrySize + 4 // count + entries + next IFD pointer

    // Calculate data section offset (for values that don't fit in 4 bytes)
    let dataOffset = headerSize + ifdSize
    const tagData: { tag: TiffTag; offset: number; data: ArrayBuffer }[] = []

    for (const tag of tags) {
      const valueSize = this.getValueSize(tag)
      if (valueSize > 4) {
        tagData.push({
          tag,
          offset: dataOffset,
          data: this.encodeValue(tag),
        })
        dataOffset += Math.ceil(valueSize / 2) * 2 // Align to word boundary
      }
    }

    // Raw data starts after all tag data
    const rawDataOffset = dataOffset

    // Update StripOffsets tag
    const stripOffsetsTag = tags.find((t) => t.id === TIFF_TAGS.StripOffsets)
    if (stripOffsetsTag) {
      stripOffsetsTag.value = rawDataOffset
    }

    // Total file size
    const totalSize = rawDataOffset + rawDataSize

    // Create output buffer
    const buffer = new ArrayBuffer(totalSize)
    const view = new DataView(buffer)
    const bytes = new Uint8Array(buffer)

    // Write TIFF header
    view.setUint16(0, 0x4949, false) // Little-endian marker "II"
    view.setUint16(2, 42, true) // TIFF magic number
    view.setUint32(4, 8, true) // Offset to first IFD

    // Write IFD
    let offset = 8
    view.setUint16(offset, numTags, true)
    offset += 2

    for (const tag of tags) {
      view.setUint16(offset, tag.id, true)
      view.setUint16(offset + 2, tag.type, true)
      view.setUint32(offset + 4, tag.count, true)

      const valueSize = this.getValueSize(tag)
      if (valueSize <= 4) {
        // Value fits in the 4-byte field
        this.writeInlineValue(view, offset + 8, tag)
      } else {
        // Value is stored elsewhere, write offset
        const tagDataEntry = tagData.find((td) => td.tag === tag)
        if (tagDataEntry) {
          view.setUint32(offset + 8, tagDataEntry.offset, true)
        } else {
          console.error("[v0] Tag data entry not found for tag:", tag.id)
          view.setUint32(offset + 8, 0, true) // Write 0 as fallback
        }
      }

      offset += 12
    }

    // Write next IFD pointer (0 = no more IFDs)
    view.setUint32(offset, 0, true)

    // Write tag data
    for (const { offset: dataOffset, data } of tagData) {
      bytes.set(new Uint8Array(data), dataOffset)
    }

    // Write raw Bayer data
    bytes.set(new Uint8Array(bayerData.buffer, bayerData.byteOffset, bayerData.byteLength), rawDataOffset)

    return buffer
  }

  private buildTags(frame: DecodedFrame, cameraModel: string): TiffTag[] {
    const { width, height, bayerData, metadata } = frame
    const now = new Date()
    const dateTimeStr = this.formatDateTime(now)

    // CFA pattern bytes based on string pattern
    const cfaPatternBytes = this.getCfaPatternBytes(metadata.cfaPattern || "RGGB")

    // This matches MotionCam-fs behavior for compensating exposure changes between frames
    const baselineExposure = this.calculateBaselineExposure(metadata.iso, metadata.exposureTime)

    console.log(
      `[v0] Frame ${frame.frameIndex} - ISO: ${metadata.iso}, Exposure: ${metadata.exposureTime}s, BaselineExposure: ${baselineExposure}`,
    )

    const tags: TiffTag[] = [
      // Basic TIFF tags
      { id: TIFF_TAGS.ImageWidth, type: TIFF_TYPES.LONG, count: 1, value: width },
      { id: TIFF_TAGS.ImageLength, type: TIFF_TYPES.LONG, count: 1, value: height },
      { id: TIFF_TAGS.BitsPerSample, type: TIFF_TYPES.SHORT, count: 1, value: 16 },
      { id: TIFF_TAGS.Compression, type: TIFF_TYPES.SHORT, count: 1, value: 1 }, // No compression
      { id: TIFF_TAGS.PhotometricInterpretation, type: TIFF_TYPES.SHORT, count: 1, value: 32803 }, // CFA
      { id: TIFF_TAGS.Make, type: TIFF_TYPES.ASCII, count: 10, value: "MotionCam" },
      { id: TIFF_TAGS.Model, type: TIFF_TYPES.ASCII, count: cameraModel.length + 1, value: cameraModel },
      { id: TIFF_TAGS.StripOffsets, type: TIFF_TYPES.LONG, count: 1, value: 0 }, // Will be updated
      { id: TIFF_TAGS.Orientation, type: TIFF_TYPES.SHORT, count: 1, value: metadata.orientation || 1 },
      { id: TIFF_TAGS.SamplesPerPixel, type: TIFF_TYPES.SHORT, count: 1, value: 1 },
      { id: TIFF_TAGS.RowsPerStrip, type: TIFF_TYPES.LONG, count: 1, value: height },
      { id: TIFF_TAGS.StripByteCounts, type: TIFF_TYPES.LONG, count: 1, value: bayerData.byteLength },
      { id: TIFF_TAGS.XResolution, type: TIFF_TYPES.RATIONAL, count: 1, value: [72, 1] },
      { id: TIFF_TAGS.YResolution, type: TIFF_TYPES.RATIONAL, count: 1, value: [72, 1] },
      { id: TIFF_TAGS.PlanarConfiguration, type: TIFF_TYPES.SHORT, count: 1, value: 1 },
      { id: TIFF_TAGS.ResolutionUnit, type: TIFF_TYPES.SHORT, count: 1, value: 2 }, // Inches
      {
        id: TIFF_TAGS.Software,
        type: TIFF_TYPES.ASCII,
        count: this.options.software!.length + 1,
        value: this.options.software!,
      },
      { id: TIFF_TAGS.DateTime, type: TIFF_TYPES.ASCII, count: 20, value: dateTimeStr },

      // CFA tags
      { id: TIFF_TAGS.CFARepeatPatternDim, type: TIFF_TYPES.SHORT, count: 2, value: [2, 2] },
      { id: TIFF_TAGS.CFAPattern, type: TIFF_TYPES.BYTE, count: 4, value: cfaPatternBytes },

      // DNG tags
      { id: TIFF_TAGS.DNGVersion, type: TIFF_TYPES.BYTE, count: 4, value: [1, 4, 0, 0] },
      { id: TIFF_TAGS.DNGBackwardVersion, type: TIFF_TYPES.BYTE, count: 4, value: [1, 1, 0, 0] },
      { id: TIFF_TAGS.UniqueCameraModel, type: TIFF_TYPES.ASCII, count: cameraModel.length + 1, value: cameraModel },
      { id: TIFF_TAGS.CFAPlaneColor, type: TIFF_TYPES.BYTE, count: 3, value: [0, 1, 2] }, // RGB
      { id: TIFF_TAGS.CFALayout, type: TIFF_TYPES.SHORT, count: 1, value: 1 }, // Rectangular
      { id: TIFF_TAGS.BlackLevelRepeatDim, type: TIFF_TYPES.SHORT, count: 2, value: [2, 2] },
      { id: TIFF_TAGS.BlackLevel, type: TIFF_TYPES.LONG, count: 4, value: metadata.blackLevel || [64, 64, 64, 64] },
      { id: TIFF_TAGS.WhiteLevel, type: TIFF_TYPES.LONG, count: 1, value: metadata.whiteLevel || 65535 },
      { id: TIFF_TAGS.DefaultScale, type: TIFF_TYPES.RATIONAL, count: 2, value: [1, 1, 1, 1] },
      { id: TIFF_TAGS.DefaultCropOrigin, type: TIFF_TYPES.LONG, count: 2, value: [0, 0] },
      { id: TIFF_TAGS.DefaultCropSize, type: TIFF_TYPES.LONG, count: 2, value: [width, height] },
      { id: TIFF_TAGS.CalibrationIlluminant1, type: TIFF_TYPES.SHORT, count: 1, value: 17 }, // Standard Light A
      { id: TIFF_TAGS.CalibrationIlluminant2, type: TIFF_TYPES.SHORT, count: 1, value: 21 }, // D65
      { id: TIFF_TAGS.ActiveArea, type: TIFF_TYPES.LONG, count: 4, value: [0, 0, height, width] },
      { id: TIFF_TAGS.BaselineExposure, type: TIFF_TYPES.SRATIONAL, count: 1, value: baselineExposure },
      { id: TIFF_TAGS.BaselineNoise, type: TIFF_TYPES.RATIONAL, count: 1, value: [1, 1] },
      { id: TIFF_TAGS.BaselineSharpness, type: TIFF_TYPES.RATIONAL, count: 1, value: [1, 1] },
      { id: TIFF_TAGS.LinearResponseLimit, type: TIFF_TYPES.RATIONAL, count: 1, value: [1, 1] },

      {
        id: TIFF_TAGS.ExposureTime,
        type: TIFF_TYPES.RATIONAL,
        count: 1,
        value: this.exposureToRational(metadata.exposureTime),
      },
      { id: TIFF_TAGS.FNumber, type: TIFF_TYPES.RATIONAL, count: 1, value: this.apertureToRational(metadata.aperture) },
      { id: TIFF_TAGS.ISOSpeedRatings, type: TIFF_TYPES.SHORT, count: 1, value: metadata.iso },
      {
        id: TIFF_TAGS.FocalLength,
        type: TIFF_TYPES.RATIONAL,
        count: 1,
        value: [Math.round(metadata.focalLength * 10), 10],
      },
    ]

    // Add color matrices if available
    if (metadata.colorMatrix) {
      const flatMatrix = metadata.colorMatrix.flat().flatMap((v) => [Math.round(v * 10000), 10000])
      tags.push({
        id: TIFF_TAGS.ColorMatrix1,
        type: TIFF_TYPES.SRATIONAL,
        count: 9,
        value: flatMatrix as number[],
      })
    } else {
      // Default sRGB color matrix
      tags.push({
        id: TIFF_TAGS.ColorMatrix1,
        type: TIFF_TYPES.SRATIONAL,
        count: 9,
        value: [10000, 10000, 0, 10000, 0, 10000, 0, 10000, 10000, 10000, 0, 10000, 0, 10000, 0, 10000, 10000, 10000],
      })
    }

    // Add camera neutral if available
    if (metadata.cameraNeutral) {
      const neutralRational = metadata.cameraNeutral.flatMap((v) => [Math.round(v * 10000), 10000])
      tags.push({
        id: TIFF_TAGS.AsShotNeutral,
        type: TIFF_TYPES.RATIONAL,
        count: 3,
        value: neutralRational,
      })
    } else {
      tags.push({
        id: TIFF_TAGS.AsShotNeutral,
        type: TIFF_TYPES.RATIONAL,
        count: 3,
        value: [10000, 10000, 10000, 10000, 10000, 10000],
      })
    }

    // Sort tags by ID (required by TIFF spec)
    tags.sort((a, b) => a.id - b.id)

    return tags
  }

  private getCfaPatternBytes(pattern: string): number[] {
    // CFA color indices: 0=Red, 1=Green, 2=Blue
    const colorMap: Record<string, number> = { R: 0, G: 1, B: 2 }
    return pattern.split("").map((c) => colorMap[c] || 1)
  }

  private getValueSize(tag: TiffTag): number {
    const typeSizes: Record<number, number> = {
      [TIFF_TYPES.BYTE]: 1,
      [TIFF_TYPES.ASCII]: 1,
      [TIFF_TYPES.SHORT]: 2,
      [TIFF_TYPES.LONG]: 4,
      [TIFF_TYPES.RATIONAL]: 8,
      [TIFF_TYPES.SBYTE]: 1,
      [TIFF_TYPES.UNDEFINED]: 1,
      [TIFF_TYPES.SSHORT]: 2,
      [TIFF_TYPES.SLONG]: 4,
      [TIFF_TYPES.SRATIONAL]: 8,
      [TIFF_TYPES.FLOAT]: 4,
      [TIFF_TYPES.DOUBLE]: 8,
    }
    return (typeSizes[tag.type] || 1) * tag.count
  }

  private writeInlineValue(view: DataView, offset: number, tag: TiffTag): void {
    const value = tag.value

    if (typeof value === "number") {
      switch (tag.type) {
        case TIFF_TYPES.BYTE:
        case TIFF_TYPES.SBYTE:
          view.setUint8(offset, value)
          break
        case TIFF_TYPES.SHORT:
          view.setUint16(offset, value, true)
          break
        case TIFF_TYPES.SSHORT:
          view.setInt16(offset, value, true)
          break
        case TIFF_TYPES.LONG:
          view.setUint32(offset, value, true)
          break
        case TIFF_TYPES.SLONG:
          view.setInt32(offset, value, true)
          break
      }
    } else if (Array.isArray(value)) {
      if (tag.type === TIFF_TYPES.SHORT && value.length <= 2) {
        for (let i = 0; i < value.length; i++) {
          view.setUint16(offset + i * 2, value[i] as number, true)
        }
      } else if (tag.type === TIFF_TYPES.BYTE && value.length <= 4) {
        for (let i = 0; i < value.length; i++) {
          view.setUint8(offset + i, value[i] as number)
        }
      } else if (tag.type === TIFF_TYPES.LONG && value.length === 1) {
        view.setUint32(offset, value[0] as number, true)
      }
    } else if (typeof value === "string" && value.length <= 4) {
      for (let i = 0; i < value.length; i++) {
        view.setUint8(offset + i, value.charCodeAt(i))
      }
    }
  }

  private encodeValue(tag: TiffTag): ArrayBuffer {
    const valueSize = this.getValueSize(tag)
    const buffer = new ArrayBuffer(Math.ceil(valueSize / 2) * 2) // Align to word
    const view = new DataView(buffer)
    const bytes = new Uint8Array(buffer)
    const value = tag.value

    if (typeof value === "string") {
      for (let i = 0; i < value.length; i++) {
        bytes[i] = value.charCodeAt(i)
      }
      bytes[value.length] = 0 // Null terminator
    } else if (Array.isArray(value)) {
      switch (tag.type) {
        case TIFF_TYPES.BYTE:
          for (let i = 0; i < value.length; i++) {
            bytes[i] = value[i] as number
          }
          break
        case TIFF_TYPES.SHORT:
          for (let i = 0; i < value.length; i++) {
            view.setUint16(i * 2, value[i] as number, true)
          }
          break
        case TIFF_TYPES.LONG:
          for (let i = 0; i < value.length; i++) {
            view.setUint32(i * 4, value[i] as number, true)
          }
          break
        case TIFF_TYPES.RATIONAL:
        case TIFF_TYPES.SRATIONAL:
          // Rationals are pairs of longs [numerator, denominator]
          for (let i = 0; i < value.length; i++) {
            if (tag.type === TIFF_TYPES.SRATIONAL) {
              view.setInt32(i * 4, value[i] as number, true)
            } else {
              view.setUint32(i * 4, value[i] as number, true)
            }
          }
          break
      }
    }

    return buffer
  }

  private formatDateTime(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, "0")
    return `${date.getFullYear()}:${pad(date.getMonth() + 1)}:${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  }

  /**
   * Calculate BaselineExposure compensation for exposure normalization
   * Based on MotionCam-fs implementation for compensating exposure changes between frames
   */
  private calculateBaselineExposure(iso: number, exposureTime: number): number[] {
    // Reference exposure: ISO 100, 1/24s (24fps)
    const refIso = 100
    const refExposure = 1 / 24

    // Calculate EV difference
    const isoStops = Math.log2(iso / refIso)
    const shutterStops = Math.log2(exposureTime / refExposure)

    // Total exposure compensation in stops
    const exposureCompensation = isoStops + shutterStops

    // Convert to rational (signed)
    const numerator = Math.round(exposureCompensation * 100)
    const denominator = 100

    return [numerator, denominator]
  }

  /**
   * Convert exposure time to TIFF rational
   */
  private exposureToRational(exposure: number): number[] {
    if (exposure >= 1) {
      return [Math.round(exposure * 1000), 1000]
    } else {
      // Express as fraction (e.g., 1/250 for 0.004)
      const denominator = Math.round(1 / exposure)
      return [1, denominator]
    }
  }

  /**
   * Convert aperture to TIFF rational
   */
  private apertureToRational(aperture: number): number[] {
    return [Math.round(aperture * 10), 10]
  }
}

/**
 * Create a DNG file from a decoded frame
 */
export function encodeToDng(
  frame: DecodedFrame,
  cameraModel = "MotionCam Pro",
  options?: DngEncoderOptions,
): ArrayBuffer {
  const encoder = new DngEncoder(options)
  return encoder.encode(frame, cameraModel)
}
