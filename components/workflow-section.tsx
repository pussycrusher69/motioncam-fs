import { Badge } from "@/components/ui/badge"

export function WorkflowSection() {
  const steps = [
    {
      step: "01",
      title: "Mount MCRAW Files",
      description:
        "Select your MCRAW files captured with MotionCam. They will appear as virtual folders in the same directory.",
    },
    {
      step: "02",
      title: "Configure Processing",
      description:
        "Adjust framerate handling, exposure normalization, vignette correction, and other preprocessing options to match your workflow.",
    },
    {
      step: "03",
      title: "Access DNG Sequences",
      description:
        "Virtual DNG files are projected with zero initial disk usage. Files are cached on-demand as you access them.",
    },
    {
      step: "04",
      title: "Edit in DaVinci Resolve",
      description:
        "Import the DNG sequences directly into your timeline. Full RAW control with professional color grading capabilities.",
    },
  ]

  return (
    <section id="workflow" className="py-24 px-4 sm:px-6 lg:px-8 bg-card/30">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16 space-y-4">
          <Badge variant="secondary" className="px-4 py-1">
            Workflow
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">From Capture to Edit</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            A streamlined workflow that bridges mobile RAW capture with professional video editing.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((item, index) => (
            <div key={index} className="relative">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <span className="text-5xl font-bold text-primary/30">{item.step}</span>
                  {index < steps.length - 1 && <div className="hidden lg:block flex-1 h-px bg-border" />}
                </div>
                <h3 className="text-xl font-semibold text-foreground">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Code example */}
        <div className="mt-16 rounded-xl bg-muted/30 border border-border overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b border-border">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
              <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
              <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
            </div>
            <span className="text-xs text-muted-foreground ml-4 font-mono">File Structure</span>
          </div>
          <pre className="p-6 text-sm font-mono overflow-x-auto">
            <code className="text-muted-foreground">
              {`📁 Videos/
├── 📄 shot_001.mcraw           # Original capture file
├── 📁 shot_001/                # Virtual mounted folder
│   ├── 📄 frame_00001.dng     # Projected DNG (0 bytes until accessed)
│   ├── 📄 frame_00002.dng
│   ├── 📄 frame_00003.dng
│   └── ...
├── 📄 shot_002.mcraw
└── 📁 shot_002/`}
            </code>
          </pre>
        </div>
      </div>
    </section>
  )
}
