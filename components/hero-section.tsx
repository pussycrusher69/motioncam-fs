import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { ArrowRight, Play } from "lucide-react"

export function HeroSection() {
  return (
    <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Gradient background effect */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background" />

      <div className="relative max-w-7xl mx-auto">
        <div className="text-center space-y-8">
          <Badge variant="secondary" className="px-4 py-2 text-sm">
            <span className="mr-2">🎬</span>
            Work in Progress — Open Source RAW Processing
          </Badge>

          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight text-balance">
            <span className="text-foreground">Virtual File System for</span>
            <br />
            <span className="text-primary">RAW Video Editing</span>
          </h1>

          <p className="max-w-2xl mx-auto text-lg sm:text-xl text-muted-foreground text-balance leading-relaxed">
            Mount MCRAW files as DNG sequences for seamless editing in DaVinci Resolve. Professional-grade exposure
            normalization, vignette correction, and intelligent framerate handling.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Button size="lg" className="w-full sm:w-auto min-h-[48px] text-base" asChild>
              <Link href="#download">
                Download for Windows
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto min-h-[48px] text-base bg-transparent"
              asChild
            >
              <Link href="https://youtu.be/knACG5jy-rk" target="_blank">
                <Play className="mr-2 w-5 h-5" />
                Watch Showcase
              </Link>
            </Button>
          </div>
        </div>

        {/* App Screenshot */}
        <div className="mt-16 relative">
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10 pointer-events-none" />
          <div className="relative rounded-xl overflow-hidden border border-border bg-card shadow-2xl">
            <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b border-border">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-destructive/60" />
                <div className="w-3 h-3 rounded-full bg-chart-4/60" />
                <div className="w-3 h-3 rounded-full bg-accent/60" />
              </div>
              <span className="text-xs text-muted-foreground ml-4 font-mono">MotionCam Fuse v1.0</span>
            </div>
            <div className="p-6 bg-card">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* File List Panel */}
                <div className="bg-muted/30 rounded-lg p-4 border border-border">
                  <h3 className="text-sm font-medium text-foreground mb-3">MCRAW Files</h3>
                  <div className="space-y-2">
                    {["shot_001.mcraw", "shot_002.mcraw", "shot_003.mcraw", "b-roll_sunset.mcraw"].map((file, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-3 p-2 rounded ${i === 0 ? "bg-primary/20 border border-primary/30" : "hover:bg-muted/50"} transition-colors cursor-pointer`}
                      >
                        <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center">
                          <span className="text-xs font-mono text-primary">RAW</span>
                        </div>
                        <span className="text-sm text-foreground">{file}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Preview Panel */}
                <div className="lg:col-span-2 bg-muted/30 rounded-lg border border-border overflow-hidden">
                  <div className="aspect-video bg-[#1a1a1a] flex items-center justify-center relative">
                    <img
                      src="/cinematic-raw-footage-frame-film-grain.jpg"
                      alt="RAW video preview"
                      className="w-full h-full object-cover opacity-80"
                    />
                    <div className="absolute bottom-4 left-4 flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono text-xs">
                        4K 24fps
                      </Badge>
                      <Badge variant="secondary" className="font-mono text-xs">
                        12-bit RAW
                      </Badge>
                    </div>
                  </div>
                  <div className="p-4 flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">shot_001.mcraw</p>
                      <p className="text-xs text-muted-foreground">1,248 frames • 52s duration</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-accent border-accent">
                        Mounted
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
