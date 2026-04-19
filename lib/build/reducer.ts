import type { BuildState, BuildAction, SceneCardState, AgentStep, AgentStepName } from './types'

const DEFAULT_AGENT_STEPS: AgentStepName[] = ['Director', 'Scene Maker', 'DOP', 'Editor']

function makeDefaultSteps(): AgentStep[] {
  return DEFAULT_AGENT_STEPS.map((name) => ({ name, status: 'pending' as const }))
}

export const initialBuildState: BuildState = {
  status: 'idle',
  scenes: [],
  isReconnecting: false,
  selectedFrame: null,
}

function updateScene(
  scenes: SceneCardState[],
  sceneId: string,
  updater: (scene: SceneCardState) => SceneCardState,
): SceneCardState[] {
  return scenes.map((s) => (s.sceneId === sceneId ? updater(s) : s))
}

export function buildReducer(state: BuildState, action: BuildAction): BuildState {
  switch (action.type) {
    case 'BUILD_START':
      return {
        ...state,
        status: 'running',
        error: undefined,
        isReconnecting: false,
        scenes: action.scenes.map((s) => ({
          sceneId: s.sceneId,
          title: s.title,
          status: 'queued',
          agentSteps: makeDefaultSteps(),
          frames: [],
          isAnimating: false,
          isExpanded: false,
          wasManuallyToggled: false,
        })),
        selectedFrame: null,
      }

    case 'SCENE_START':
      return {
        ...state,
        scenes: updateScene(state.scenes, action.sceneId, (s) => ({
          ...s,
          status: 'active',
          isExpanded: true,
          startedAt: Date.now(),
        })),
      }

    case 'AGENT_STEP':
      return {
        ...state,
        scenes: updateScene(state.scenes, action.sceneId, (s) => ({
          ...s,
          agentSteps: s.agentSteps.map((step) =>
            step.name === action.agentName ? { ...step, status: action.status, detail: action.detail } : step,
          ),
        })),
      }

    case 'TEMPLATE_SELECTED':
      return {
        ...state,
        scenes: updateScene(state.scenes, action.sceneId, (s) => ({
          ...s,
          selectedTemplate: { templateId: action.templateId, templateUrl: action.templateUrl },
        })),
      }

    case 'FRAME_START':
      return {
        ...state,
        scenes: updateScene(state.scenes, action.sceneId, (s) => {
          const existing = s.frames.find((f) => f.index === action.frameIndex)
          if (existing) {
            return {
              ...s,
              frames: s.frames.map((f) =>
                f.index === action.frameIndex ? { ...f, status: 'active' as const, prompt: action.prompt } : f,
              ),
            }
          }
          return {
            ...s,
            frames: [
              ...s.frames,
              {
                index: action.frameIndex,
                status: 'active' as const,
                prompt: action.prompt,
              },
            ],
          }
        }),
      }

    case 'FRAME_DONE':
      return {
        ...state,
        scenes: updateScene(state.scenes, action.sceneId, (s) => ({
          ...s,
          frames: s.frames.map((f) =>
            f.index === action.frameIndex
              ? {
                  ...f,
                  status: 'done' as const,
                  thumbnailUrl: action.thumbnailUrl,
                  outputUrl: action.outputUrl,
                  durationMs: action.durationMs,
                }
              : f,
          ),
        })),
      }

    case 'ANIMATION_START':
      return {
        ...state,
        scenes: updateScene(state.scenes, action.sceneId, (s) => ({
          ...s,
          isAnimating: true,
        })),
      }

    case 'ANIMATION_DONE':
      return {
        ...state,
        scenes: updateScene(state.scenes, action.sceneId, (s) => ({
          ...s,
          isAnimating: false,
        })),
      }

    case 'SCENE_DONE':
      return {
        ...state,
        scenes: updateScene(state.scenes, action.sceneId, (s) => ({
          ...s,
          status: 'done',
          completedAt: Date.now(),
          durationMs: action.durationMs,
        })),
      }

    case 'BUILD_DONE':
      return { ...state, status: 'done' }

    case 'BUILD_ERROR':
      if (action.sceneId) {
        return {
          ...state,
          status: 'error',
          error: action.error,
          scenes: updateScene(state.scenes, action.sceneId, (s) => ({
            ...s,
            status: 'error',
          })),
        }
      }
      return { ...state, status: 'error', error: action.error }

    case 'TOGGLE_EXPAND':
      return {
        ...state,
        scenes: updateScene(state.scenes, action.sceneId, (s) => ({
          ...s,
          isExpanded: !s.isExpanded,
          wasManuallyToggled: true,
        })),
      }

    case 'AUTO_COLLAPSE':
      return {
        ...state,
        scenes: updateScene(state.scenes, action.sceneId, (s) =>
          s.wasManuallyToggled ? s : { ...s, isExpanded: false },
        ),
      }

    case 'SELECT_FRAME':
      return {
        ...state,
        selectedFrame: { sceneId: action.sceneId, frameIndex: action.frameIndex },
      }

    case 'DESELECT_FRAME':
      return { ...state, selectedFrame: null }

    case 'SET_RECONNECTING':
      return { ...state, isReconnecting: action.isReconnecting }

    case 'RESET':
      return initialBuildState

    default:
      return state
  }
}
