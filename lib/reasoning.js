/** Known effort strengths, independent of the adapter's display order. */
const STRENGTH = new Map([
  ['off', 0], ['none', 0],
  ['minimal', 1], ['low', 2], ['medium', 3], ['high', 4], ['xhigh', 5], ['max', 6],
])

/**
 * Retain an exact effort or select the nearest supported lower strength.
 * If every comparable effort is higher, use the lowest available strength.
 * Adapter-specific ids are only portable when the target advertises the same id.
 */
export function closestEffort(effort, reasoning) {
  if (effort === undefined || reasoning === undefined) return undefined
  const levels = reasoning.efforts
  if (levels.some(level => level.id === effort)) return effort
  const strength = STRENGTH.get(effort)
  if (strength === undefined) return undefined
  // Treat a purely Boolean capability as enabled for every nonzero preference.
  if (strength > 0 && levels.some(level => level.id === 'on')
    && levels.every(level => ['off', 'none', 'on'].includes(level.id))) return 'on'
  const ranked = levels
    .filter(level => STRENGTH.has(level.id))
    .toSorted((a, b) => STRENGTH.get(a.id) - STRENGTH.get(b.id))
  const lower = ranked.findLast(level => STRENGTH.get(level.id) <= strength)
  if (lower !== undefined) return lower.id
  // Boolean thinking capabilities have no graded strength, but can stay enabled.
  if (strength > 0 && levels.some(level => level.id === 'on')) return 'on'
  return ranked[0]?.id
}

/** Replace only the effort, preserving other request or selection fields. */
export function withEffort(selection, effort) {
  const { reasoningEffort: _previous, ...rest } = selection
  return { ...rest, ...effort === undefined ? {} : { reasoningEffort: effort } }
}

/** Whether two selections refer to the same exact provider/model route. */
export function sameModel(left, right) {
  return left?.provider === right?.provider && left?.model === right?.model
}

/** Preserve the effective effort when switching models in a loaded catalog. */
export function preserveModelEffort(previous, selection, groups) {
  if (previous == null || sameModel(previous, selection)) return selection
  const find = route => groups.find(group => group.id === route.provider)?.models.find(model => model.id === route.model)
  const effort = previous.reasoningEffort ?? find(previous)?.reasoning?.defaultEffort
  const target = find(selection)
  if (effort === undefined || target === undefined) return selection
  return withEffort(selection, closestEffort(effort, target.reasoning))
}
