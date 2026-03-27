// Cench Studio Player — entry point

import type { PlayerOptions, PublishedProject, PlayerEvent } from './types'
import { VariableStore } from './variables'
import { Renderer } from './renderer'
import { Runtime } from './runtime'
import { InteractionOverlay, injectPlayerStyles } from './interactions'
import { PlayerControls } from './ui/controls'

export type { PlayerOptions, PublishedProject, PlayerEvent }
export { VariableStore }

export class CenchStudioPlayer {
  private container: HTMLElement
  private options: PlayerOptions
  private variables: VariableStore
  private renderer!: Renderer
  private overlay!: InteractionOverlay
  private runtime!: Runtime
  private controls?: PlayerControls
  private wrapper!: HTMLElement

  constructor(container: HTMLElement, options: Partial<PlayerOptions> = {}) {
    this.container = container
    this.options = {
      theme: options.theme ?? 'dark',
      showProgressBar: options.showProgressBar ?? true,
      showSceneNav: options.showSceneNav ?? false,
      allowFullscreen: options.allowFullscreen ?? true,
      brandColor: options.brandColor ?? '#e84545',
      autoplay: options.autoplay ?? false,
    }
    this.variables = new VariableStore()
    injectPlayerStyles(this.options.brandColor)
    this.setupContainer()
  }

  private setupContainer(): void {
    this.wrapper = document.createElement('div')
    this.wrapper.style.cssText = `
      position: relative; width: 100%; height: 100%;
      background: ${this.options.theme === 'dark' ? '#000' : '#fff'};
      overflow: hidden;
    `
    this.container.appendChild(this.wrapper)
  }

  async load(projectUrl: string): Promise<void> {
    const res = await fetch(projectUrl)
    const project: PublishedProject = await res.json()
    this.loadData(project)
  }

  loadData(project: PublishedProject): void {
    this.renderer = new Renderer(this.wrapper, this.variables)
    this.overlay = new InteractionOverlay(
      this.wrapper,
      this.variables,
      this.options.brandColor,
      (type, elementId, payload) => {
        this.runtime.onInteractionFired(type, elementId, payload)
      }
    )

    if (this.options.showProgressBar) {
      this.controls = new PlayerControls(this.wrapper, {
        brandColor: this.options.brandColor,
        onPlay: () => this.play(),
        onPause: () => this.pause(),
        onSeek: (t) => { /* TODO: seek */ },
      })
    }

    const totalDuration = project.scenes.reduce((a, s) => a + s.duration, 0)

    this.runtime = new Runtime(
      project,
      this.variables,
      this.renderer,
      this.overlay,
      (current, sceneDuration) => {
        this.controls?.update(current, sceneDuration)
      },
      (playing) => {
        this.controls?.setPlaying(playing)
      }
    )

    if (this.options.autoplay) {
      this.runtime.start()
    }
  }

  play(): void {
    this.runtime?.play()
  }

  pause(): void {
    this.runtime?.pause()
  }

  goToScene(sceneId: string): void {
    this.runtime?.goToScene(sceneId)
  }

  setVariable(name: string, value: string): void {
    this.variables.set(name, value)
    this.runtime?.emit('variableSet', { name, value })
  }

  getVariable(name: string): string | undefined {
    return this.variables.get(name)
  }

  on(event: PlayerEvent, handler: Function): void {
    this.runtime?.on(event, handler)
  }

  destroy(): void {
    this.runtime?.destroy()
    this.renderer?.destroy()
    this.overlay?.destroy()
    this.controls?.destroy()
    this.variables.clear()
    this.wrapper.remove()
  }
}

// Auto-init from data attributes
if (typeof window !== 'undefined') {
  ;(window as any).CenchStudioPlayer = CenchStudioPlayer
}

export default CenchStudioPlayer
