// ── Next.js runtime instrumentation ─────────────────────────────────────────
//
// Runs once when the Node.js runtime starts. Used today to spin up a
// background sweeper that purges stale budget-tracker reservations — reservations
// whose tool handlers crashed or timed out before reconciling. The tool
// executor already sweeps opportunistically on each call, but idle projects
// (no tool calls) would never be swept without this.
//
// Guarded to the 'nodejs' runtime — it must not run on the edge runtime
// (timers + dynamic imports of Node-only modules are unsupported there).

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { sweepStaleReservations } = await import('./lib/agents/budget-tracker')

  // Every 5 minutes, sweep reservations older than the default TTL (10 min).
  // Low cost: O(projects × in-flight reservations), typically a handful.
  const INTERVAL_MS = 5 * 60 * 1000
  const timer = setInterval(() => {
    try {
      const swept = sweepStaleReservations()
      if (swept > 0) {
        console.log(`[budget-tracker] swept ${swept} stale reservation(s)`)
      }
    } catch (err) {
      console.warn('[budget-tracker] sweep failed', err)
    }
  }, INTERVAL_MS)

  // Don't keep the process alive just for the sweep — allows clean shutdown.
  if (typeof timer.unref === 'function') timer.unref()
}
