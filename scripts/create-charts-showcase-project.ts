/**
 * Create a project with many D3 scenes that exercise structured chart types
 * (CenchCharts, Plotly, Recharts) plus layout / theme / animation variations.
 *
 * Requires: npm run dev  →  npm run charts-showcase
 */
import type { D3ChartLayer } from '../lib/types'

const base = process.env.CENCH_BASE_URL || 'http://localhost:3000'

const T = (startAt: number, duration: number, animated: boolean) => ({
  startAt,
  duration,
  animated,
})

async function j(method: string, path: string, body?: object) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    data = { raw: text }
  }
  if (!res.ok) throw new Error(`${method} ${path} ${res.status} ${JSON.stringify(data).slice(0, 800)}`)
  return data as any
}

/** Scene 1 — CenchCharts bar family (2×2) */
function sceneBarFamily(): D3ChartLayer[] {
  return [
    {
      id: 'show-bar',
      name: 'Bar (animated)',
      chartType: 'bar',
      data: [
        { label: 'A', value: 32 },
        { label: 'B', value: 48 },
        { label: 'C', value: 27 },
        { label: 'D', value: 55 },
      ],
      config: {
        title: 'Vertical bar',
        subtitle: 'Animated reveal',
        xLabel: 'Category',
        yLabel: 'Units',
        showGrid: true,
        showValues: true,
        colors: ['#4c9be8', '#e86b4c', '#4ce8a0', '#e8c84c'],
      },
      layout: { x: 4, y: 10, width: 44, height: 38 },
      timing: T(0, 10, true),
    },
    {
      id: 'show-hbar',
      name: 'Horizontal bar',
      chartType: 'horizontalBar',
      data: [
        { label: 'Design', value: 78 },
        { label: 'Build', value: 62 },
        { label: 'Ship', value: 91 },
      ],
      config: {
        title: 'Horizontal bar',
        subtitle: 'Static (no GSAP)',
        showGrid: true,
        showValues: true,
        theme: 'dark',
      },
      layout: { x: 52, y: 10, width: 44, height: 38 },
      timing: T(0, 10, false),
    },
    {
      id: 'show-stacked',
      name: 'Stacked bar',
      chartType: 'stackedBar',
      data: [
        { label: 'Q1', values: { new: 28, renew: 42 } },
        { label: 'Q2', values: { new: 35, renew: 38 } },
        { label: 'Q3', values: { new: 31, renew: 45 } },
      ],
      config: {
        title: 'Stacked bar',
        showLegend: true,
        legendLabels: { new: 'New', renew: 'Renew' },
        xLabel: 'Quarter',
        yLabel: 'ARR (M)',
      },
      layout: { x: 4, y: 52, width: 44, height: 42 },
      timing: T(0, 10, true),
    },
    {
      id: 'show-grouped',
      name: 'Grouped bar',
      chartType: 'groupedBar',
      data: [
        { label: 'Mon', values: { in: 12, out: 8 } },
        { label: 'Tue', values: { in: 18, out: 11 } },
        { label: 'Wed', values: { in: 15, out: 14 } },
      ],
      config: {
        title: 'Grouped bar',
        showLegend: true,
        legendLabels: { in: 'Inbound', out: 'Outbound' },
      },
      layout: { x: 52, y: 52, width: 44, height: 42 },
      timing: T(0, 10, false),
    },
  ]
}

/** Scene 2 — Line, area, scatter (2×2) */
function sceneLineAreaScatter(): D3ChartLayer[] {
  return [
    {
      id: 'show-line',
      name: 'Line',
      chartType: 'line',
      data: [
        { label: 'T1', value: 14 },
        { label: 'T2', value: 22 },
        { label: 'T3', value: 18 },
        { label: 'T4', value: 30 },
        { label: 'T5', value: 26 },
      ],
      config: {
        title: 'Line chart',
        xLabel: 'Time',
        yLabel: 'Rate',
        showGrid: true,
        showValues: false,
      },
      layout: { x: 4, y: 10, width: 44, height: 38 },
      timing: T(0, 10, true),
    },
    {
      id: 'show-area',
      name: 'Area',
      chartType: 'area',
      data: [
        { label: 'Jan', value: 20 },
        { label: 'Feb', value: 35 },
        { label: 'Mar', value: 28 },
        { label: 'Apr', value: 42 },
      ],
      config: {
        title: 'Area chart',
        showGrid: true,
      },
      layout: { x: 52, y: 10, width: 44, height: 38 },
      timing: T(0, 10, true),
    },
    {
      id: 'show-scatter-cat',
      name: 'Scatter (categories)',
      chartType: 'scatter',
      data: [
        { label: 'α', value: 8 },
        { label: 'β', value: 22 },
        { label: 'γ', value: 15 },
        { label: 'δ', value: 31 },
      ],
      config: {
        title: 'Scatter · point scale',
        showGrid: true,
      },
      layout: { x: 4, y: 52, width: 44, height: 40 },
      timing: T(0, 10, false),
    },
    {
      id: 'show-scatter-xy',
      name: 'Scatter (x,y)',
      chartType: 'scatter',
      data: [
        { x: 2, y: 14, size: 8 },
        { x: 5, y: 22, size: 12 },
        { x: 8, y: 18, size: 10 },
        { x: 11, y: 28, size: 14 },
        { x: 14, y: 24, size: 9 },
      ],
      config: {
        title: 'Scatter · linear x,y',
        xLabel: 'Dose',
        yLabel: 'Response',
        showGrid: true,
      },
      layout: { x: 52, y: 52, width: 44, height: 40 },
      timing: T(0, 10, false),
    },
  ]
}

/** Scene 3 — Pie, donut, funnel, KPI number, gauge */
function sceneRadialAndKpi(): D3ChartLayer[] {
  return [
    {
      id: 'show-pie',
      name: 'Pie',
      chartType: 'pie',
      data: [
        { label: 'A', value: 30 },
        { label: 'B', value: 25 },
        { label: 'C', value: 20 },
        { label: 'D', value: 25 },
      ],
      config: { title: 'Pie chart', showLegend: false },
      layout: { x: 4, y: 10, width: 30, height: 42 },
      timing: T(0, 10, true),
    },
    {
      id: 'show-donut',
      name: 'Donut',
      chartType: 'donut',
      data: [
        { label: 'Web', value: 42 },
        { label: 'API', value: 28 },
        { label: 'Mobile', value: 18 },
        { label: 'Other', value: 12 },
      ],
      config: { title: 'Donut · mix', showLegend: true },
      layout: { x: 36, y: 10, width: 30, height: 42 },
      timing: T(0, 10, true),
    },
    {
      id: 'show-funnel',
      name: 'Funnel',
      chartType: 'funnel',
      data: [
        { label: 'Visitors', value: 100 },
        { label: 'Signups', value: 48 },
        { label: 'Active', value: 22 },
        { label: 'Paid', value: 9 },
      ],
      config: { title: 'Funnel', showGrid: false, showValues: true },
      layout: { x: 68, y: 10, width: 28, height: 42 },
      timing: T(0, 10, true),
    },
    {
      id: 'show-number',
      name: 'Number KPI',
      chartType: 'number',
      data: { value: 128, label: 'Active projects' },
      config: { title: 'Big number', subtitle: 'KPI readout', theme: 'dark' },
      layout: { x: 4, y: 56, width: 44, height: 38 },
      timing: T(0, 10, true),
    },
    {
      id: 'show-gauge',
      name: 'Gauge',
      chartType: 'gauge',
      data: { value: 73, max: 100 },
      config: { title: 'Gauge', valueSuffix: '%' },
      layout: { x: 52, y: 56, width: 44, height: 38 },
      timing: T(0, 10, true),
    },
  ]
}

/** Scene 4 — Plotly */
function scenePlotly(): D3ChartLayer[] {
  return [
    {
      id: 'show-plotly-bars',
      name: 'Plotly bars',
      chartType: 'plotly',
      data: {
        traces: [
          {
            type: 'bar',
            name: 'Sales',
            x: ['P1', 'P2', 'P3', 'P4'],
            y: [12, 19, 14, 22],
            marker: { color: '#4c9be8' },
          },
        ],
      },
      config: {
        plotlyLayout: {
          title: { text: 'Plotly bar', font: { size: 14 } },
          margin: { t: 48, b: 40 },
        },
      },
      layout: { x: 4, y: 10, width: 46, height: 80 },
      timing: T(0, 12, false),
    },
    {
      id: 'show-plotly-line',
      name: 'Plotly line',
      chartType: 'plotly',
      data: {
        traces: [
          {
            type: 'scatter',
            mode: 'lines+markers',
            name: 'Series',
            x: [1, 2, 3, 4, 5, 6],
            y: [8, 12, 10, 16, 14, 20],
            line: { shape: 'spline', width: 3, color: '#e86b4c' },
          },
        ],
      },
      config: {
        plotlyLayout: {
          title: { text: 'Plotly line', font: { size: 14 } },
          margin: { t: 44, b: 36 },
        },
      },
      layout: { x: 52, y: 10, width: 44, height: 80 },
      timing: T(0, 12, false),
    },
  ]
}

/** Scene 5 — Recharts */
function sceneRecharts(): D3ChartLayer[] {
  return [
    {
      id: 'show-rc-bar',
      name: 'Recharts bar',
      chartType: 'recharts',
      data: [
        { label: 'Mon', value: 40 },
        { label: 'Tue', value: 65 },
        { label: 'Wed', value: 52 },
        { label: 'Thu', value: 78 },
      ],
      config: {
        title: 'Recharts · bar',
        rechartsVariant: 'bar',
        showGrid: true,
        colors: ['#7c3aed'],
      },
      layout: { x: 4, y: 10, width: 30, height: 80 },
      timing: T(0, 10, false),
    },
    {
      id: 'show-rc-line',
      name: 'Recharts line',
      chartType: 'recharts',
      data: [
        { label: 'S1', value: 12 },
        { label: 'S2', value: 19 },
        { label: 'S3', value: 15 },
        { label: 'S4', value: 24 },
      ],
      config: {
        title: 'Recharts · line',
        rechartsVariant: 'line',
        colors: ['#0ea5e9', '#f97316'],
      },
      layout: { x: 36, y: 10, width: 30, height: 80 },
      timing: T(0, 10, false),
    },
    {
      id: 'show-rc-area',
      name: 'Recharts area',
      chartType: 'recharts',
      data: [
        { label: 'Q1', value: 22 },
        { label: 'Q2', value: 35 },
        { label: 'Q3', value: 28 },
        { label: 'Q4', value: 41 },
      ],
      config: {
        title: 'Recharts · area',
        rechartsVariant: 'area',
        colors: ['#22c55e'],
      },
      layout: { x: 68, y: 10, width: 28, height: 80 },
      timing: T(0, 10, false),
    },
  ]
}

/** Scene 6 — Theme & ink */
function sceneThemeVariations(): D3ChartLayer[] {
  return [
    {
      id: 'show-light-bar',
      name: 'Light theme bar',
      chartType: 'bar',
      data: [
        { label: 'One', value: 24 },
        { label: 'Two', value: 36 },
        { label: 'Three', value: 29 },
      ],
      config: {
        title: 'Light theme',
        theme: 'light',
        plotBackground: '#f8fafc',
        textColor: '#0f172a',
        axisColor: '#94a3b8',
        gridColor: 'rgba(15,23,42,0.08)',
        colors: ['#2563eb', '#e11d48', '#16a34a'],
      },
      layout: { x: 4, y: 10, width: 44, height: 78 },
      timing: T(0, 10, false),
    },
    {
      id: 'show-ink-bar',
      name: 'Custom ink bar',
      chartType: 'bar',
      data: [
        { label: 'A', value: 50 },
        { label: 'B', value: 70 },
      ],
      config: {
        title: 'Custom colors',
        subtitle: 'titleColor / valueLabelColor / barStroke',
        theme: 'dark',
        titleColor: '#fbbf24',
        valueLabelColor: '#a5f3fc',
        barStroke: '#f472b6',
        barStrokeWidth: 2,
        colors: ['#6366f1', '#ec4899'],
        showValues: true,
      },
      layout: { x: 52, y: 10, width: 44, height: 78 },
      timing: T(0, 10, true),
    },
  ]
}

/** Scene 7 — Cench + Plotly + Recharts */
function sceneKitchenSink(): D3ChartLayer[] {
  return [
    {
      id: 'sink-cench',
      name: 'Cench mini bar',
      chartType: 'bar',
      data: [
        { label: 'x', value: 6 },
        { label: 'y', value: 9 },
      ],
      config: { title: 'CenchCharts', showValues: true },
      layout: { x: 4, y: 12, width: 28, height: 76 },
      timing: T(0, 10, false),
    },
    {
      id: 'sink-plotly',
      name: 'Plotly mini',
      chartType: 'plotly',
      data: { traces: [{ type: 'bar', x: ['a', 'b'], y: [3, 7], marker: { color: '#eab308' } }] },
      config: {
        plotlyLayout: { title: { text: 'Plotly', font: { size: 12 } }, margin: { t: 36, b: 28 } },
      },
      layout: { x: 34, y: 12, width: 30, height: 76 },
      timing: T(0, 10, false),
    },
    {
      id: 'sink-recharts',
      name: 'Recharts mini',
      chartType: 'recharts',
      data: [
        { label: 'i', value: 5 },
        { label: 'ii', value: 8 },
        { label: 'iii', value: 6 },
      ],
      config: { title: 'Recharts', rechartsVariant: 'bar', colors: ['#f43f5e'] },
      layout: { x: 66, y: 12, width: 30, height: 76 },
      timing: T(0, 10, false),
    },
  ]
}

async function run() {
  await j('GET', '/api/projects').catch(() => {
    throw new Error(`Cannot reach ${base}/api/projects — start the app with: npm run dev`)
  })

  const stamp = new Date().toISOString().slice(0, 16)
  const project = await j('POST', '/api/projects', {
    name: `Charts showcase (all types) ${stamp}`,
    outputMode: 'mp4',
  })

  const scenesDef: { name: string; prompt: string; duration: number; bgColor: string; layers: D3ChartLayer[] }[] = [
    {
      name: '01 · Cench bar family',
      prompt: 'Bar, horizontalBar, stackedBar, groupedBar — animated + static mix.',
      duration: 10,
      bgColor: '#181818',
      layers: sceneBarFamily(),
    },
    {
      name: '02 · Cench line, area, scatter',
      prompt: 'Line + area + two scatter modes (category vs x,y).',
      duration: 10,
      bgColor: '#0f172a',
      layers: sceneLineAreaScatter(),
    },
    {
      name: '03 · Cench pie, donut, funnel, number, gauge',
      prompt: 'Radial + funnel + KPI number + gauge.',
      duration: 10,
      bgColor: '#181818',
      layers: sceneRadialAndKpi(),
    },
    {
      name: '04 · Plotly bar + line',
      prompt: 'Two Plotly layers (CDN + network).',
      duration: 12,
      bgColor: '#111827',
      layers: scenePlotly(),
    },
    {
      name: '05 · Recharts bar, line, area',
      prompt: 'Recharts in scene (esm.sh).',
      duration: 10,
      bgColor: '#181818',
      layers: sceneRecharts(),
    },
    {
      name: '06 · Variations light theme + custom ink',
      prompt: 'Light theme + custom stroke/colors on dark.',
      duration: 10,
      bgColor: '#0c0c0e',
      layers: sceneThemeVariations(),
    },
    {
      name: '07 · Kitchen sink (Cench + Plotly + Recharts)',
      prompt: 'One scene with all three engines side by side.',
      duration: 10,
      bgColor: '#181818',
      layers: sceneKitchenSink(),
    },
  ]

  const created: { id: string; name: string; chartCount: number; previewUrl: string }[] = []
  for (const s of scenesDef) {
    const res = await j('POST', '/api/scene', {
      projectId: project.id,
      name: s.name,
      type: 'd3',
      prompt: s.prompt,
      generatedCode: '',
      duration: s.duration,
      bgColor: s.bgColor,
      chartLayers: s.layers,
    })
    created.push({
      id: res.scene.id,
      name: res.scene.name,
      chartCount: s.layers.length,
      previewUrl: `${base}${res.scene.previewUrl}`,
    })
  }

  console.log(
    JSON.stringify(
      {
        projectId: project.id,
        projectName: project.name,
        sceneCount: created.length,
        hint: `Open ${base} and load project "${project.name}" (id: ${project.id}).`,
        scenes: created,
      },
      null,
      2,
    ),
  )
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
