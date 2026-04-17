import type { AgentLogger } from '../logger'
import { ok, okGlobal, err, type ToolResult } from './_shared'

export const RECORDING_TOOL_NAMES = [
  'start_recording',
  'stop_recording',
  'pause_recording',
  'resume_recording',
  'cancel_recording',
  'get_recording_status',
  'list_recording_sources',
] as const

export function createRecordingToolHandler() {
  return async function handleRecordingTools(
    toolName: string,
    args: Record<string, unknown>,
    world: any,
    _logger?: AgentLogger,
  ): Promise<ToolResult> {
    switch (toolName) {
      case 'start_recording': {
        const { sourceId, sceneId, micEnabled, systemAudioEnabled, webcamEnabled, fps, resolution } = args as {
          sourceId?: string
          sceneId?: string
          micEnabled?: boolean
          systemAudioEnabled?: boolean
          webcamEnabled?: boolean
          fps?: number
          resolution?: string
        }

        if (world.recordingState && world.recordingState !== 'idle') {
          return err(
            `Recording already in progress (state: ${world.recordingState}). Use stop_recording or cancel_recording first.`,
          )
        }

        // Set config on world state — the client bridge will pick this up via SSE
        // sourceId is ignored — source selection uses native OS picker via getDisplayMedia()
        world.recordingConfig = {
          micEnabled: micEnabled ?? true,
          micDeviceId: null,
          systemAudioEnabled: systemAudioEnabled ?? true,
          webcamEnabled: webcamEnabled ?? false,
          webcamDeviceId: null,
          fps: fps ?? 30,
          resolution: resolution ?? '1080p',
        }
        world.recordingCommand = 'start'
        world.recordingCommandNonce = (world.recordingCommandNonce ?? 0) + 1
        world.recordingAttachSceneId = sceneId ?? null
        world.recordingError = null
        world.recordingResult = null

        const desc = sceneId
          ? `Recording started. Video will be attached to scene ${sceneId} when stopped.`
          : 'Recording started. Use stop_recording to finish and get the result.'
        return sceneId ? ok(sceneId, desc) : okGlobal(desc)
      }

      case 'stop_recording': {
        const { sceneId } = args as { sceneId?: string }

        if (!world.recordingState || world.recordingState === 'idle' || world.recordingState === 'saving') {
          return err(`No active recording to stop (state: ${world.recordingState ?? 'idle'}).`)
        }

        if (sceneId) {
          world.recordingAttachSceneId = sceneId
        }
        world.recordingCommand = 'stop'
        world.recordingCommandNonce = (world.recordingCommandNonce ?? 0) + 1

        const attachId = sceneId || world.recordingAttachSceneId
        const desc = attachId
          ? `Recording stop command issued. Video will be attached to scene ${attachId}. Use get_recording_status to check when saving completes.`
          : 'Recording stop command issued. Use get_recording_status to check when saving completes.'
        return attachId ? ok(attachId, desc) : okGlobal(desc)
      }

      case 'pause_recording': {
        if (world.recordingState !== 'recording') {
          return err(`Cannot pause: not recording (state: ${world.recordingState ?? 'idle'}).`)
        }
        world.recordingCommand = 'pause'
        world.recordingCommandNonce = (world.recordingCommandNonce ?? 0) + 1
        return okGlobal('Recording paused.')
      }

      case 'resume_recording': {
        if (world.recordingState !== 'paused') {
          return err(`Cannot resume: not paused (state: ${world.recordingState ?? 'idle'}).`)
        }
        world.recordingCommand = 'resume'
        world.recordingCommandNonce = (world.recordingCommandNonce ?? 0) + 1
        return okGlobal('Recording resumed.')
      }

      case 'cancel_recording': {
        if (!world.recordingState || world.recordingState === 'idle') {
          return okGlobal('No active recording to cancel.')
        }
        world.recordingCommand = 'cancel'
        world.recordingCommandNonce = (world.recordingCommandNonce ?? 0) + 1
        return okGlobal('Recording cancelled.')
      }

      case 'get_recording_status': {
        return okGlobal('Current recording status', {
          state: world.recordingState ?? 'idle',
          elapsed: world.recordingElapsed ?? 0,
          config: world.recordingConfig ?? null,
          error: world.recordingError ?? null,
          result: world.recordingResult ?? null,
          attachSceneId: world.recordingAttachSceneId ?? null,
        })
      }

      case 'list_recording_sources': {
        return okGlobal(
          'Source selection uses the native OS screen picker (getDisplayMedia). ' +
            'Call start_recording and the user will be prompted to select a screen or window.',
        )
      }

      default:
        return err(`Unknown recording tool: ${toolName}`)
    }
  }
}
