"use client"

import { Button } from "@/components/ui/button"
import { Play, Download, Trash2, MoreHorizontal } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface AppHeaderProps {
  selectedCount: number
  totalFiles: number
  onStartProcessing: () => void
  canProcess: boolean
  activeTab: "files" | "queue"
}

export function AppHeader({ selectedCount, totalFiles, onStartProcessing, canProcess, activeTab }: AppHeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 md:h-16 md:px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold md:text-xl">
          {activeTab === "files" ? "File Browser" : "Processing Queue"}
        </h1>
        {activeTab === "files" && totalFiles > 0 && (
          <span className="text-sm text-muted-foreground">
            {selectedCount > 0 ? `${selectedCount} selected` : `${totalFiles} files`}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {activeTab === "files" && (
          <>
            <Button onClick={onStartProcessing} disabled={!canProcess} className="gap-2">
              <Play className="h-4 w-4" />
              <span className="hidden sm:inline">Process</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="md:hidden bg-transparent">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Download className="mr-2 h-4 w-4" />
                  Export Settings
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear All
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    </header>
  )
}
