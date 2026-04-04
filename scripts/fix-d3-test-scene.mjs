const base = 'http://localhost:3000'
const projectId = 'a9aedcd1-7ce3-4030-98cb-543893ab0d36'

function withDefaults(layer) {
  const raw = layer.config || {}
  const merged = {
    ...raw,
    fontFamily: raw.fontFamily ?? 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
    fontSize: raw.fontSize ?? 16,
    title: raw.title ?? layer.name,
    showGrid: raw.showGrid ?? true,
    showValues: raw.showValues ?? true,
    showLegend: raw.showLegend ?? true,
    axisLabelSize: raw.axisLabelSize ?? 18,
    dataLabelSize: raw.dataLabelSize ?? 16,
    contrastMode: raw.contrastMode ?? 'auto',
  }
  if (['bar', 'horizontalBar', 'stackedBar', 'groupedBar', 'line', 'area', 'scatter'].includes(layer.chartType)) {
    merged.xLabel = raw.xLabel ?? 'Category'
    merged.yLabel = raw.yLabel ?? 'Value'
  }
  return merged
}

function compileSceneCode(layers) {
  const header = [
    "const chartRoot = document.getElementById('chart');",
    'if (chartRoot) {',
    "  chartRoot.style.position = 'relative';",
    "  chartRoot.style.width = '100%';",
    "  chartRoot.style.height = '100%';",
    '}',
  ].join('\n')

  const blocks = (layers || []).map((layer) => {
    const lid = String(layer.id || '').replace(/[^a-zA-Z0-9_-]/g, '')
    const cfg = JSON.stringify(withDefaults(layer))
    const data = JSON.stringify(layer.data ?? [])
    const animate = layer.timing?.animated === false ? '' : '.animate(window.__tl)'
    return [
      '{',
      "  const el = document.createElement('div');",
      `  el.id = 'chart-layer-${lid}';`,
      "  el.style.position = 'absolute';",
      `  el.style.left = '${layer.layout.x}%';`,
      `  el.style.top = '${layer.layout.y}%';`,
      `  el.style.width = '${layer.layout.width}%';`,
      `  el.style.height = '${layer.layout.height}%';`,
      "  el.style.overflow = 'hidden';",
      '  chartRoot.appendChild(el);',
      `  CenchCharts.${layer.chartType}('#' + el.id, ${data}, ${cfg})${animate};`,
      '}',
    ].join('\n')
  })

  return [header, ...blocks].join('\n\n')
}

const p = await fetch(`${base}/api/projects/${projectId}`).then((r) => r.json())
if (!Array.isArray(p.scenes) || p.scenes.length === 0) {
  console.error('No scenes found')
  process.exit(1)
}

const s = p.scenes[0]
const sceneCode = compileSceneCode(s.chartLayers || [])
const scenes = [{
  ...s,
  sceneCode,
  d3Data: { chartLayers: (s.chartLayers || []).map((l) => ({ id: l.id, chartType: l.chartType, data: l.data })) },
}]

const patch = await fetch(`${base}/api/projects/${projectId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ scenes, sceneGraph: p.sceneGraph }),
})
if (!patch.ok) {
  console.error('Patch failed', patch.status, await patch.text())
  process.exit(2)
}

console.log('Patched sceneCode length:', sceneCode.length)
