/**
 * Create a 2-scene project using structured D3 (chartLayers → compileD3SceneFromLayers / CenchCharts).
 * Matches the agent + editor path; preview in the app or at /scenes/{id}.html
 *
 * Usage: npm run dev  →  npx tsx scripts/create-structured-d3-demo.ts
 */
import type { D3ChartLayer } from '../lib/types'

const base = process.env.CENCH_BASE_URL || 'http://localhost:3000'

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

function scene1Charts(): D3ChartLayer[] {
  return [
    {
      id: 'demo-bar-regions',
      name: 'Revenue by region',
      chartType: 'bar',
      data: [
        { label: 'North', value: 42 },
        { label: 'South', value: 58 },
        { label: 'East', value: 35 },
        { label: 'West', value: 71 },
      ],
      config: {
        title: 'Q3 revenue by region',
        subtitle: 'Structured chartLayers (CenchCharts)',
        xLabel: 'Region',
        yLabel: 'USD (M)',
        showGrid: true,
        showValues: true,
        showLegend: false,
      },
      layout: { x: 4, y: 12, width: 44, height: 76 },
      timing: { startAt: 0, duration: 10, animated: true },
    },
    {
      id: 'demo-line-trend',
      name: 'Weekly trend',
      chartType: 'line',
      data: [
        { label: 'W1', value: 12 },
        { label: 'W2', value: 19 },
        { label: 'W3', value: 16 },
        { label: 'W4', value: 24 },
        { label: 'W5', value: 28 },
      ],
      config: {
        title: 'Activation trend',
        xLabel: 'Week',
        yLabel: 'Signups (k)',
        showGrid: true,
        showValues: true,
      },
      layout: { x: 52, y: 12, width: 44, height: 76 },
      timing: { startAt: 0, duration: 10, animated: true },
    },
  ]
}

function scene2Charts(): D3ChartLayer[] {
  return [
    {
      id: 'demo-kpi',
      name: 'North star KPI',
      chartType: 'number',
      data: { value: 94, label: 'Customer satisfaction' },
      config: {
        title: 'This quarter',
        subtitle: 'NPS-style readout',
        theme: 'dark',
      },
      layout: { x: 4, y: 10, width: 44, height: 80 },
      timing: { startAt: 0, duration: 8, animated: true },
    },
    {
      id: 'demo-donut-mix',
      name: 'Traffic mix',
      chartType: 'donut',
      data: [
        { label: 'Organic', value: 45 },
        { label: 'Paid', value: 30 },
        { label: 'Direct', value: 15 },
        { label: 'Referral', value: 10 },
      ],
      config: {
        title: 'Acquisition mix',
        showLegend: true,
        theme: 'dark',
      },
      layout: { x: 52, y: 10, width: 44, height: 80 },
      timing: { startAt: 0, duration: 8, animated: true },
    },
  ]
}

async function run() {
  await j('GET', '/api/projects').catch(() => {
    throw new Error(`Cannot reach ${base}/api/projects — start the app with: npm run dev`)
  })

  const project = await j('POST', '/api/projects', {
    name: `Structured D3 demo ${new Date().toISOString().slice(0, 16)}`,
    outputMode: 'mp4',
  })

  const a = await j('POST', '/api/scene', {
    projectId: project.id,
    name: 'D3 · Bar + line (structured)',
    type: 'd3',
    prompt: 'Two-chart dashboard: regional bar + weekly line. Data is editable in Layers → Charts.',
    generatedCode: '',
    duration: 10,
    bgColor: '#fffef9',
    chartLayers: scene1Charts(),
  })

  const b = await j('POST', '/api/scene', {
    projectId: project.id,
    name: 'D3 · KPI + donut (structured)',
    type: 'd3',
    prompt: 'KPI number + donut split. Uses chartLayers + compile (same as generate_chart / API cench_charts).',
    generatedCode: '',
    duration: 8,
    bgColor: '#0f172a',
    chartLayers: scene2Charts(),
  })

  const out = {
    projectId: project.id,
    projectName: project.name,
    hint: `Open ${base} and load project "${project.name}" from the project list (id: ${project.id}).`,
    scenes: [
      {
        name: a.scene.name,
        id: a.scene.id,
        previewUrl: `${base}${a.scene.previewUrl}`,
        chartCount: scene1Charts().length,
      },
      {
        name: b.scene.name,
        id: b.scene.id,
        previewUrl: `${base}${b.scene.previewUrl}`,
        chartCount: scene2Charts().length,
      },
    ],
  }
  console.log(JSON.stringify(out, null, 2))
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
