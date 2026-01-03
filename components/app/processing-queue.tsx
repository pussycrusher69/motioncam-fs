"use client"

import type { ProcessingJob } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { CheckCircle2, XCircle, Clock, Loader2, Download, X, Trash2, FileVideo, FolderArchive } from "lucide-react"

interface ProcessingQueueProps {
  jobs: ProcessingJob[]
  onCancelJob: (jobId: string) => void
  onClearCompleted: () => void
}

export function ProcessingQueue({ jobs, onCancelJob, onClearCompleted }: ProcessingQueueProps) {
  const hasCompleted = jobs.some((j) => j.status === "completed" || j.status === "failed")
  const completedJobs = jobs.filter((j) => j.status === "completed")

  const handleDownloadAll = async () => {
    for (const job of completedJobs) {
      if (job.outputFiles && job.outputFiles.length > 0) {
        // Download each file
        for (const file of job.outputFiles) {
          const link = document.createElement("a")
          link.href = file.url
          link.download = file.filename || `${job.filename.replace(".mcraw", "")}_frame.dng`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          // Small delay between downloads
          await new Promise((r) => setTimeout(r, 100))
        }
      }
    }
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-12 text-center">
        <Clock className="mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="mb-2 text-lg font-medium">No jobs in queue</h3>
        <p className="text-sm text-muted-foreground">Select files and click Process to start converting</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {hasCompleted && (
        <div className="flex items-center justify-between gap-2">
          {completedJobs.length > 0 && (
            <Button variant="default" size="sm" onClick={handleDownloadAll} className="gap-1.5">
              <FolderArchive className="h-4 w-4" />
              Download All ({completedJobs.reduce((acc, j) => acc + (j.outputFiles?.length || 0), 0)} files)
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={onClearCompleted}>
            <Trash2 className="mr-2 h-4 w-4" />
            Clear completed
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} onCancel={() => onCancelJob(job.id)} />
        ))}
      </div>
    </div>
  )
}

interface JobCardProps {
  job: ProcessingJob
  onCancel: () => void
}

function JobCard({ job, onCancel }: JobCardProps) {
  const statusConfig = {
    queued: {
      icon: Clock,
      label: "Queued",
      color: "text-muted-foreground",
    },
    processing: {
      icon: Loader2,
      label: "Processing",
      color: "text-primary",
      animate: true,
    },
    completed: {
      icon: CheckCircle2,
      label: "Completed",
      color: "text-green-500",
    },
    failed: {
      icon: XCircle,
      label: "Failed",
      color: "text-destructive",
    },
  }

  const config = statusConfig[job.status]
  const StatusIcon = config.icon

  const handleDownload = async () => {
    if (job.outputFiles && job.outputFiles.length > 0) {
      for (const file of job.outputFiles) {
        const link = document.createElement("a")
        link.href = file.url
        link.download = file.filename || `${job.filename.replace(".mcraw", "")}_frame.dng`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        await new Promise((r) => setTimeout(r, 100))
      }
    } else if (job.outputPath) {
      const link = document.createElement("a")
      link.href = job.outputPath
      link.download = `${job.filename.replace(".mcraw", "")}.dng`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const totalOutputSize = job.outputFiles?.reduce((acc, f) => acc + f.size, 0) || 0
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 transition-colors",
        job.status === "processing" && "border-primary/50",
        job.status === "completed" && "border-green-500/30",
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            job.status === "completed"
              ? "bg-green-500/20"
              : job.status === "failed"
                ? "bg-destructive/20"
                : "bg-secondary",
          )}
        >
          <FileVideo className={cn("h-5 w-5", config.color)} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-medium">{job.filename}</p>
              <div className="mt-1 flex items-center gap-2">
                <StatusIcon className={cn("h-4 w-4", config.color, config.animate && "animate-spin")} />
                <span className={cn("text-sm", config.color)}>{config.label}</span>
                {job.status === "processing" && (
                  <span className="text-sm text-muted-foreground">
                    Frame {job.currentFrame} / {job.totalFrames}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {job.status === "completed" && (
                <Button size="sm" onClick={handleDownload} className="gap-1.5">
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    Download {job.outputFiles?.length || 1} DNG{(job.outputFiles?.length || 1) > 1 ? "s" : ""}
                  </span>
                </Button>
              )}
              {(job.status === "queued" || job.status === "processing") && (
                <Button size="icon" variant="ghost" onClick={onCancel}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {(job.status === "processing" || job.status === "queued") && (
            <div className="mt-3">
              <Progress value={job.progress} className="h-2" />
              <p className="mt-1 text-right text-xs text-muted-foreground">{job.progress}%</p>
            </div>
          )}

          {job.status === "failed" && job.error && <p className="mt-2 text-sm text-destructive">{job.error}</p>}

          {job.status === "completed" && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{job.outputFiles?.length || job.totalFrames} DNG files</span>
              {totalOutputSize > 0 && (
                <>
                  <span className="text-muted-foreground/50">|</span>
                  <span>{formatSize(totalOutputSize)}</span>
                </>
              )}
              <span className="text-muted-foreground/50">|</span>
              <span>
                {job.settings.outputBitDepth}-bit {job.settings.transferCurve.toUpperCase()}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
