'use client'

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'

const sample = [
  { month: 'Jan', desktop: 186, mobile: 80 },
  { month: 'Feb', desktop: 305, mobile: 200 },
  { month: 'Mar', desktop: 237, mobile: 120 },
  { month: 'Apr', desktop: 273, mobile: 190 },
  { month: 'May', desktop: 209, mobile: 130 },
  { month: 'Jun', desktop: 214, mobile: 140 },
]

const dualConfig = {
  desktop: { label: 'Desktop', color: 'var(--chart-1)' },
  mobile: { label: 'Mobile', color: 'var(--chart-2)' },
} satisfies ChartConfig

const singleConfig = {
  value: { label: 'Sessions', color: 'var(--chart-3)' },
} satisfies ChartConfig

const lineData = sample.map((d) => ({ month: d.month, value: d.desktop + d.mobile }))

export default function ShadcnChartsShowcase() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-10 py-8">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">shadcn/ui charts (Recharts)</h1>
        <p className="text-[12px] leading-relaxed text-[var(--color-text-muted)]">
          Primitives from{' '}
          <a
            href="https://github.com/shadcn-ui/ui"
            target="_blank"
            rel="noreferrer"
            className="text-[var(--color-accent)] underline"
          >
            shadcn/ui
          </a>{' '}
          — use <code className="rounded bg-[var(--color-input-bg)] px-1 font-mono text-[11px]">ChartContainer</code>,{' '}
          <code className="rounded bg-[var(--color-input-bg)] px-1 font-mono text-[11px]">ChartTooltipContent</code>,
          and Recharts in the app. For <strong className="text-[var(--color-text-primary)]">video scenes</strong>, pick
          chart type <code className="rounded bg-[var(--color-input-bg)] px-1 font-mono text-[11px]">recharts</code> on
          a D3 scene — the same bar/line/area look is mounted inside the scene iframe.
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Bar</h2>
        <ChartContainer config={dualConfig} className="h-[260px] w-full">
          <BarChart accessibilityLayer data={sample}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="month" tickLine={false} tickMargin={8} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={36} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="desktop" fill="var(--color-desktop)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="mobile" fill="var(--color-mobile)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </section>

      <section className="space-y-2">
        <h2 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Line</h2>
        <ChartContainer config={singleConfig} className="h-[220px] w-full">
          <LineChart accessibilityLayer data={lineData}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="month" tickLine={false} tickMargin={8} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={36} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ChartContainer>
      </section>

      <section className="space-y-2">
        <h2 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Area</h2>
        <ChartContainer config={singleConfig} className="h-[220px] w-full">
          <AreaChart accessibilityLayer data={lineData}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="month" tickLine={false} tickMargin={8} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={36} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              type="monotone"
              dataKey="value"
              fill="var(--color-value)"
              fillOpacity={0.25}
              stroke="var(--color-value)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </section>
    </div>
  )
}
