/**
 * Claude Code as an agent backend provider.
 *
 * Spawns `claude` CLI as a subprocess with the Cench MCP server attached,
 * parses its stream-json output, and translates to SSE events for the client.
 *
 * This gives the in-app agent the same capabilities as Claude Code in a terminal —
 * full tool use, extended thinking, file editing — with the Cench Studio tools
 * available via MCP.
 */

import { spawn, type ChildProcess } from 'child_process'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import fs from 'fs/promises'
import { createLogger } from '../logger'

const log = createLogger('agent.claude-code')
import os from 'os'
import type { SSEEvent, UsageStats, ToolCallRecord, ToolResult } from './types'

interface ImageInput {
  dataUri: string
  mimeType: string
  fileName?: string
}

interface ClaudeCodeOptions {
  message: string
  images?: ImageInput[]
  systemPrompt: string
  projectId: string
  agentType?: string
  allowedTools?: string
  model?: string
  maxBudgetUsd?: number
  /** Claude Code's internal "effort" knob — low/medium/high/xhigh/max.
   *  Higher effort = more turns per invocation = more scenes built in one go.
   *  The user-observed "only 2 scenes built then stopped" is CC running out of
   *  effort budget on a complex task. Default to 'max' for Master-Builder parity. */
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max'
  history?: Array<{ role: string; content: string }>
  emit: (event: SSEEvent) => void
  abortSignal?: AbortSignal
  cwd?: string
}

interface ClaudeCodeResult {
  fullText: string
  toolCalls: ToolCallRecord[]
  usage: UsageStats
  durationMs: number
}

/** Check if Claude Code CLI is available */
export async function isClaudeCodeAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('claude', ['--version'], { stdio: 'pipe', timeout: 5000 })
    proc.on('close', (code) => resolve(code === 0))
    proc.on('error', () => resolve(false))
  })
}

/** Get Claude Code version string */
export async function getClaudeCodeVersion(): Promise<string | null> {
  return new Promise((resolve) => {
    const proc = spawn('claude', ['--version'], { stdio: 'pipe', timeout: 5000 })
    let output = ''
    proc.stdout?.on('data', (d: Buffer) => {
      output += d.toString()
    })
    proc.on('close', (code) => resolve(code === 0 ? output.trim() : null))
    proc.on('error', () => resolve(null))
  })
}

/**
 * Run a task via Claude Code CLI, streaming SSE events to the client.
 *
 * Spawns `claude -p "<prompt>" --output-format stream-json --verbose --bare`
 * with the Cench MCP server attached for tool access.
 */
export async function runWithClaudeCode(opts: ClaudeCodeOptions): Promise<ClaudeCodeResult> {
  const {
    message,
    systemPrompt,
    projectId,
    agentType = 'scene-maker',
    model = 'sonnet',
    // Bump default budget — $2 was exhausted by 2-scene builds on Sonnet with a
    // long system prompt. Master-Builder parity calls for bigger runway.
    maxBudgetUsd = 10.0,
    // Default to 'max' effort — CC's internal turn budget is what was limiting
    // runs to 2 scenes. Callers can downshift for single-scene edits.
    effort = 'max',
    emit,
    abortSignal,
    cwd = process.cwd(),
  } = opts

  const runId = uuidv4()
  const startTime = Date.now()
  const toolCalls: ToolCallRecord[] = []
  let fullText = ''
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let totalCostUsd = 0

  emit({ type: 'run_start', runId })
  emit({ type: 'agent_routed', agentType: agentType as any, routeMethod: 'override' })

  // Write MCP config and system prompt to temp files (avoids shell escaping issues)
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cench-cc-'))
  const mcpConfigPath = path.join(tmpDir, 'mcp.json')
  const systemPromptPath = path.join(tmpDir, 'system-prompt.txt')

  const mcpConfig = {
    mcpServers: {
      'cench-studio': {
        command: 'npx',
        args: ['tsx', path.join(cwd, 'scripts', 'mcp-server.ts')],
        env: {
          CENCH_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
          PROJECT_ID: projectId,
        },
      },
    },
  }

  await fs.writeFile(mcpConfigPath, JSON.stringify(mcpConfig, null, 2), 'utf-8')
  await fs.writeFile(systemPromptPath, systemPrompt, 'utf-8')

  // Write image attachments to temp files for --input-file
  const imageArgs: string[] = []
  if (opts.images?.length) {
    for (let i = 0; i < opts.images.length; i++) {
      const img = opts.images[i]
      const match = img.dataUri.match(/^data:([^;]+);base64,(.+)$/)
      if (!match) continue
      const ext = img.mimeType.split('/')[1] || 'png'
      const imgPath = path.join(tmpDir, `image-${i}.${ext}`)
      await fs.writeFile(imgPath, Buffer.from(match[2], 'base64'))
      imageArgs.push('--input-file', imgPath)
    }
  }

  // Cleanup temp files after process exits
  const cleanup = () => fs.rm(tmpDir, { recursive: true }).catch(() => {})

  // Build Claude Code CLI args
  // NOT using --bare (it disables OAuth, forcing API key auth which we don't have)
  // Instead: --allowedTools restricts to MCP-only (no Bash/curl to create projects)
  // --system-prompt-file overrides context with our rules
  // Prepend conversation history so the CLI has multi-turn context
  let promptText = message
  if (opts.history?.length) {
    const transcript = opts.history.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n')
    promptText = `<conversation_history>\n${transcript}\n</conversation_history>\n\nUser: ${message}`
  }

  // Let Claude Code use its NATIVE read/research tools in addition to MCP.
  //   Read, Glob, Grep — explore the repo (CLAUDE.md, skills, existing scene code)
  //   WebSearch, WebFetch — Anthropic's own server-side research (free under CC billing)
  // Mutations stay on MCP-only (scene creation, file writes happen through /api/scene
  // which keeps DB + public/scenes/*.html in sync). Without this, CC CLI has no way to
  // actually BE Claude Code in the app — it can't read CLAUDE.md, can't browse its own
  // skills, can't search the web. Just 125 MCP tools and a long system prompt, which is
  // exactly what made it stall on your myocarditis run.
  const defaultAllowedTools = [
    'mcp__cench-studio__*', // all Cench MCP tools
    'Read',
    'Glob',
    'Grep',
    'WebSearch',
    'WebFetch',
  ].join(',')

  const args = [
    '-p',
    promptText,
    ...imageArgs,
    '--output-format',
    'stream-json',
    '--verbose',
    '--model',
    model,
    // Effort level — controls how many internal turns CC invests. Without this
    // (or with 'low'/'medium') CC will cut runs short, which is how we got "2
    // scenes then stop" on a 5-scene video. 'max' gives CC enough rope to build
    // the whole thing in one subprocess, matching the in-app Master Builder loop.
    '--effort',
    effort,
    // Permission mode — in -p (print) mode CC already skips interactive prompts
    // for approved tools, but permission-gated tools (Bash, WebFetch with private
    // hosts, etc.) can still quietly fail. bypassPermissions lets CC run every
    // allowed tool without its own permission layer intervening. Our --allowedTools
    // already restricts the surface, and our MCP-level gates still enforce paid-API
    // checks. So this is safe in-scope.
    '--permission-mode',
    'bypassPermissions',
    '--max-budget-usd',
    String(maxBudgetUsd),
    '--system-prompt-file',
    systemPromptPath,
    '--mcp-config',
    mcpConfigPath,
    '--strict-mcp-config',
    '--allowedTools',
    opts.allowedTools ?? defaultAllowedTools,
    '--no-session-persistence',
  ]

  // Don't pass the app's ANTHROPIC_API_KEY to Claude Code —
  // let it use its own OAuth/keychain credentials
  const subprocessEnv = { ...process.env }
  delete subprocessEnv.ANTHROPIC_API_KEY

  return new Promise<ClaudeCodeResult>((resolve, reject) => {
    let proc: ChildProcess

    try {
      // Surface the allowedTools flag so it's obvious in the dev-server log
      // whether native tools (Read/Glob/Grep/WebSearch/WebFetch) are reaching CC.
      // Logging only the flag (not full args — those include the prompt text).
      const allowedToolsIdx = args.indexOf('--allowedTools')
      const allowedToolsValue = allowedToolsIdx >= 0 ? args[allowedToolsIdx + 1] : '(missing)'
      log.info('spawning claude CLI', {
        extra: {
          model,
          allowedTools: allowedToolsValue.slice(0, 300) + (allowedToolsValue.length > 300 ? '…' : ''),
        },
      })
      proc = spawn('claude', args, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: subprocessEnv,
      })
    } catch (err) {
      reject(new Error(`Failed to spawn Claude Code: ${(err as Error).message}`))
      return
    }

    // Handle abort signal
    if (abortSignal) {
      const onAbort = () => {
        proc.kill('SIGTERM')
        setTimeout(() => proc.kill('SIGKILL'), 3000)
      }
      abortSignal.addEventListener('abort', onAbort, { once: true })
      proc.on('close', () => abortSignal.removeEventListener('abort', onAbort))
    }

    let buffer = ''
    let iteration = 0
    let currentToolName: string | null = null
    let currentToolInput: Record<string, unknown> = {}
    let toolStartTime = 0

    // Phase tracking — infer from tool call sequence
    let currentPhase: 'plan' | 'style' | 'build' | 'polish' | 'unknown' = 'unknown'
    let scenesCreated = 0
    let scenesVerified = 0
    let errorCount = 0

    // Track cumulative state to emit only deltas
    // stream-json sends full message content with each event, not deltas
    let lastEmittedTextLength = 0
    let lastThinkingLength = 0
    let emittedThinkingStart = false
    const emittedToolUseIds = new Set<string>()
    let lastUsageInput = 0
    let lastUsageOutput = 0

    proc.stdout?.on('data', (chunk: Buffer) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? '' // keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue
        let event: any
        try {
          event = JSON.parse(line)
        } catch {
          continue // skip non-JSON lines
        }

        switch (event.type) {
          case 'system':
            // Init event — log but don't forward
            break

          case 'assistant': {
            const msg = event.message
            if (!msg?.content) break
            for (const block of msg.content) {
              if (block.type === 'thinking' && block.thinking) {
                // Only emit thinking start once, then emit delta
                if (!emittedThinkingStart) {
                  emittedThinkingStart = true
                  emit({ type: 'thinking_start' })
                }
                if (block.thinking.length > lastThinkingLength) {
                  const delta = block.thinking.slice(lastThinkingLength)
                  emit({ type: 'thinking_token', token: delta })
                  lastThinkingLength = block.thinking.length
                }
              } else if (block.type === 'text') {
                // Emit only new text since last event
                if (block.text.length > lastEmittedTextLength) {
                  // Close thinking if still open
                  if (emittedThinkingStart) {
                    emit({ type: 'thinking_complete', fullThinking: '' })
                    emittedThinkingStart = false
                  }
                  const newText = block.text.slice(lastEmittedTextLength)
                  fullText += newText
                  emit({ type: 'token', token: newText })
                  lastEmittedTextLength = block.text.length
                }
              } else if (block.type === 'tool_use' && block.id && !emittedToolUseIds.has(block.id)) {
                // Only emit each tool_use once (deduplicate by block ID)
                emittedToolUseIds.add(block.id)
                currentToolName = block.name
                currentToolInput = block.input ?? {}
                toolStartTime = Date.now()
                emit({ type: 'tool_start', toolName: block.name, toolInput: block.input })
              }
            }
            // Extract usage delta
            if (msg.usage) {
              const inputDelta = (msg.usage.input_tokens ?? 0) - lastUsageInput
              const outputDelta = (msg.usage.output_tokens ?? 0) - lastUsageOutput
              if (inputDelta > 0) totalInputTokens += inputDelta
              if (outputDelta > 0) totalOutputTokens += outputDelta
              lastUsageInput = msg.usage.input_tokens ?? 0
              lastUsageOutput = msg.usage.output_tokens ?? 0
            }
            break
          }

          case 'tool': {
            // Tool result — reset text/thinking trackers for the next assistant turn
            lastEmittedTextLength = 0
            lastThinkingLength = 0
            emittedThinkingStart = false

            // Tool result from Claude Code
            const toolResult: ToolResult = {
              success: !event.is_error,
              error: event.is_error ? (event.content ?? 'Tool failed') : undefined,
              changes: event.is_error
                ? undefined
                : [{ type: 'scene_updated', description: String(event.content ?? '').slice(0, 200) }],
            }
            const toolCall: ToolCallRecord = {
              id: uuidv4(),
              toolName: currentToolName ?? 'unknown',
              input: currentToolInput,
              output: toolResult,
              durationMs: Date.now() - toolStartTime,
            }
            toolCalls.push(toolCall)
            emit({
              type: 'tool_complete',
              toolName: currentToolName ?? 'unknown',
              toolInput: currentToolInput,
              toolResult,
            })

            // Emit state_change if this was a scene-modifying tool.
            // Include a lightweight incremental scene stub so the timeline updates progressively.
            const sceneTool =
              currentToolName &&
              /create_scene|add_layer|regenerate|delete_scene|patch_layer|write_scene_code/i.test(currentToolName)
            if (sceneTool && toolResult.success) {
              const input = currentToolInput as Record<string, any>
              // Derive build phase from the tool that just ran
              const isVerify = currentToolName === 'verify_scene' || currentToolName === 'verify_scene_pedagogy'
              const hasCode = /add_layer|write_scene_code|regenerate_layer|patch_layer/.test(currentToolName ?? '')
              const phase: 'verified' | 'rendered' | 'generating' = isVerify
                ? 'verified'
                : hasCode
                  ? 'rendered'
                  : 'generating'
              const isStillBuilding = phase !== 'verified'

              // Derive sceneId: either from the tool input (add_layer, etc.)
              // or from the MCP tool response for create_scene / write_scene_code.
              let derivedSceneId = input.sceneId
              if (!derivedSceneId && toolResult.success) {
                try {
                  const content = String(event.content ?? '')
                  // JSON format from create_scene: {"sceneId": "uuid"}
                  const jsonMatch = content.match(/"sceneId"\s*:\s*"([^"]+)"/)
                  if (jsonMatch) {
                    derivedSceneId = jsonMatch[1]
                  } else {
                    // Text format from write_scene_code: "Scene created: uuid — ..." or "Scene updated: uuid\n..."
                    const textMatch = content.match(/Scene (?:created|updated): ([a-f0-9-]{36}|[a-zA-Z0-9_-]+)/)
                    if (textMatch) derivedSceneId = textMatch[1]
                  }
                } catch {}
              }

              const sceneStub = derivedSceneId
                ? {
                    id: derivedSceneId,
                    name: input.name || input.sceneName || undefined,
                    prompt: input.prompt || undefined,
                    sceneType: input.sceneType || input.layerType || 'react',
                    duration: input.duration || 8,
                    bgColor: input.bgColor || '#0a0c10',
                    _building: isStillBuilding,
                    _buildPhase: phase,
                  }
                : undefined
              emit({
                type: 'state_change',
                changes: toolResult.changes,
                ...(sceneStub ? { incrementalScene: sceneStub } : {}),
              } as any)
            }

            // Emit storyboard_proposed when plan_scenes completes
            if (currentToolName === 'plan_scenes' && toolResult.success) {
              try {
                const content = String(event.content ?? '')
                // plan_scenes returns JSON — try to parse it for structured storyboard
                const jsonMatch = content.match(/\{[\s\S]*"scenes"[\s\S]*\}/)
                if (jsonMatch) {
                  const storyboard = JSON.parse(jsonMatch[0])
                  emit({ type: 'storyboard_proposed', storyboard })
                }
              } catch {
                // Non-fatal — storyboard display is optional
              }
            }

            // Track metrics for richer progress events
            if (toolResult.success) {
              if (currentToolName && /create_scene|write_scene_code/.test(currentToolName)) scenesCreated++
              if (currentToolName === 'verify_scene' || currentToolName === 'verify_scene_pedagogy') scenesVerified++
            } else {
              errorCount++
            }

            // Infer phase from tool name
            if (currentToolName === 'plan_scenes') currentPhase = 'plan'
            else if (currentToolName && /set_global_style|set_all_transitions|set_roughness/.test(currentToolName))
              currentPhase = 'style'
            else if (currentToolName && /create_scene|add_layer|write_scene_code|generate_chart/.test(currentToolName))
              currentPhase = 'build'
            else if (currentToolName && /verify_scene|patch_layer|set_transition|add_narration/.test(currentToolName))
              currentPhase = 'polish'

            iteration++
            emit({ type: 'iteration_start', iteration, maxIterations: 25 })

            // Emit run_progress so the UI shows live metrics
            const budgetPct = Math.round((iteration / 25) * 100)
            emit({
              type: 'run_progress',
              runProgress: {
                phase: currentPhase,
                toolCallsUsed: toolCalls.length,
                toolCallsMax: 25,
                costUsd: 0,
                costMax: 0,
                iteration,
                iterationMax: 25,
                scenesCreated,
                scenesVerified,
                errors: errorCount,
                budgetAlert: budgetPct >= 70 ? `${budgetPct}% of iteration budget used` : undefined,
              },
            })

            currentToolName = null
            currentToolInput = {}
            break
          }

          case 'result': {
            // Final result — extract cost and usage
            totalCostUsd = event.total_cost_usd ?? 0
            if (event.usage) {
              totalInputTokens = event.usage.input_tokens ?? totalInputTokens
              totalOutputTokens = event.usage.output_tokens ?? totalOutputTokens
            }
            break
          }

          case 'rate_limit_event':
            // Ignore rate limit info
            break

          default:
            // Unknown event type — ignore
            break
        }
      }
    })

    proc.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString().trim()
      if (text) {
        log.error('stderr from claude CLI', { extra: { text } })
      }
    })

    proc.on('close', async (code) => {
      const durationMs = Date.now() - startTime
      const usage: UsageStats = {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        apiCalls: iteration + 1,
        costUsd: totalCostUsd,
        totalDurationMs: durationMs,
        provider: 'claude-code',
      }

      // Fetch final scene state from DB and emit a state_change so the client
      // gets an authoritative sync (MCP tools persist each call to DB).
      if (scenesCreated > 0) {
        log.debug('fetching final state for created scenes', { extra: { scenesCreated } })
        try {
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
          const listRes = await fetch(`${baseUrl}/api/scene?projectId=${projectId}`)
          if (listRes.ok) {
            const listData = await listRes.json()
            const sceneIds: string[] = (listData.scenes ?? []).map((s: any) => s.id)
            log.debug('found scenes in project', { extra: { count: sceneIds.length } })
            if (sceneIds.length > 0) {
              // Fetch full scene data for each scene (includes code, HTML, audio)
              const fullScenes = await Promise.all(
                sceneIds.map(async (sid: string) => {
                  try {
                    const r = await fetch(`${baseUrl}/api/scene?projectId=${projectId}&sceneId=${sid}`)
                    if (r.ok) {
                      const d = await r.json()
                      return d.scene ?? null
                    }
                  } catch {}
                  return null
                }),
              )
              const validScenes = fullScenes.filter(Boolean)
              log.debug('emitting final state_change', { extra: { scenes: validScenes.length } })
              if (validScenes.length > 0) {
                emit({
                  type: 'state_change',
                  changes: [{ type: 'global_updated', description: '__final_state__' }],
                  updatedScenes: validScenes,
                  updatedGlobalStyle: null,
                } as any)
              }
            }
          } else {
            log.warn('scene list fetch failed', { extra: { status: listRes.status } })
          }
        } catch (e) {
          log.error('failed to fetch final state for sync', { error: e })
        }
      }

      // Detect the "text-only, no-tools" failure mode.
      // Haiku with a long system prompt will sometimes write the entire plan as prose
      // and never invoke a tool — exiting cleanly with 10k+ output tokens but zero
      // tool_use blocks. Without this check the UI shows the plan as a final message
      // and the timeline stays empty, which looks like a silent success.
      const wroteSubstantialText = fullText.trim().length > 400
      const noActionsTaken = toolCalls.length === 0 && scenesCreated === 0
      if (code === 0 && wroteSubstantialText && noActionsTaken) {
        const hint =
          model === 'haiku' || model.includes('haiku')
            ? ' This is a known Haiku failure mode on complex multi-scene tasks — switch to Sonnet in the model picker and retry.'
            : ' The model narrated a plan instead of invoking tools. Retry with a more direct prompt, or split into smaller requests.'
        emit({
          type: 'error',
          error:
            `Claude Code produced ${totalOutputTokens} output tokens but invoked zero tools — ` +
            `nothing was built on the timeline.${hint}`,
        })
        usage.apiCalls = 0 // mark this as a no-op run for usage tracking
      } else {
        emit({
          type: 'done',
          agentType: agentType as any,
          modelId: `claude-code:${model}` as any,
          fullText: fullText.trim(),
          toolCalls,
          usage,
        })
      }

      if (code !== 0 && code !== null) {
        const errorMsg = `Claude Code exited with code ${code}`
        if (!fullText && toolCalls.length === 0) {
          emit({ type: 'error', error: errorMsg })
        }
      }

      cleanup()
      resolve({ fullText: fullText.trim(), toolCalls, usage, durationMs })
    })

    proc.on('error', (err) => {
      cleanup()
      emit({ type: 'error', error: `Claude Code process error: ${err.message}` })
      reject(err)
    })
  })
}
