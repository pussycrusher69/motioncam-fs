"use client"

import type { ProcessingSettings } from "@/lib/types"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Settings, Film, Sun, CircleDot, Scissors, Download } from "lucide-react"

interface SettingsPanelProps {
  settings: ProcessingSettings
  onSettingsChange: (settings: ProcessingSettings) => void
}

export function SettingsPanel({ settings, onSettingsChange }: SettingsPanelProps) {
  const update = <K extends keyof ProcessingSettings>(key: K, value: ProcessingSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Settings className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold">Processing Settings</h2>
      </div>

      <Tabs defaultValue="general" className="flex-1">
        <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent px-4">
          <TabsTrigger value="general" className="gap-1.5 text-xs">
            <Film className="h-3 w-3" />
            General
          </TabsTrigger>
          <TabsTrigger value="color" className="gap-1.5 text-xs">
            <Sun className="h-3 w-3" />
            Color
          </TabsTrigger>
          <TabsTrigger value="crop" className="gap-1.5 text-xs">
            <Scissors className="h-3 w-3" />
            Crop
          </TabsTrigger>
          <TabsTrigger value="output" className="gap-1.5 text-xs">
            <Download className="h-3 w-3" />
            Output
          </TabsTrigger>
        </TabsList>

        <div className="overflow-auto p-4">
          <TabsContent value="general" className="m-0 space-y-6">
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <Film className="h-4 w-4 text-muted-foreground" />
                Framerate
              </h3>

              <div className="space-y-2">
                <Label htmlFor="originalFps" className="text-sm">
                  Original Recording FPS
                </Label>
                <p className="text-xs text-muted-foreground">Set the framerate your video was recorded at</p>
                <Select
                  value={settings.originalFps.toString()}
                  onValueChange={(v) => update("originalFps", Number.parseInt(v) as 18 | 24 | 25 | 30)}
                >
                  <SelectTrigger id="originalFps">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="18">18 fps</SelectItem>
                    <SelectItem value="24">24 fps (Cinema)</SelectItem>
                    <SelectItem value="25">25 fps (PAL)</SelectItem>
                    <SelectItem value="30">30 fps (NTSC)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="useOriginalFps" className="text-sm">
                  Use original FPS for output
                </Label>
                <Switch
                  id="useOriginalFps"
                  checked={settings.useOriginalFps}
                  onCheckedChange={(v) => update("useOriginalFps", v)}
                />
              </div>

              {!settings.useOriginalFps && (
                <div className="space-y-2">
                  <Label htmlFor="targetFps" className="text-sm">
                    Target Output FPS
                  </Label>
                  <Select
                    value={settings.targetFps.toString()}
                    onValueChange={(v) => update("targetFps", Number.parseInt(v))}
                  >
                    <SelectTrigger id="targetFps">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24">24 fps (Cinema)</SelectItem>
                      <SelectItem value="25">25 fps (PAL)</SelectItem>
                      <SelectItem value="30">30 fps (NTSC)</SelectItem>
                      <SelectItem value="60">60 fps (High Frame Rate)</SelectItem>
                      <SelectItem value="120">120 fps (Slow Motion)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="color" className="m-0 space-y-6">
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <Sun className="h-4 w-4 text-muted-foreground" />
                Exposure
              </h3>

              <div className="flex items-center justify-between">
                <Label htmlFor="normalizeExposure" className="text-sm">
                  Normalize exposure
                </Label>
                <Switch
                  id="normalizeExposure"
                  checked={settings.normalizeExposure}
                  onCheckedChange={(v) => update("normalizeExposure", v)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Exposure compensation</Label>
                  <span className="text-sm text-muted-foreground">
                    {settings.exposureCompensation > 0 ? "+" : ""}
                    {settings.exposureCompensation} EV
                  </span>
                </div>
                <Slider
                  value={[settings.exposureCompensation]}
                  onValueChange={([v]) => update("exposureCompensation", v)}
                  min={-3}
                  max={3}
                  step={0.5}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <CircleDot className="h-4 w-4 text-muted-foreground" />
                Vignette Correction
              </h3>

              <div className="flex items-center justify-between">
                <Label htmlFor="correctVignette" className="text-sm">
                  Enable correction
                </Label>
                <Switch
                  id="correctVignette"
                  checked={settings.correctVignette}
                  onCheckedChange={(v) => update("correctVignette", v)}
                />
              </div>

              {settings.correctVignette && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Strength</Label>
                    <span className="text-sm text-muted-foreground">{settings.vignetteStrength}%</span>
                  </div>
                  <Slider
                    value={[settings.vignetteStrength]}
                    onValueChange={([v]) => update("vignetteStrength", v)}
                    min={0}
                    max={100}
                    step={5}
                  />
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium">Transfer Curve</h3>
              <Select
                value={settings.transferCurve}
                onValueChange={(v) => update("transferCurve", v as ProcessingSettings["transferCurve"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="linear">Linear</SelectItem>
                  <SelectItem value="srgb">sRGB</SelectItem>
                  <SelectItem value="logC">ARRI LogC</SelectItem>
                  <SelectItem value="slog3">Sony S-Log3</SelectItem>
                  <SelectItem value="vlog">Panasonic V-Log</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="crop" className="m-0 space-y-6">
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <Scissors className="h-4 w-4 text-muted-foreground" />
                Cropping
              </h3>

              <div className="space-y-2">
                <Label className="text-sm">Crop Mode</Label>
                <Select
                  value={settings.cropMode}
                  onValueChange={(v) => update("cropMode", v as ProcessingSettings["cropMode"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Cropping</SelectItem>
                    <SelectItem value="auto">Auto (Remove Black Edges)</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {settings.cropMode === "custom" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="cropTop" className="text-xs">
                      Top
                    </Label>
                    <Input
                      id="cropTop"
                      type="number"
                      value={settings.cropTop}
                      onChange={(e) => update("cropTop", Number.parseInt(e.target.value) || 0)}
                      min={0}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cropBottom" className="text-xs">
                      Bottom
                    </Label>
                    <Input
                      id="cropBottom"
                      type="number"
                      value={settings.cropBottom}
                      onChange={(e) => update("cropBottom", Number.parseInt(e.target.value) || 0)}
                      min={0}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cropLeft" className="text-xs">
                      Left
                    </Label>
                    <Input
                      id="cropLeft"
                      type="number"
                      value={settings.cropLeft}
                      onChange={(e) => update("cropLeft", Number.parseInt(e.target.value) || 0)}
                      min={0}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cropRight" className="text-xs">
                      Right
                    </Label>
                    <Input
                      id="cropRight"
                      type="number"
                      value={settings.cropRight}
                      onChange={(e) => update("cropRight", Number.parseInt(e.target.value) || 0)}
                      min={0}
                    />
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="output" className="m-0 space-y-6">
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <Download className="h-4 w-4 text-muted-foreground" />
                Output Format
              </h3>

              <div className="space-y-2">
                <Label className="text-sm">Format</Label>
                <Select
                  value={settings.outputFormat}
                  onValueChange={(v) => update("outputFormat", v as ProcessingSettings["outputFormat"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dng">DNG (Cinema DNG)</SelectItem>
                    <SelectItem value="tiff">TIFF</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Bit Depth</Label>
                <Select
                  value={settings.outputBitDepth.toString()}
                  onValueChange={(v) => update("outputBitDepth", Number.parseInt(v) as 12 | 14 | 16)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12">12-bit</SelectItem>
                    <SelectItem value="14">14-bit</SelectItem>
                    <SelectItem value="16">16-bit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="compressionEnabled" className="text-sm">
                  Enable compression
                </Label>
                <Switch
                  id="compressionEnabled"
                  checked={settings.compressionEnabled}
                  onCheckedChange={(v) => update("compressionEnabled", v)}
                />
              </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
