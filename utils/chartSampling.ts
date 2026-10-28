/** Keep endpoints and bucket extrema so a short spike survives chart rendering. */
export function chartIndices(values: number[], maxPoints = 70): number[] {
  const valid = values.map((_, index) => index).filter((index) => Number.isFinite(values[index]));
  if (valid.length <= maxPoints) return valid;
  const buckets = Math.max(1, Math.floor((maxPoints - 2) / 2));
  const size = Math.ceil((valid.length - 2) / buckets);
  const selected = new Set([valid[0], valid.at(-1)!]);
  for (let start = 1; start < valid.length - 1; start += size) {
    const group = valid.slice(start, Math.min(start + size, valid.length - 1));
    let min = group[0], max = group[0];
    for (const index of group) {
      if (values[index] < values[min]) min = index;
      if (values[index] > values[max]) max = index;
    }
    selected.add(min); selected.add(max);
  }
  return [...selected].sort((a, b) => a - b);
}
