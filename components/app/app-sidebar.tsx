"use client"

import type React from "react"

import { cn } from "@/lib/utils"
import { Film, FolderOpen, ListTodo } from "lucide-react"
import Link from "next/link"

interface AppSidebarProps {
  activeTab: "files" | "queue"
  onTabChange: (tab: "files" | "queue") => void
  filesCount: number
  queueCount: number
}

export function AppSidebar({ activeTab, onTabChange, filesCount, queueCount }: AppSidebarProps) {
  return (
    <aside className="flex w-16 flex-col items-center border-r border-border bg-card py-4 md:w-20">
      <Link href="/" className="mb-8 flex items-center justify-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
          <Film className="h-5 w-5 text-primary-foreground" />
        </div>
      </Link>

      <nav className="flex flex-1 flex-col items-center gap-2">
        <SidebarButton
          icon={FolderOpen}
          label="Files"
          isActive={activeTab === "files"}
          onClick={() => onTabChange("files")}
          badge={filesCount > 0 ? filesCount : undefined}
        />
        <SidebarButton
          icon={ListTodo}
          label="Queue"
          isActive={activeTab === "queue"}
          onClick={() => onTabChange("queue")}
          badge={queueCount > 0 ? queueCount : undefined}
          badgeColor="accent"
        />
      </nav>
    </aside>
  )
}

interface SidebarButtonProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  isActive?: boolean
  onClick: () => void
  badge?: number
  badgeColor?: "primary" | "accent"
}

function SidebarButton({ icon: Icon, label, isActive, onClick, badge, badgeColor = "primary" }: SidebarButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex h-12 w-12 flex-col items-center justify-center rounded-lg transition-colors",
        "hover:bg-secondary",
        isActive && "bg-secondary text-primary",
      )}
      title={label}
    >
      <Icon className={cn("h-5 w-5", isActive ? "text-primary" : "text-muted-foreground")} />
      <span className="sr-only">{label}</span>
      {badge !== undefined && (
        <span
          className={cn(
            "absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-medium",
            badgeColor === "primary" ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground",
          )}
        >
          {badge}
        </span>
      )}
    </button>
  )
}
