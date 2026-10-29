export type Change = { text: string; direction: 'up' | 'down' | 'flat' };

/**
 * How a figure moved from the past period to the current one, as a percentage or a count.
 * Null when there is nothing to take a percentage of.
 */
export function changeOf(current: number, past: number, as: 'percent' | 'count'): Change | null {
  const difference = current - past;
  const direction = difference > 0 ? 'up' : difference < 0 ? 'down' : 'flat';
  const sign = difference > 0 ? '+' : '−';
  if (difference === 0) {
    return { text: 'No change', direction };
  }
  if (as === 'count') {
    return { text: `${sign}${Math.abs(difference).toLocaleString('en')}`, direction };
  }
  if (past === 0) {
    return null;
  }
  const percent = Math.abs((difference / past) * 100);
  return {
    text: `${sign}${percent.toLocaleString('en', { maximumFractionDigits: 1 })}%`,
    direction,
  };
}
