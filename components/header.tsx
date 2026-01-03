"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Menu, X, Film } from "lucide-react"

export function Header() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Film className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg text-foreground">MotionCam Fuse</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <Link href="#features" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
              Features
            </Link>
            <Link href="#workflow" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
              Workflow
            </Link>
            <Link href="#download" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
              Download
            </Link>
            <Link
              href="https://github.com/xtrul/motioncam-fs"
              target="_blank"
              className="text-muted-foreground hover:text-foreground transition-colors text-sm"
            >
              GitHub
            </Link>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Button variant="outline" size="sm" asChild>
              <Link href="https://discord.gg/Vy4gQNEdNS" target="_blank">
                Join Discord
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="#download">Download</Link>
            </Button>
          </div>

          <button className="md:hidden p-2 text-foreground" onClick={() => setIsOpen(!isOpen)} aria-label="Toggle menu">
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="md:hidden bg-background border-b border-border">
          <nav className="flex flex-col px-4 py-4 gap-4">
            <Link
              href="#features"
              className="text-muted-foreground hover:text-foreground transition-colors py-2"
              onClick={() => setIsOpen(false)}
            >
              Features
            </Link>
            <Link
              href="#workflow"
              className="text-muted-foreground hover:text-foreground transition-colors py-2"
              onClick={() => setIsOpen(false)}
            >
              Workflow
            </Link>
            <Link
              href="#download"
              className="text-muted-foreground hover:text-foreground transition-colors py-2"
              onClick={() => setIsOpen(false)}
            >
              Download
            </Link>
            <Link
              href="https://github.com/xtrul/motioncam-fs"
              target="_blank"
              className="text-muted-foreground hover:text-foreground transition-colors py-2"
            >
              GitHub
            </Link>
            <div className="flex flex-col gap-2 pt-2">
              <Button variant="outline" asChild>
                <Link href="https://discord.gg/Vy4gQNEdNS" target="_blank">
                  Join Discord
                </Link>
              </Button>
              <Button asChild>
                <Link href="#download">Download</Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
