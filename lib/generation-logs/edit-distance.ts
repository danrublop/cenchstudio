/**
 * Approximate edit distance for code changes.
 * Counts character differences at same positions plus length difference.
 * Not full Levenshtein — just a rough signal for quality scoring.
 */
export function approximateEditDistance(a: string, b: string): number {
  if (a === b) return 0
  const longer = a.length > b.length ? a : b
  const shorter = a.length > b.length ? b : a
  let diffs = Math.abs(a.length - b.length)
  for (let i = 0; i < shorter.length; i++) {
    if (longer[i] !== shorter[i]) diffs++
  }
  return diffs
}
