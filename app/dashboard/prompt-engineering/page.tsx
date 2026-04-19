'use client'

import { useState, useEffect, useCallback } from 'react'

type DimensionKey = 'scene_type' | 'model_used' | 'thinking_mode' | 'style_preset_id' | 'agent_type'

interface DimensionRow {
  dimension_value: string
  avg_quality: number
  total_count: number
  regen_count: number
  kept_count: number
  edited_count: number
  avg_cost: number
}

interface AnalysisResult {
  analysis: string
  thinking: string
  logsAnalyzed: number
}

const DIMENSIONS: { key: DimensionKey; label: string }[] = [
  { key: 'scene_type', label: 'Scene Type' },
  { key: 'model_used', label: 'Model' },
  { key: 'thinking_mode', label: 'Thinking Mode' },
  { key: 'style_preset_id', label: 'Style Preset' },
  { key: 'agent_type', label: 'Agent Type' },
]

const SUGGESTED_QUESTIONS = [
  'Why do users regenerate canvas2d scenes more than SVG scenes?',
  'Which model produces the best results for the cost?',
  'Does adaptive thinking actually improve quality?',
  'What prompts lead to the most regenerations?',
  'Which style presets produce the best scenes?',
]

export default function PromptEngineeringDashboard() {
  const [activeDimension, setActiveDimension] = useState<DimensionKey>('scene_type')
  const [dimensionData, setDimensionData] = useState<DimensionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [question, setQuestion] = useState('')
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [showThinking, setShowThinking] = useState(false)

  const fetchDimension = useCallback(async (dim: DimensionKey) => {
    setLoading(true)
    try {
      const ipc = typeof window !== 'undefined' ? window.cenchApi?.generationLog : undefined
      const json = ipc
        ? await ipc.listByDimension({ dimension: dim })
        : await fetch(`/api/generation-log?dimension=${dim}`).then((r) => r.json())
      setDimensionData((json.data as DimensionRow[]) ?? [])
    } catch (e) {
      console.error('Failed to fetch dimension data:', e)
      setDimensionData([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchDimension(activeDimension)
  }, [activeDimension, fetchDimension])

  async function handleAnalyze(q: string) {
    setAnalyzing(true)
    setAnalysisResult(null)
    try {
      const res = await fetch('/api/analyze-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, limit: 50 }),
      })
      const json = await res.json()
      setAnalysisResult(json)
    } catch (e) {
      console.error('Analysis failed:', e)
      setAnalysisResult({
        analysis: 'Analysis failed. Check console for details.',
        thinking: '',
        logsAnalyzed: 0,
      })
    }
    setAnalyzing(false)
  }

  const maxQuality = Math.max(...dimensionData.map((d) => d.avg_quality), 0.01)

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0d0d0f',
        color: '#f0ece0',
        fontFamily: 'DM Mono, monospace',
        padding: 32,
      }}
    >
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Prompt Engineering Dashboard</h1>
      <p style={{ fontSize: 12, color: '#6b6b7a', marginBottom: 24 }}>
        Generation quality metrics and AI-powered analysis
      </p>

      {/* Dimension selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {DIMENSIONS.map((d) => (
          <button
            key={d.key}
            onClick={() => setActiveDimension(d.key)}
            style={{
              padding: '6px 14px',
              borderRadius: 4,
              border: 'none',
              fontSize: 11,
              fontFamily: 'DM Mono, monospace',
              cursor: 'pointer',
              background: activeDimension === d.key ? '#e84545' : '#1a1a1f',
              color: activeDimension === d.key ? 'white' : '#6b6b7a',
              transition: 'all 0.15s',
            }}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Quality table */}
      <div
        style={{
          background: '#111114',
          borderRadius: 8,
          border: '1px solid #2a2a32',
          overflow: 'hidden',
          marginBottom: 32,
        }}
      >
        {loading ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#6b6b7a', fontSize: 12 }}>Loading...</div>
        ) : dimensionData.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#6b6b7a', fontSize: 12 }}>
            No generation logs with quality scores yet. Generate some scenes and interact with them to start collecting
            data.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2a2a32' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', color: '#6b6b7a', fontWeight: 500 }}>
                  {DIMENSIONS.find((d) => d.key === activeDimension)?.label}
                </th>
                <th style={{ padding: '10px 14px', textAlign: 'left', color: '#6b6b7a', fontWeight: 500 }}>Quality</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', color: '#6b6b7a', fontWeight: 500 }}>Total</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', color: '#6b6b7a', fontWeight: 500 }}>Kept</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', color: '#6b6b7a', fontWeight: 500 }}>Edited</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', color: '#6b6b7a', fontWeight: 500 }}>Regen</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', color: '#6b6b7a', fontWeight: 500 }}>
                  Avg Cost
                </th>
              </tr>
            </thead>
            <tbody>
              {dimensionData.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #1a1a1f' }}>
                  <td style={{ padding: '8px 14px', color: '#f0ece0' }}>{row.dimension_value ?? '(none)'}</td>
                  <td style={{ padding: '8px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div
                        style={{
                          width: 80,
                          height: 6,
                          background: '#1a1a1f',
                          borderRadius: 3,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${(Number(row.avg_quality) / maxQuality) * 100}%`,
                            height: '100%',
                            background:
                              Number(row.avg_quality) > 0.7
                                ? '#22c55e'
                                : Number(row.avg_quality) > 0.4
                                  ? '#f59e0b'
                                  : '#ef4444',
                            borderRadius: 3,
                          }}
                        />
                      </div>
                      <span style={{ color: '#9a9aa8', minWidth: 32 }}>{Number(row.avg_quality).toFixed(2)}</span>
                    </div>
                  </td>
                  <td style={{ padding: '8px 14px', textAlign: 'right', color: '#9a9aa8' }}>{row.total_count}</td>
                  <td style={{ padding: '8px 14px', textAlign: 'right', color: '#22c55e' }}>{row.kept_count}</td>
                  <td style={{ padding: '8px 14px', textAlign: 'right', color: '#f59e0b' }}>{row.edited_count}</td>
                  <td style={{ padding: '8px 14px', textAlign: 'right', color: '#ef4444' }}>{row.regen_count}</td>
                  <td style={{ padding: '8px 14px', textAlign: 'right', color: '#9a9aa8' }}>
                    ${Number(row.avg_cost).toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* AI Analysis */}
      <div
        style={{
          background: '#111114',
          borderRadius: 8,
          border: '1px solid #2a2a32',
          padding: 20,
        }}
      >
        <h2 style={{ fontSize: 14, marginBottom: 12 }}>Ask Claude about your generation data</h2>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && question.trim() && !analyzing) {
                handleAnalyze(question.trim())
              }
            }}
            placeholder="Why do users regenerate canvas2d scenes more than SVG?"
            style={{
              flex: 1,
              padding: '8px 12px',
              background: '#0d0d0f',
              border: '1px solid #2a2a32',
              borderRadius: 4,
              color: '#f0ece0',
              fontSize: 12,
              fontFamily: 'DM Mono, monospace',
              outline: 'none',
            }}
          />
          <button
            onClick={() => question.trim() && handleAnalyze(question.trim())}
            disabled={analyzing || !question.trim()}
            style={{
              padding: '8px 16px',
              background: analyzing ? '#2a2a32' : '#e84545',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              fontSize: 12,
              fontFamily: 'DM Mono, monospace',
              cursor: analyzing ? 'wait' : 'pointer',
            }}
          >
            {analyzing ? 'Analyzing...' : 'Ask'}
          </button>
        </div>

        {/* Suggested questions */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {SUGGESTED_QUESTIONS.map((q, i) => (
            <button
              key={i}
              onClick={() => {
                setQuestion(q)
                handleAnalyze(q)
              }}
              disabled={analyzing}
              style={{
                padding: '4px 10px',
                background: '#1a1a1f',
                border: '1px solid #2a2a32',
                borderRadius: 4,
                color: '#6b6b7a',
                fontSize: 10,
                fontFamily: 'DM Mono, monospace',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {q}
            </button>
          ))}
        </div>

        {/* Analysis result */}
        {analysisResult && (
          <div>
            {analysisResult.thinking && (
              <div style={{ marginBottom: 12 }}>
                <button
                  onClick={() => setShowThinking((v) => !v)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#f59e0b',
                    fontSize: 11,
                    fontFamily: 'DM Mono, monospace',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  {showThinking ? '▼' : '▶'} Claude&apos;s reasoning ({analysisResult.logsAnalyzed} logs analyzed)
                </button>
                {showThinking && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: 12,
                      background: '#0d0d0f',
                      borderRadius: 4,
                      border: '1px solid #2a2a32',
                      color: '#9a9aa8',
                      fontSize: 11,
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                      maxHeight: 300,
                      overflowY: 'auto',
                    }}
                  >
                    {analysisResult.thinking}
                  </div>
                )}
              </div>
            )}

            <div
              style={{
                color: '#f0ece0',
                fontSize: 12,
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
              }}
            >
              {analysisResult.analysis}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
