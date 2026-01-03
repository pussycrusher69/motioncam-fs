"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { AppSidebar } from "@/components/app/app-sidebar"
import { FileUploadZone } from "@/components/app/file-upload-zone"
import { FileBrowser } from "@/components/app/file-browser"
import { SettingsPanel } from "@/components/app/settings-panel"
import { ProcessingQueue } from "@/components/app/processing-queue"
import { AppHeader } from "@/components/app/app-header"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Settings } from "lucide-react"
import type { UploadedFile, ProcessingJob, ProcessingSettings, McrawMetadata } from "@/lib/types"
import { DEFAULT_SETTINGS } from "@/lib/types"
import { parseClientSideMcraw } from "@/lib/client-mcraw-parser"
import { processClientSideMcraw, type ProcessedFrame } from "@/lib/client-mcraw-processor"
import { storeMetadata, getAllMetadata, deleteFile as deleteFromIndexedDB } from "@/lib/indexeddb-store"

export default function AppPage() {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [jobs, setJobs] = useState<ProcessingJob[]>([])
  const [settings, setSettings] = useState<ProcessingSettings>(DEFAULT_SETTINGS)
  const [activeTab, setActiveTab] = useState<"files" | "queue">("files")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const isMountedRef = useRef(true)
  const fileDataCache = useRef<Map<string, File>>(new Map())

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    const loadExistingFiles = async () => {
      try {
        console.log("[v0] Loading existing files from IndexedDB...")
        const storedMetadata = await getAllMetadata()
        console.log("[v0] Found", storedMetadata.length, "files in IndexedDB")

        if (storedMetadata.length > 0) {
          const existingFiles: UploadedFile[] = storedMetadata.map((stored) => ({
            id: stored.id,
            status: "ready" as const,
            progress: 100,
            metadata: {
              ...stored.metadata,
              id: stored.id,
              filename: stored.filename,
            } as McrawMetadata,
            thumbnail: stored.thumbnail,
            canProcess: false,
            needsReupload: true,
          }))

          setFiles(existingFiles)
        }
      } catch (error) {
        console.error("[v0] Error loading files from IndexedDB:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadExistingFiles()
  }, [])

  const handleFilesAdded = useCallback(async (newFiles: File[]) => {
    console.log("[v0] Processing", newFiles.length, "files client-side")

    for (const file of newFiles) {
      const fileId = crypto.randomUUID()

      const uploadedFile: UploadedFile = {
        id: fileId,
        file,
        status: "uploading" as const,
        progress: 0,
      }

      setFiles((prev) => [...prev, uploadedFile])

      try {
        console.log("[v0] Parsing MCRAW metadata for:", file.name)

        setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, status: "parsing" as const, progress: 25 } : f)))

        const { metadata, thumbnail } = await parseClientSideMcraw(file)

        console.log("[v0] Metadata parsed:", metadata.frameCount, "frames detected")

        setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, progress: 50 } : f)))

        // This avoids duplicating the large file in memory
        fileDataCache.current.set(fileId, file)

        setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, progress: 75 } : f)))

        // Store only metadata for file listing (small data)
        await storeMetadata(fileId, file.name, metadata, thumbnail)

        if (!isMountedRef.current) return

        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? {
                  ...f,
                  file, // Keep reference to original File object
                  status: "ready" as const,
                  progress: 100,
                  metadata: {
                    ...metadata,
                    id: fileId,
                  },
                  thumbnail,
                  canProcess: true,
                }
              : f,
          ),
        )

        console.log("[v0] File ready for processing:", file.name)
      } catch (error) {
        console.error("[v0] Error processing file:", error)

        if (!isMountedRef.current) return

        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? {
                  ...f,
                  status: "error" as const,
                  error: error instanceof Error ? error.message : "Processing failed",
                }
              : f,
          ),
        )
      }
    }
  }, [])

  const handleFileSelect = (fileId: string, multi: boolean) => {
    if (multi) {
      setSelectedFiles((prev) => (prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId]))
    } else {
      setSelectedFiles([fileId])
    }
  }

  const handleSelectAll = () => {
    const readyFiles = files.filter((f) => f.status === "ready" && f.canProcess)
    if (selectedFiles.length === readyFiles.length) {
      setSelectedFiles([])
    } else {
      setSelectedFiles(readyFiles.map((f) => f.id))
    }
  }

  const handleDeleteFiles = async (fileIds: string[]) => {
    for (const fileId of fileIds) {
      fileDataCache.current.delete(fileId)
      try {
        await deleteFromIndexedDB(fileId)
      } catch (error) {
        console.error("[v0] Failed to delete from IndexedDB:", error)
      }
    }

    setFiles((prev) => prev.filter((f) => !fileIds.includes(f.id)))
    setSelectedFiles((prev) => prev.filter((id) => !fileIds.includes(id)))
  }

  const handleStartProcessing = async () => {
    const filesToProcess = files.filter(
      (f) => selectedFiles.includes(f.id) && f.status === "ready" && f.metadata && f.canProcess,
    )

    if (filesToProcess.length === 0) {
      const needsReupload = files.filter((f) => selectedFiles.includes(f.id) && f.needsReupload)
      if (needsReupload.length > 0) {
        alert("Selected files need to be re-uploaded for processing. Please drag and drop them again.")
        return
      }
      console.error("[v0] No processable files selected")
      alert("Please select files to process")
      return
    }

    const newJobs: ProcessingJob[] = filesToProcess.map((f) => ({
      id: crypto.randomUUID(),
      fileId: f.id,
      filename: f.file?.name || f.metadata!.filename,
      status: "queued" as const,
      progress: 0,
      currentFrame: 0,
      totalFrames: f.metadata!.frameCount,
      settings: { ...settings },
    }))

    setJobs((prev) => [...prev, ...newJobs])
    setActiveTab("queue")

    for (const job of newJobs) {
      const file = filesToProcess.find((f) => f.id === job.fileId)

      if (!file) {
        setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: "failed", error: "File not found" } : j)))
        continue
      }

      const originalFile = fileDataCache.current.get(job.fileId) || file.file

      if (!originalFile) {
        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id ? { ...j, status: "failed", error: "File data not available. Please re-upload." } : j,
          ),
        )
        continue
      }

      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, status: "processing", startedAt: new Date().toISOString() } : j)),
      )

      const processedFrames: { url: string; filename: string; size: number }[] = []

      try {
        console.log("[v0] Starting processing for:", originalFile.name)
        console.log("[v0] File size:", (originalFile.size / 1024 / 1024).toFixed(2), "MB")

        const result = await processClientSideMcraw(
          originalFile,
          job.settings,
          (progress, currentFrame) => {
            setJobs((prev) =>
              prev.map((j) =>
                j.id === job.id
                  ? {
                      ...j,
                      progress,
                      currentFrame,
                    }
                  : j,
              ),
            )
          },
          (frame: ProcessedFrame) => {
            const url = URL.createObjectURL(frame.dngBlob)
            processedFrames.push({
              url,
              filename: frame.filename,
              size: frame.dngBlob.size,
            })

            setJobs((prev) =>
              prev.map((j) =>
                j.id === job.id
                  ? {
                      ...j,
                      outputFiles: [...processedFrames],
                    }
                  : j,
              ),
            )
          },
        )

        console.log("[v0] Processing complete:", result.successfulFrames, "successful,", result.failedFrames, "failed")

        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id
              ? {
                  ...j,
                  status: "completed",
                  progress: 100,
                  currentFrame: result.successfulFrames,
                  completedAt: new Date().toISOString(),
                  outputFiles: processedFrames,
                }
              : j,
          ),
        )

        fileDataCache.current.delete(job.fileId)
      } catch (error) {
        console.error("[v0] Processing error:", error)

        processedFrames.forEach((f) => URL.revokeObjectURL(f.url))

        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id
              ? { ...j, status: "failed", error: error instanceof Error ? error.message : "Processing failed" }
              : j,
          ),
        )
      }
    }
  }

  const handleCancelJob = (jobId: string) => {
    setJobs((prev) =>
      prev.map((j) =>
        j.id === jobId && j.status !== "completed" ? { ...j, status: "failed", error: "Cancelled by user" } : j,
      ),
    )
  }

  const handleClearCompleted = () => {
    jobs
      .filter((j) => j.status === "completed" || j.status === "failed")
      .forEach((j) => {
        j.outputFiles?.forEach((f) => URL.revokeObjectURL(f.url))
      })

    setJobs((prev) => prev.filter((j) => j.status !== "completed" && j.status !== "failed"))
  }

  const readyFilesCount = files.filter((f) => f.status === "ready").length
  const processingJobsCount = jobs.filter((j) => j.status === "processing").length
  const queuedJobsCount = jobs.filter((j) => j.status === "queued").length

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Loading files...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        filesCount={readyFilesCount}
        queueCount={queuedJobsCount + processingJobsCount}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader
          selectedCount={selectedFiles.length}
          totalFiles={readyFilesCount}
          onStartProcessing={handleStartProcessing}
          canProcess={selectedFiles.length > 0}
          activeTab={activeTab}
        />

        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 overflow-auto p-4 md:p-6">
            {activeTab === "files" ? (
              <div className="space-y-6">
                <FileUploadZone onFilesAdded={handleFilesAdded} />
                <FileBrowser
                  files={files}
                  selectedFiles={selectedFiles}
                  onFileSelect={handleFileSelect}
                  onSelectAll={handleSelectAll}
                  onDeleteFiles={handleDeleteFiles}
                />
              </div>
            ) : (
              <ProcessingQueue jobs={jobs} onCancelJob={handleCancelJob} onClearCompleted={handleClearCompleted} />
            )}
          </main>

          <aside className="hidden w-80 border-l border-border bg-card lg:block">
            <SettingsPanel settings={settings} onSettingsChange={setSettings} />
          </aside>
        </div>

        <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
          <SheetTrigger asChild>
            <Button size="icon" className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg lg:hidden">
              <Settings className="h-6 w-6" />
              <span className="sr-only">Open Settings</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full p-0 sm:max-w-md">
            <SettingsPanel settings={settings} onSettingsChange={setSettings} />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  )
}
