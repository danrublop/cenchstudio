/**
 * ScenePlayer — controls a scene iframe via postMessage.
 *
 * Each scene iframe contains a GSAP master timeline controlled by
 * the playback controller. ScenePlayer sends commands (play, pause,
 * seek, reset) and receives state updates (ready, timeupdate, ended).
 */

export type ScenePlayerStatus = 'loading' | 'ready' | 'playing' | 'paused' | 'ended'

export class ScenePlayer {
  private iframe: HTMLIFrameElement
  private sceneId: string
  private boundHandler: (e: MessageEvent) => void

  public duration: number = 0
  public currentTime: number = 0
  public status: ScenePlayerStatus = 'loading'

  // Callbacks
  onReady?: (duration: number) => void
  onTimeUpdate?: (currentTime: number) => void
  onEnded?: () => void
  onPaused?: (currentTime: number) => void
  onSeeked?: (currentTime: number) => void
  /** In-scene interaction events (from CenchReact hooks) */
  onVariableChanged?: (name: string, value: unknown) => void
  onElementClicked?: (elementId: string, data?: Record<string, unknown>) => void
  onInteractionEvent?: (name: string, payload?: unknown) => void

  constructor(iframe: HTMLIFrameElement, sceneId: string) {
    this.iframe = iframe
    this.sceneId = sceneId
    this.boundHandler = this.handleMessage.bind(this)
    window.addEventListener('message', this.boundHandler)
  }

  private send(msg: Record<string, unknown>) {
    try {
      this.iframe.contentWindow?.postMessage({ target: 'cench-scene', sceneId: this.sceneId, ...msg }, '*')
    } catch {}
  }

  private handleMessage(event: MessageEvent) {
    const data = event.data
    if (!data || data.source !== 'cench-scene') return
    if (data.sceneId !== this.sceneId) return

    switch (data.type) {
      case 'ready':
        this.duration = data.duration ?? 0
        this.status = 'paused'
        this.onReady?.(this.duration)
        break

      case 'timeupdate':
        this.currentTime = data.currentTime ?? 0
        this.onTimeUpdate?.(this.currentTime)
        break

      case 'playing':
        this.status = 'playing'
        break

      case 'paused':
        this.status = 'paused'
        this.currentTime = data.currentTime ?? this.currentTime
        this.onPaused?.(this.currentTime)
        break

      case 'seeked':
        this.currentTime = data.currentTime ?? this.currentTime
        this.onSeeked?.(this.currentTime)
        break

      case 'ended':
        this.status = 'ended'
        this.onEnded?.()
        break

      case 'state':
        this.currentTime = data.currentTime ?? this.currentTime
        this.duration = data.duration ?? this.duration
        this.status = data.status ?? this.status
        break

      // In-scene interaction events (from CenchReact hooks)
      case 'variable_changed':
        this.onVariableChanged?.(data.name, data.value)
        break
      case 'element_clicked':
        this.onElementClicked?.(data.elementId, data.data)
        break
      case 'interaction_event':
        this.onInteractionEvent?.(data.name, data.payload)
        break
    }
  }

  play() {
    this.send({ type: 'play' })
  }

  pause() {
    this.send({ type: 'pause' })
  }

  seek(time: number) {
    this.send({ type: 'seek', time })
  }

  /** Enter scrub mode — mutes all audio/video for the duration of the drag. */
  startScrub() {
    this.send({ type: 'scrub_start' })
  }

  /** Exit scrub mode — restores per-element muted state captured at scrub_start. */
  endScrub() {
    this.send({ type: 'scrub_end' })
  }

  reset() {
    this.send({ type: 'reset' })
  }

  getState() {
    this.send({ type: 'get_state' })
  }

  /** Push a variable value into the scene iframe */
  setVariable(name: string, value: unknown) {
    this.send({ type: 'set_variable', name, value })
  }

  /** Fire a named trigger into the scene */
  fireTrigger(name: string, payload?: unknown) {
    this.send({ type: 'fire_trigger', name, payload })
  }

  destroy() {
    window.removeEventListener('message', this.boundHandler)
  }
}
