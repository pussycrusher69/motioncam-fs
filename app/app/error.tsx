"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[v0] App crashed:", error)
  }, [error])

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background p-4">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Something went wrong</h2>
        <p className="text-muted-foreground max-w-md">The app encountered an error. Check the console for details.</p>
        <pre className="mt-4 p-4 bg-muted rounded text-xs text-left overflow-auto max-w-2xl max-h-40">
          {error.message}
        </pre>
      </div>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  )
}
