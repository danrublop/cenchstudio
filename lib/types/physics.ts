export type PhysicsSimulationType =
  | 'pendulum'
  | 'double_pendulum'
  | 'projectile'
  | 'orbital'
  | 'wave_interference'
  | 'double_slit'
  | 'electric_field'
  | 'harmonic_oscillator'

export interface PhysicsLayer {
  id: string
  name: string
  simulation: PhysicsSimulationType
  layout: 'split' | 'fullscreen' | 'equation_focus'
  params: Record<string, unknown>
  equations: string[]
  title: string
  narration: string
}
