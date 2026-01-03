import Link from "next/link"
import { Film } from "lucide-react"

export function Footer() {
  return (
    <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-border">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Film className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">MotionCam Fuse</span>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-6">
            <Link
              href="https://github.com/xtrul/motioncam-fs"
              target="_blank"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              GitHub
            </Link>
            <Link
              href="https://discord.gg/Vy4gQNEdNS"
              target="_blank"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Discord
            </Link>
            <Link
              href="https://youtu.be/knACG5jy-rk"
              target="_blank"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Showcase
            </Link>
            <Link
              href="https://github.com/motioncam-app/motioncam-fs"
              target="_blank"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Original Project
            </Link>
          </nav>

          <p className="text-sm text-muted-foreground">Open source • MIT License</p>
        </div>
      </div>
    </footer>
  )
}
