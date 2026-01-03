// MCRAW file types and processing configuration

export interface McrawMetadata {
  id: string
  filename: string
  size: number
  width: number
  height: number
  frameCount: number
  fps: number
  duration: number
  iso: number
  exposureTime: string
  aperture: string
  cameraModel: string
  sensorFormat: string
  bitDepth: number
  hasQuadBayer: boolean
  dateCreated: string
  thumbnail?: string
  estimatedFrameCount?: number
  frameDetectionConfidence?: "high" | "medium" | "low"
}

export interface ProcessingSettings {
  originalFps: 18 | 24 | 25 | 30
  targetFps: number
  useOriginalFps: boolean

  frameRange?: {
    start: number
    end: number
  }

  // Exposure
  normalizeExposure: boolean
  exposureCompensation: number

  // Vignette
  correctVignette: boolean
  vignetteStrength: number

  // Transfer curve
  transferCurve: "linear" | "srgb" | "logC" | "slog3" | "vlog"

  // Cropping
  cropMode: "none" | "auto" | "custom"
  cropTop: number
  cropBottom: number
  cropLeft: number
  cropRight: number

  // Output
  outputFormat: "dng" | "tiff"
  outputBitDepth: 12 | 14 | 16
  compressionEnabled: boolean
}

export interface ProcessingJob {
  id: string
  fileId: string
  filename: string
  status: "queued" | "processing" | "completed" | "failed"
  progress: number
  currentFrame: number
  totalFrames: number
  settings: ProcessingSettings
  startedAt?: string
  completedAt?: string
  error?: string
  outputPath?: string
  outputFiles?: { frame?: number; filename?: string; url: string; size: number }[]
}

export interface UploadedFile {
  id: string
  file?: File
  blobUrl?: string
  metadata?: McrawMetadata
  status: "uploading" | "parsing" | "ready" | "error"
  progress: number
  error?: string
  thumbnail?: string
  canProcess?: boolean
  needsReupload?: boolean
}

export const DEFAULT_SETTINGS: ProcessingSettings = {
  originalFps: 24,
  targetFps: 24,
  useOriginalFps: true,
  normalizeExposure: true,
  exposureCompensation: 0,
  correctVignette: true,
  vignetteStrength: 100,
  transferCurve: "linear",
  cropMode: "none",
  cropTop: 0,
  cropBottom: 0,
  cropLeft: 0,
  cropRight: 0,
  outputFormat: "dng",
  outputBitDepth: 16,
  compressionEnabled: false,
}
