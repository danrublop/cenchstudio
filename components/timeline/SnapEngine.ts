import type { Track, Timeline } from '@/lib/types'

/**
 * Collects all snap-worthy time points from the timeline.
 */
export function collectSnapTargets(timeline: Timeline | null, playheadTime?: number, excludeClipId?: string): number[] {
  const targets: number[] = []
  if (playheadTime !== undefined) targets.push(playheadTime)

  if (timeline) {
    for (const track of timeline.tracks) {
      for (const clip of track.clips) {
        if (clip.id === excludeClipId) continue
        targets.push(clip.startTime)
        targets.push(clip.startTime + clip.duration)
      }
    }
  }

  // Deduplicate
  return [...new Set(targets)].sort((a, b) => a - b)
}

/**
 * Find the nearest snap target within threshold (in pixels).
 * Returns the snapped time or the original time if no snap is close enough.
 */
export function findSnap(time: number, pps: number, thresholdPx: number, snapTargets: number[]): number {
  const thresholdTime = thresholdPx / pps
  let best = time
  let bestDist = Infinity

  for (const target of snapTargets) {
    const dist = Math.abs(target - time)
    if (dist < thresholdTime && dist < bestDist) {
      bestDist = dist
      best = target
    }
  }

  return best
}

/**
 * Returns sorted clip bounds on a track, excluding a specific clip.
 * Used for collision/overlap detection.
 */
export function getTrackClipBounds(track: Track, excludeClipId?: string): { start: number; end: number; id: string }[] {
  return track.clips
    .filter((c) => c.id !== excludeClipId)
    .map((c) => ({ start: c.startTime, end: c.startTime + c.duration, id: c.id }))
    .sort((a, b) => a.start - b.start)
}

/**
 * Clamp a time range so it doesn't overlap with existing clips on a track.
 * Returns the clamped start time.
 */
export function clampToAvoidOverlap(
  newStart: number,
  duration: number,
  bounds: { start: number; end: number }[],
): number {
  const newEnd = newStart + duration
  for (const b of bounds) {
    // If we overlap, push to nearest gap
    if (newEnd > b.start && newStart < b.end) {
      // Try snapping to before this clip
      const snapBefore = b.start - duration
      // Try snapping to after this clip
      const snapAfter = b.end
      // Choose whichever is closer to original newStart
      if (Math.abs(snapBefore - newStart) <= Math.abs(snapAfter - newStart)) {
        return Math.max(0, snapBefore)
      }
      return snapAfter
    }
  }
  return Math.max(0, newStart)
}
