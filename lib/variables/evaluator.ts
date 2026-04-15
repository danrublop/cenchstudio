import type { VariableCondition, ConditionOperator } from '@/lib/types/interaction'

/**
 * Evaluate a variable condition against a set of variables.
 * Used by both the published viewer and the editor preview for scene graph navigation.
 */
export function evaluateCondition(
  variables: Record<string, unknown>,
  condition: VariableCondition
): boolean {
  const raw = variables[condition.variableName]
  const op = condition.operator
  const expected = condition.value

  // truthy/falsy don't need a comparison value
  if (op === 'truthy') return !!raw
  if (op === 'falsy') return !raw

  // equality works on any type via loose comparison
  if (op === 'eq') return raw == expected
  if (op === 'neq') return raw != expected

  // numeric comparisons — coerce both sides
  if (op === 'gt' || op === 'lt' || op === 'gte' || op === 'lte') {
    const a = Number(raw)
    const b = Number(expected)
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false
    switch (op) {
      case 'gt': return a > b
      case 'lt': return a < b
      case 'gte': return a >= b
      case 'lte': return a <= b
    }
  }

  // string contains
  if (op === 'contains') {
    return String(raw ?? '').includes(String(expected ?? ''))
  }

  return false
}

/**
 * Evaluate a legacy edge condition (simple variableName/variableValue equality)
 * or a rich VariableCondition if present.
 */
export function evaluateEdgeCondition(
  variables: Record<string, unknown>,
  edge: {
    variableName?: string | null
    variableValue?: string | null
    variableCondition?: VariableCondition | null
  }
): boolean {
  // Rich condition takes precedence
  if (edge.variableCondition) {
    return evaluateCondition(variables, edge.variableCondition)
  }
  // Legacy: simple equality
  if (edge.variableName) {
    return String(variables[edge.variableName] ?? '') === String(edge.variableValue ?? '')
  }
  return false
}
