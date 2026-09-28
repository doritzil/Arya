export function pickedLabel(n: number) {
  if (n === 0) return 'Pick at least 3';
  if (n < 3) return `${n} picked — ${3 - n} more to go`;
  return `${n} picked — nice mix`;
}
