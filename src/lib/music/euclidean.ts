/**
 * Bjorklund's algorithm: distribute k pulses as evenly as possible
 * across n steps. Returns a boolean[] of length n.
 * E(3,8) → [1,0,0,1,0,0,1,0]  (tresillo)
 * E(5,8) → [1,0,1,1,0,1,1,0]
 */
export function euclid(k: number, n: number, rotation = 0): boolean[] {
  n = Math.max(1, Math.floor(n));
  k = Math.max(0, Math.min(n, Math.floor(k)));
  if (k === 0) return new Array(n).fill(false);
  if (k === n) return new Array(n).fill(true);

  // Build [[1],[1],...,[0],[0],...] then fold tails into heads.
  let groups: boolean[][] = [];
  for (let i = 0; i < k; i++) groups.push([true]);
  for (let i = 0; i < n - k; i++) groups.push([false]);

  while (true) {
    // count "tails" — trailing groups that are smaller than the rest
    let firstLen = groups[0].length;
    let tailCount = 0;
    for (let i = groups.length - 1; i >= 0; i--) {
      if (groups[i].length !== firstLen) tailCount++;
      else break;
    }
    if (tailCount <= 1 || tailCount >= groups.length) break;
    const headCount = groups.length - tailCount;
    const merged: boolean[][] = [];
    const merges = Math.min(headCount, tailCount);
    for (let i = 0; i < merges; i++) {
      merged.push([...groups[i], ...groups[headCount + i]]);
    }
    // remaining heads (if any) keep their length
    for (let i = merges; i < headCount; i++) merged.push(groups[i]);
    // remaining tails (if any) survive untouched
    for (let i = merges; i < tailCount; i++) merged.push(groups[headCount + i]);
    groups = merged;
  }

  const flat = groups.flat();
  const r = ((rotation % n) + n) % n;
  return flat.slice(r).concat(flat.slice(0, r));
}