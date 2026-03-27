// Variable store for interactive player

export class VariableStore {
  private vars: Map<string, string> = new Map()
  private listeners: Map<string, Set<(value: string) => void>> = new Map()

  set(name: string, value: string): void {
    this.vars.set(name, value)
    const handlers = this.listeners.get(name)
    if (handlers) {
      handlers.forEach((h) => h(value))
    }
  }

  get(name: string): string | undefined {
    return this.vars.get(name)
  }

  getAll(): Record<string, string> {
    return Object.fromEntries(this.vars)
  }

  /**
   * Replace {varName} tokens in HTML with current variable values.
   */
  interpolate(html: string): string {
    let result = html
    for (const [name, value] of this.vars) {
      result = result.replaceAll(`{${name}}`, value)
    }
    return result
  }

  onChange(name: string, handler: (value: string) => void): () => void {
    if (!this.listeners.has(name)) {
      this.listeners.set(name, new Set())
    }
    this.listeners.get(name)!.add(handler)
    return () => {
      this.listeners.get(name)?.delete(handler)
    }
  }

  clear(): void {
    this.vars.clear()
    this.listeners.clear()
  }
}
