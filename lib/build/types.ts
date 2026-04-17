// ── Build SSE Event Types ────────────────────────────────────────────────────

export type BuildSSEEventType =
  | 'build_start'
  | 'scene_start'
  | 'agent_step'
  | 'template_selected'
  | 'frame_start'
  | 'frame_done'
  | 'animation_start'
  | 'animation_done'
  | 'scene_done'
  | 'build_done'
  | 'build_error'

export type AgentStepName = 'Director' | 'Scene Maker' | 'DOP' | 'Editor'
export type AgentStepStatus = 'pending' | 'active' | 'done' | 'error'
export type SceneCardStatus = 'queued' | 'active' | 'done' | 'error'

// ── SSE Event Payloads ──────────────────────────────────────────────────────

export interface BuildStartEvent {
  type: 'build_start'
  totalScenes: number
  scenes: { sceneId: string; title: string }[]
}

export interface SceneStartEvent {
  type: 'scene_start'
  sceneId: string
}

export interface AgentStepEvent {
  type: 'agent_step'
  sceneId: string
  agentName: AgentStepName
  status: AgentStepStatus
  detail?: string
}

export interface TemplateSelectedEvent {
  type: 'template_selected'
  sceneId: string
  templateId: string
  templateUrl: string
}

export interface FrameStartEvent {
  type: 'frame_start'
  sceneId: string
  frameIndex: number
  prompt: string
}

export interface FrameDoneEvent {
  type: 'frame_done'
  sceneId: string
  frameIndex: number
  thumbnailUrl: string
  outputUrl: string
  durationMs: number
}

export interface AnimationStartEvent {
  type: 'animation_start'
  sceneId: string
}

export interface AnimationDoneEvent {
  type: 'animation_done'
  sceneId: string
}

export interface SceneDoneEvent {
  type: 'scene_done'
  sceneId: string
  durationMs: number
}

export interface BuildDoneEvent {
  type: 'build_done'
  totalDurationMs: number
}

export interface BuildErrorEvent {
  type: 'build_error'
  sceneId?: string
  error: string
}

export type BuildSSEEvent =
  | BuildStartEvent
  | SceneStartEvent
  | AgentStepEvent
  | TemplateSelectedEvent
  | FrameStartEvent
  | FrameDoneEvent
  | AnimationStartEvent
  | AnimationDoneEvent
  | SceneDoneEvent
  | BuildDoneEvent
  | BuildErrorEvent

// ── UI State ────────────────────────────────────────────────────────────────

export interface AgentStep {
  name: AgentStepName
  status: AgentStepStatus
  detail?: string
}

export interface FrameState {
  index: number
  status: 'pending' | 'active' | 'done'
  prompt?: string
  thumbnailUrl?: string
  outputUrl?: string
  durationMs?: number
}

export interface SceneCardState {
  sceneId: string
  title: string
  status: SceneCardStatus
  agentSteps: AgentStep[]
  frames: FrameState[]
  selectedTemplate?: { templateId: string; templateUrl: string }
  isAnimating: boolean
  isExpanded: boolean
  wasManuallyToggled: boolean
  startedAt?: number
  completedAt?: number
  durationMs?: number
}

export interface SelectedFrame {
  sceneId: string
  frameIndex: number
}

export interface BuildState {
  status: 'idle' | 'running' | 'done' | 'error'
  scenes: SceneCardState[]
  error?: string
  isReconnecting: boolean
  selectedFrame: SelectedFrame | null
}

// ── Reducer Actions ─────────────────────────────────────────────────────────

export type BuildAction =
  | { type: 'BUILD_START'; scenes: { sceneId: string; title: string }[] }
  | { type: 'SCENE_START'; sceneId: string }
  | { type: 'AGENT_STEP'; sceneId: string; agentName: AgentStepName; status: AgentStepStatus; detail?: string }
  | { type: 'TEMPLATE_SELECTED'; sceneId: string; templateId: string; templateUrl: string }
  | { type: 'FRAME_START'; sceneId: string; frameIndex: number; prompt: string }
  | {
      type: 'FRAME_DONE'
      sceneId: string
      frameIndex: number
      thumbnailUrl: string
      outputUrl: string
      durationMs: number
    }
  | { type: 'ANIMATION_START'; sceneId: string }
  | { type: 'ANIMATION_DONE'; sceneId: string }
  | { type: 'SCENE_DONE'; sceneId: string; durationMs: number }
  | { type: 'BUILD_DONE' }
  | { type: 'BUILD_ERROR'; sceneId?: string; error: string }
  | { type: 'TOGGLE_EXPAND'; sceneId: string }
  | { type: 'AUTO_COLLAPSE'; sceneId: string }
  | { type: 'SELECT_FRAME'; sceneId: string; frameIndex: number }
  | { type: 'DESELECT_FRAME' }
  | { type: 'SET_RECONNECTING'; isReconnecting: boolean }
  | { type: 'RESET' }
