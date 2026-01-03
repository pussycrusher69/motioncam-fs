"use client"

import { cn } from "@/lib/utils"
import type { UploadedFile } from "@/lib/types"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Trash2, FileVideo, Clock, Film, Aperture, Loader2, AlertCircle } from "lucide-react"
import { formatBytes, formatDuration } from "@/lib/format"

interface FileBrowserProps {
  files: (UploadedFile & { canProcess?: boolean })[]
  selectedFiles: string[]
  onFileSelect: (fileId: string, multi: boolean) => void
  onSelectAll: () => void
  onDeleteFiles: (fileIds: string[]) => void
}

export function FileBrowser({ files, selectedFiles, onFileSelect, onSelectAll, onDeleteFiles }: FileBrowserProps) {
  const readyFiles = files.filter((f) => f.status === "ready")
  const allSelected = readyFiles.length > 0 && selectedFiles.length === readyFiles.length

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-12 text-center">
        <FileVideo className="mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="mb-2 text-lg font-medium">No files yet</h3>
        <p className="text-sm text-muted-foreground">Upload MCRAW files to get started with processing</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Checkbox checked={allSelected} onCheckedChange={onSelectAll} aria-label="Select all files" />
          <span className="text-sm font-medium">
            {files.length} file{files.length !== 1 ? "s" : ""}
          </span>
        </div>

        {selectedFiles.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => onDeleteFiles(selectedFiles)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete ({selectedFiles.length})
          </Button>
        )}
      </div>

      <div className="divide-y divide-border">
        {files.map((file) => (
          <FileRow
            key={file.id}
            file={file}
            isSelected={selectedFiles.includes(file.id)}
            onSelect={(multi) => onFileSelect(file.id, multi)}
          />
        ))}
      </div>
    </div>
  )
}

interface FileRowProps {
  file: UploadedFile & { canProcess?: boolean }
  isSelected: boolean
  onSelect: (multi: boolean) => void
}

function FileRow({ file, isSelected, onSelect }: FileRowProps) {
  const isReady = file.status === "ready"
  const isLoading = file.status === "uploading" || file.status === "parsing"
  const canProcess = file.canProcess ?? true

  const filename = file.file?.name || file.metadata?.filename || "Unknown file"

  return (
    <div
      className={cn(
        "flex items-center gap-4 px-4 py-3 transition-colors",
        isReady && "cursor-pointer hover:bg-secondary/50",
        isSelected && "bg-primary/5",
        !canProcess && isReady && "opacity-60",
      )}
      onClick={(e) => {
        if (isReady) {
          onSelect(e.metaKey || e.ctrlKey)
        }
      }}
    >
      <Checkbox
        checked={isSelected}
        disabled={!isReady}
        onCheckedChange={() => onSelect(false)}
        onClick={(e) => e.stopPropagation()}
        aria-label={`Select ${filename}`}
      />

      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
        {isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        ) : (
          <FileVideo className="h-6 w-6 text-muted-foreground" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium">{filename}</p>
          {isReady && !canProcess && (
            <div className="flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-3 w-3" />
              Re-upload to process
            </div>
          )}
        </div>
        {isLoading && (
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
              <div className="h-full bg-primary transition-all" style={{ width: `${file.progress}%` }} />
            </div>
            <span className="text-xs text-muted-foreground">
              {file.status === "uploading" ? "Uploading" : "Parsing"}...
            </span>
          </div>
        )}
        {isReady && file.metadata && (
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>{formatBytes(file.metadata.size || 0)}</span>
            <span className="flex items-center gap-1">
              <Film className="h-3 w-3" />
              {file.metadata.width || 0}x{file.metadata.height || 0}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(file.metadata.duration || 0)}
            </span>
            <span>{file.metadata.fps || 0} fps</span>
          </div>
        )}
        {file.status === "error" && <p className="mt-1 text-sm text-destructive">{file.error}</p>}
      </div>

      {isReady && file.metadata && (
        <div className="hidden flex-col items-end gap-1 text-sm md:flex">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Aperture className="h-3 w-3" />
            ISO {file.metadata.iso || 0}
          </span>
          <span className="text-muted-foreground">{file.metadata.frameCount || 0} frames</span>
        </div>
      )}
    </div>
  )
}
