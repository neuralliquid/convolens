export type GuidedMergeEdge = "prepend" | "append";

export interface GuidedWindowItem<T> {
  stableId?: string;
  alignmentToken: string;
  value: T;
}

export interface GuidedWindowMerge<T> {
  items: GuidedWindowItem<T>[];
  addedCount: number;
  overlapCount: number;
  ambiguous: boolean;
}

function sameTokenSequence<T>(
  left: GuidedWindowItem<T>[],
  right: GuidedWindowItem<T>[],
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (item, index) => item.alignmentToken === right[index].alignmentToken,
    )
  );
}

function matchingOverlapLengths<T>(
  left: GuidedWindowItem<T>[],
  right: GuidedWindowItem<T>[],
): number[] {
  const matches: number[] = [];
  const limit = Math.min(left.length, right.length);
  for (let length = 1; length <= limit; length += 1) {
    const leftStart = left.length - length;
    let matchesAtLength = true;
    for (let index = 0; index < length; index += 1) {
      if (
        left[leftStart + index].alignmentToken !== right[index].alignmentToken
      ) {
        matchesAtLength = false;
        break;
      }
    }
    if (matchesAtLength) matches.push(length);
  }
  return matches;
}

/**
 * Merge one ordered virtualized DOM window at either edge of the retained
 * sequence. Stable WhatsApp message IDs are authoritative when every retained
 * item has one. The fallback uses maximal suffix/prefix alignment and refuses
 * to silently collapse an ambiguous repeated-token overlap.
 */
export function mergeGuidedWindow<T>(
  existing: GuidedWindowItem<T>[],
  incoming: GuidedWindowItem<T>[],
  edge: GuidedMergeEdge = "prepend",
): GuidedWindowMerge<T> {
  if (incoming.length === 0) {
    return {
      items: existing,
      addedCount: 0,
      overlapCount: 0,
      ambiguous: false,
    };
  }
  if (existing.length === 0) {
    return {
      items: [...incoming],
      addedCount: incoming.length,
      overlapCount: 0,
      ambiguous: false,
    };
  }

  const allStable = [...existing, ...incoming].every((item) => item.stableId);
  if (allStable) {
    const retainedIds = new Set(existing.map((item) => item.stableId));
    const additions = incoming.filter(
      (item) => !retainedIds.has(item.stableId),
    );
    return {
      items:
        edge === "prepend"
          ? [...additions, ...existing]
          : [...existing, ...additions],
      addedCount: additions.length,
      overlapCount: incoming.length - additions.length,
      ambiguous: false,
    };
  }

  if (sameTokenSequence(existing, incoming)) {
    return {
      items: existing,
      addedCount: 0,
      overlapCount: incoming.length,
      ambiguous: false,
    };
  }

  const left = edge === "prepend" ? incoming : existing;
  const right = edge === "prepend" ? existing : incoming;
  const overlaps = matchingOverlapLengths(left, right);
  if (overlaps.length === 0) {
    return {
      items: [...left, ...right],
      addedCount: incoming.length,
      overlapCount: 0,
      ambiguous: false,
    };
  }

  const overlapCount = overlaps[overlaps.length - 1];
  if (overlaps.length > 1) {
    return {
      items: [...left, ...right],
      addedCount: incoming.length,
      overlapCount: 0,
      ambiguous: true,
    };
  }

  return {
    items: [...left, ...right.slice(overlapCount)],
    addedCount: incoming.length - overlapCount,
    overlapCount,
    ambiguous: false,
  };
}
