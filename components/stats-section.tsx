export function StatsSection() {
  const stats = [
    {
      value: "0ms",
      label: "Initial disk usage",
      description: "Virtual projection",
    },
    {
      value: "16-bit",
      label: "DNG precision",
      description: "Lossless quality",
    },
    {
      value: "∞",
      label: "Frame sequences",
      description: "No file limits",
    },
    {
      value: "4K+",
      label: "Resolution support",
      description: "Any source",
    },
  ]

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 border-y border-border bg-card/50">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div key={index} className="text-center lg:text-left space-y-2">
              <p className="text-3xl sm:text-4xl font-bold text-foreground">{stat.value}</p>
              <p className="text-sm font-medium text-foreground">{stat.label}</p>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
