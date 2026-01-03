"use client"

import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import { cn } from "@/lib/utils"
import { Upload, FileVideo, AlertCircle } from "lucide-react"

interface FileUploadZoneProps {
  onFilesAdded: (files: File[]) => void
}

export function FileUploadZone({ onFilesAdded }: FileUploadZoneProps) {
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: unknown[]) => {
      setError(null)

      if (rejectedFiles.length > 0) {
        setError("Some files were rejected. Only .mcraw files are supported.")
      }

      if (acceptedFiles.length > 0) {
        onFilesAdded(acceptedFiles)
      }
    },
    [onFilesAdded],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/octet-stream": [".mcraw"],
    },
    multiple: true,
  })

  return (
    <div
      {...getRootProps()}
      className={cn(
        "relative flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all",
        isDragActive ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50 hover:bg-card/80",
      )}
    >
      <input {...getInputProps()} />

      <div className="flex flex-col items-center gap-4 p-8 text-center">
        <div
          className={cn(
            "flex h-16 w-16 items-center justify-center rounded-full transition-colors",
            isDragActive ? "bg-primary/20" : "bg-secondary",
          )}
        >
          {isDragActive ? (
            <FileVideo className="h-8 w-8 text-primary" />
          ) : (
            <Upload className="h-8 w-8 text-muted-foreground" />
          )}
        </div>

        <div className="space-y-1">
          <p className="text-lg font-medium">
            {isDragActive ? "Drop your MCRAW files here" : "Drag & drop MCRAW files"}
          </p>
          <p className="text-sm text-muted-foreground">or click to browse your computer</p>
        </div>

        <div className="flex items-center gap-2 rounded-full bg-secondary px-4 py-2">
          <FileVideo className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">.mcraw files supported</span>
        </div>
      </div>

      {error && (
        <div className="absolute bottom-4 left-4 right-4 flex items-center gap-2 rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
    </div>
  )
}
