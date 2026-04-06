import { v4 as uuidv4 } from 'uuid'
import type { PhysicsLayer } from '@/lib/types'
import type { AgentLogger } from '@/lib/agents/logger'
import type { WorldStateMutable } from '@/lib/agents/tool-executor'
import { clearStaleCodeFields } from '@/lib/agents/tool-executor'
import { compilePhysicsSceneFromLayers } from '@/lib/physics/compile'
import { ok, err, findScene, updateScene, type ToolResult } from './_shared'

// ── Tool Names ───────────────────────────────────────────────────────────────

export const PHYSICS_TOOL_NAMES = [
  'generate_physics_scene',
  'explain_physics_concept',
  'annotate_simulation',
  'set_simulation_params',
] as const

// ── Physics-Specific Helpers ─────────────────────────────────────────────────

function clampNum(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function toFiniteNumber(v: unknown, fallback: number): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function normalizeAngle(v: unknown, fallbackRad: number): number {
  const n = toFiniteNumber(v, fallbackRad)
  // If value looks like degrees, convert to radians.
  if (Math.abs(n) > Math.PI * 2) return (n * Math.PI) / 180
  return n
}

function sanitizePhysicsParams(simulation: string, raw: unknown): Record<string, any> {
  const p = raw && typeof raw === 'object' ? { ...(raw as Record<string, any>) } : {}

  switch (simulation) {
    case 'pendulum': {
      p.g = clampNum(toFiniteNumber(p.g, 9.81), 0.1, 30)
      p.length = clampNum(toFiniteNumber(p.length, 2), 0.1, 20)
      p.angle = clampNum(normalizeAngle(p.angle, Math.PI / 6), -Math.PI, Math.PI)
      p.damping = clampNum(toFiniteNumber(p.damping, 0.02), 0, 20)
      break
    }
    case 'double_pendulum': {
      p.g = clampNum(toFiniteNumber(p.g, 9.81), 0.1, 30)
      p.L1 = clampNum(toFiniteNumber(p.L1, 1.2), 0.1, 20)
      p.L2 = clampNum(toFiniteNumber(p.L2, 1.0), 0.1, 20)
      p.m1 = clampNum(toFiniteNumber(p.m1, 1.0), 0.05, 200)
      p.m2 = clampNum(toFiniteNumber(p.m2, 1.0), 0.05, 200)
      p.theta1 = clampNum(normalizeAngle(p.theta1, Math.PI / 2), -Math.PI, Math.PI)
      p.theta2 = clampNum(normalizeAngle(p.theta2, Math.PI / 2), -Math.PI, Math.PI)
      break
    }
    case 'projectile': {
      p.v0 = clampNum(toFiniteNumber(p.v0, 30), 0.1, 500)
      p.angle = clampNum(normalizeAngle(p.angle, Math.PI / 4), 0.01, Math.PI - 0.01)
      p.g = clampNum(toFiniteNumber(p.g, 9.81), 0.1, 30)
      p.drag = clampNum(toFiniteNumber(p.drag, 0), 0, 2)
      break
    }
    case 'orbital': {
      p.G = clampNum(toFiniteNumber(p.G, 1), 0.000001, 1000000)
      p.m1 = clampNum(toFiniteNumber(p.m1, 1000), 0.001, 1000000)
      p.m2 = clampNum(toFiniteNumber(p.m2, 1), 0.001, 1000000)
      p.eccentricity = clampNum(toFiniteNumber(p.eccentricity, 0.4), 0, 0.995)
      p.semiMajorAxis = clampNum(toFiniteNumber(p.semiMajorAxis, 220), 10, 3000)
      break
    }
    case 'wave_interference': {
      p.frequency = clampNum(toFiniteNumber(p.frequency, 1.2), 0.01, 100)
      p.wavelength = clampNum(toFiniteNumber(p.wavelength, 0.7), 0.01, 5000)
      p.source_separation = clampNum(toFiniteNumber(p.source_separation, 180), 1, 5000)
      p.phase_diff = clampNum(normalizeAngle(p.phase_diff, 0), -Math.PI * 4, Math.PI * 4)
      break
    }
    case 'double_slit': {
      p.wavelength = clampNum(toFiniteNumber(p.wavelength, 0.55), 0.0001, 1000)
      p.slit_separation = clampNum(toFiniteNumber(p.slit_separation, 120), 0.001, 10000)
      p.slit_width = clampNum(toFiniteNumber(p.slit_width, 20), 0.001, 10000)
      p.screen_distance = clampNum(toFiniteNumber(p.screen_distance, 500), 0.01, 100000)
      break
    }
    case 'electric_field': {
      const charges = Array.isArray(p.charges) ? p.charges : []
      p.charges = charges.slice(0, 24).map((c: any) => ({
        x: clampNum(toFiniteNumber(c?.x, 960), -2000, 4000),
        y: clampNum(toFiniteNumber(c?.y, 540), -2000, 4000),
        q: clampNum(toFiniteNumber(c?.q, 1), -10000, 10000),
      }))
      break
    }
    case 'harmonic_oscillator': {
      p.mass = clampNum(toFiniteNumber(p.mass, 1), 0.001, 10000)
      p.k = clampNum(toFiniteNumber(p.k, 10), 0.001, 100000)
      p.damping = clampNum(toFiniteNumber(p.damping, 0.1), 0, 10000)
      p.driving_frequency = clampNum(toFiniteNumber(p.driving_frequency, 0), 0, 10000)
      p.driving_amplitude = clampNum(toFiniteNumber(p.driving_amplitude, 0), 0, 100000)
      // Accept either simulation units (~0-5) or pixel-like values (~60-300)
      const x0Raw = toFiniteNumber(p.x0, 1)
      p.x0 = Math.abs(x0Raw) > 8 ? x0Raw / 60 : x0Raw
      const v0Raw = toFiniteNumber(p.v0, 0)
      p.v0 = Math.abs(v0Raw) > 8 ? v0Raw / 60 : v0Raw
      break
    }
  }

  return p
}

// ── Simulation Class Map ─────────────────────────────────────────────────────

const SIM_CLASS_MAP: Record<string, string> = {
  pendulum: 'PendulumSim',
  double_pendulum: 'DoublePendulumSim',
  projectile: 'ProjectileSim',
  orbital: 'OrbitalSim',
  wave_interference: 'WaveInterferenceSim',
  double_slit: 'DoubleSlitSim',
  electric_field: 'ElectricFieldSim',
  harmonic_oscillator: 'HarmonicOscillatorSim',
}

// ── Concept-to-Simulation Map ────────────────────────────────────────────────

const CONCEPT_SIM_MAP: Record<string, string[]> = {
  pendulum: ['pendulum'],
  'simple pendulum': ['pendulum'],
  'double pendulum': ['double_pendulum'],
  chaos: ['double_pendulum'],
  projectile: ['projectile'],
  'projectile motion': ['projectile'],
  orbit: ['orbital'],
  'orbital mechanics': ['orbital'],
  gravity: ['pendulum', 'orbital', 'projectile'],
  wave: ['wave_interference'],
  'wave interference': ['wave_interference'],
  interference: ['wave_interference'],
  'double slit': ['double_slit'],
  quantum: ['double_slit'],
  'electric field': ['electric_field'],
  electrostatics: ['electric_field'],
  'harmonic oscillator': ['harmonic_oscillator'],
  oscillation: ['harmonic_oscillator'],
  resonance: ['harmonic_oscillator'],
  spring: ['harmonic_oscillator'],
  shm: ['harmonic_oscillator'],
}

// ── Audience Guidance Map ────────────────────────────────────────────────────

const AUDIENCE_GUIDE: Record<string, string> = {
  middle_school: 'Use words and simple ratios, no calculus. Focus on what happens, not why mathematically.',
  high_school: 'Basic algebra, F=ma style. Show equations but focus on intuition first.',
  undergraduate: 'ODEs, vector notation. Can show derivations. Lagrangian if relevant.',
  graduate: 'Full tensor/variational formulation. Assume mathematical maturity.',
  general_public: 'Visual-first, equations as punctuation not substance. Analogies over math.',
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function createPhysicsToolHandler(deps: {
  regenerateHTML: (world: WorldStateMutable, sceneId: string, logger?: AgentLogger) => Promise<{ htmlWritten: boolean }>
}) {
  return async function handlePhysicsTools(
    toolName: string,
    args: Record<string, unknown>,
    world: WorldStateMutable,
    logger?: AgentLogger,
  ): Promise<ToolResult> {
    switch (toolName) {
      // ── generate_physics_scene ──────────────────────────────────────────

      case 'generate_physics_scene': {
        const { sceneId, simulation, params, layout, equations, narration_text, highlight_moment, title } = args as {
          sceneId: string
          simulation: string
          params?: Record<string, any>
          layout: string
          equations?: string[]
          narration_text?: string
          highlight_moment?: { time: number; label: string; annotation?: string }
          title?: string
        }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)

        const simClass = SIM_CLASS_MAP[simulation]
        if (!simClass) return err(`Unknown simulation: ${simulation}`)

        const safeParams = sanitizePhysicsParams(simulation, params)
        const physicsLayer: PhysicsLayer = {
          id: uuidv4(),
          name: title || `${simulation} simulation`,
          simulation: simulation as PhysicsLayer['simulation'],
          layout: layout as PhysicsLayer['layout'],
          params: safeParams,
          equations: equations || [],
          title: title || '',
          narration: narration_text || '',
        }
        const compiled = compilePhysicsSceneFromLayers(sceneId, physicsLayer)

        const safeHighlightLabel = highlight_moment
          ? (highlight_moment.label || '').replace(/'/g, "\\'").replace(/</g, '&lt;')
          : ''
        const safeHighlightAnn = highlight_moment?.annotation
          ? highlight_moment.annotation.replace(/'/g, "\\'").replace(/</g, '&lt;')
          : ''
        const sceneCode =
          compiled.sceneCode +
          (highlight_moment
            ? `
// Highlight moment
(function() {
  if (!window.__tl) return;
  window.__tl.call(function() {
    var ann = document.createElement('div');
    ann.className = 'physics-annotation callout';
    ann.style.left = '50%'; ann.style.top = '80px';
    ann.style.transform = 'translateX(-50%)';
    ann.textContent = '${safeHighlightLabel}${safeHighlightAnn ? ' - ' + safeHighlightAnn : ''}';
    document.body.appendChild(ann);
    gsap.from(ann, { opacity: 0, y: -20, duration: 0.5 });
    gsap.to(ann, { opacity: 0, delay: 3, duration: 0.5, onComplete: function() { ann.remove(); } });
  }, null, ${highlight_moment.time});
})();`
            : '')

        const updated = updateScene(world, sceneId, {
          sceneType: 'physics',
          sceneHTML: compiled.sceneHTML,
          sceneCode: sceneCode,
          sceneStyles: '',
          physicsLayers: [physicsLayer],
          ...clearStaleCodeFields('physics'),
        })
        if (!updated) return err(`Failed to update scene ${sceneId}`)

        await deps.regenerateHTML(world, sceneId, logger)

        return ok(sceneId, `Generated physics scene with ${simulation} simulation (${layout} layout)`, {
          simulation,
          layout,
          params: safeParams,
        })
      }

      // ── explain_physics_concept ─────────────────────────────────────────

      case 'explain_physics_concept': {
        const { concept, audience, duration_minutes, emphasis } = args as {
          concept: string
          audience: string
          duration_minutes?: number
          emphasis?: string
        }
        const dur = duration_minutes || 3
        const numScenes = Math.max(3, Math.min(12, Math.round(dur * 3)))

        const conceptLower = concept.toLowerCase()
        let matchedSims: string[] = []
        for (const [key, sims] of Object.entries(CONCEPT_SIM_MAP)) {
          if (conceptLower.includes(key)) matchedSims.push(...sims)
        }
        matchedSims = [...new Set(matchedSims)]
        if (matchedSims.length === 0) matchedSims = ['pendulum']

        return ok(null, `Planned ${numScenes}-scene physics explainer for "${concept}"`, {
          concept,
          audience,
          emphasis: emphasis || 'intuition',
          targetDurationSeconds: dur * 60,
          suggestedSceneCount: numScenes,
          relevantSimulations: matchedSims,
          audienceGuidance: AUDIENCE_GUIDE[audience] || AUDIENCE_GUIDE.general_public,
          suggestedArc: [
            { phase: 'hook', description: `Striking visual of ${concept}`, layout: 'fullscreen' },
            { phase: 'question', description: 'What are we trying to understand?', layout: 'split' },
            { phase: 'intuition', description: 'Simplified case, no math yet', layout: 'fullscreen' },
            { phase: 'first_equation', description: 'Key relationship emerges', layout: 'split' },
            { phase: 'exploration', description: 'Change parameters, observe effects', layout: 'split' },
            { phase: 'full_equation', description: 'Complete governing equation', layout: 'equation_focus' },
            { phase: 'edge_cases', description: 'What happens at extremes?', layout: 'fullscreen' },
            { phase: 'application', description: 'Real-world example', layout: 'split' },
            { phase: 'summary', description: 'All equations, sim running', layout: 'equation_focus' },
          ].slice(0, numScenes),
        })
      }

      // ── annotate_simulation ─────────────────────────────────────────────

      case 'annotate_simulation': {
        const { sceneId, annotations } = args as {
          sceneId: string
          annotations: Array<{
            sim_time: number
            type: string
            text?: string
            x?: number
            y?: number
            equation?: string
            duration?: number
          }>
        }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)
        if (!annotations || annotations.length === 0) return err('No annotations provided')

        const annotationCode = annotations
          .map((ann, i) => {
            const dur = ann.duration || 3
            const x = ann.x || 960
            const y = ann.y || 540
            const cssClass = ann.type || 'label'
            const safeText = (ann.text || '').replace(/'/g, "\\'").replace(/</g, '&lt;')

            // For equation_popup, use textContent then typeset
            const isEqPopup = ann.type === 'equation_popup' && ann.equation
            const contentLine = isEqPopup
              ? `ann${i}.textContent = '$$' + (PhysicsEquations['${ann.equation}'] ? PhysicsEquations['${ann.equation}'].latex : '') + '$$';
    if (window.MathJax && window.MathJax.typesetPromise) window.MathJax.typesetPromise([ann${i}]).catch(function(){});`
              : `ann${i}.textContent = '${safeText}';`

            return `
  window.__tl.call(function() {
    var ann${i} = document.createElement('div');
    ann${i}.className = 'physics-annotation ${cssClass}';
    ann${i}.style.left = '${x}px'; ann${i}.style.top = '${y}px';
    ${contentLine}
    document.body.appendChild(ann${i});
    gsap.from(ann${i}, { opacity: 0, scale: 0.8, duration: 0.4, ease: 'back.out(1.7)' });
    gsap.to(ann${i}, { opacity: 0, delay: ${dur}, duration: 0.4, onComplete: function() { ann${i}.remove(); } });
  }, null, ${ann.sim_time});`
          })
          .join('\n')

        const patchCode = `\n// Annotations\n(function() {\n  if (!window.__tl) return;\n${annotationCode}\n})();`
        updateScene(world, sceneId, { sceneCode: (scene.sceneCode || '') + patchCode })

        await deps.regenerateHTML(world, sceneId, logger)

        return ok(sceneId, `Added ${annotations.length} annotation(s) to physics scene`)
      }

      // ── set_simulation_params ───────────────────────────────────────────

      case 'set_simulation_params': {
        const { sceneId, changes } = args as {
          sceneId: string
          changes: Array<{
            at_time: number
            param: string
            from: number
            to: number
            transition_duration?: number
          }>
        }
        const scene = findScene(world, sceneId)
        if (!scene) return err(`Scene ${sceneId} not found`)
        if (!changes || changes.length === 0) return err('No parameter changes provided')

        const normalizedChanges = changes.map((ch) => {
          const param = String(ch.param || '')
          const at_time = clampNum(toFiniteNumber(ch.at_time, 0), 0, 600)
          const transition_duration = clampNum(toFiniteNumber(ch.transition_duration, 1), 0.01, 120)
          let from = toFiniteNumber(ch.from, 0)
          let to = toFiniteNumber(ch.to, 0)
          if (['angle', 'theta1', 'theta2', 'phase_diff'].includes(param)) {
            from = normalizeAngle(from, 0)
            to = normalizeAngle(to, 0)
          }
          if (['x0', 'v0'].includes(param)) {
            if (Math.abs(from) > 8) from = from / 60
            if (Math.abs(to) > 8) to = to / 60
          }
          return { param, at_time, transition_duration, from, to }
        })

        const changeCode = normalizedChanges
          .map((ch) => {
            return `  sim.scheduleParamChange('${ch.param}', ${ch.from}, ${ch.to}, ${ch.at_time}, ${ch.transition_duration});`
          })
          .join('\n')

        const labelCode = normalizedChanges
          .map((ch, i) => {
            const safeParam = ch.param.replace(/'/g, "\\'")
            return `
  window.__tl.call(function() {
    var lbl = document.createElement('div');
    lbl.className = 'physics-annotation label';
    lbl.style.left = '20px'; lbl.style.bottom = '${120 + i * 40}px';
    lbl.textContent = '${safeParam}: ${ch.from} \\u2192 ${ch.to}';
    document.body.appendChild(lbl);
    gsap.from(lbl, { opacity: 0, x: -20, duration: 0.3 });
    gsap.to(lbl, { opacity: 0, delay: ${ch.transition_duration + 1}, duration: 0.3, onComplete: function() { lbl.remove(); } });
  }, null, ${ch.at_time});`
          })
          .join('\n')

        const patchCode = `\n// Parameter changes\n(function() {\n  var sim = window.__physicsSim;\n  if (!sim) return;\n${changeCode}\n  sim.precompute(DURATION);\n  if (window.__tl) {\n${labelCode}\n  }\n})();`

        updateScene(world, sceneId, { sceneCode: (scene.sceneCode || '') + patchCode })

        await deps.regenerateHTML(world, sceneId, logger)

        return ok(sceneId, `Scheduled ${changes.length} parameter change(s)`)
      }

      default:
        return err(`Unknown physics tool: ${toolName}`)
    }
  }
}
