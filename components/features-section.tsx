import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Gauge, Sun, Aperture, Layers, Crop, Grid3X3 } from "lucide-react"

export function FeaturesSection() {
  const features = [
    {
      icon: Gauge,
      title: "Intelligent Framerate Handling",
      description:
        "Automatically converts variable frame rates to standard delivery rates based on median analysis. Perfect for real-time playback in DaVinci Resolve.",
    },
    {
      icon: Sun,
      title: "Exposure Normalization",
      description:
        "Compensates for exposure changes between frames using per-frame Baseline Exposure DNG tags. Eliminates unwanted exposure transitions in your footage.",
    },
    {
      icon: Aperture,
      title: "Vignette Correction",
      description:
        "Apply gainmap-based vignette correction with per-channel color correction. Compensate for lens vignetting while preserving natural dynamic range.",
    },
    {
      icon: Layers,
      title: "Log Transfer Curve",
      description:
        "Logarithmic transfer curve with dithering allows reduced bit depth while staying visually lossless. 10-bit to 8-bit, 12-bit to 10-bit conversions.",
    },
    {
      icon: Crop,
      title: "Smart Cropping",
      description:
        "Off-center cropping for 16:9 sensor modes with buffer underflow. Proper alignment for vignette correction on cropped captures.",
    },
    {
      icon: Grid3X3,
      title: "Quad Bayer Support",
      description:
        "Full support for unbinned quad bayer CFA footage. Apply vignette correction and log curves to both binned and unbinned data.",
    },
  ]

  return (
    <section id="features" className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Professional-Grade Features</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Everything you need for a seamless RAW video editing workflow, from capture to delivery.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <Card key={index} className="bg-card border-border hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-lg text-foreground">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
