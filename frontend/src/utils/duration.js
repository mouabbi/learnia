/**
 * Minutes -> compact "hours min" label: 352 -> "5h 52min", 120 -> "2h",
 * 45 -> "45min". Returns '' for missing/invalid input so callers can hide it.
 */
export function formatMinutes(totalMinutes) {
  const total = Math.round(Number(totalMinutes))
  if (!Number.isFinite(total) || total <= 0) return ''
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  if (hours === 0) return `${minutes}min`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${String(minutes).padStart(2, '0')}min`
}
