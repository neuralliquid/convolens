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
  limitReached?: boolean;
}

function sequenceOccurrenceCount<T>(
  haystack: GuidedWindowItem<T>[],
  needle: GuidedWindowItem<T>[],
): number {
  if (needle.length === 0 || needle.length > haystack.length) return 0;
  let count = 0;
  for (let start = 0; start <= haystack.length - needle.length; start += 1) {
    if (
      needle.every(
        (item, index) =>
          item.alignmentToken === haystack[start + index].alignmentToken,
      )
    ) {
      count += 1;
    }
  }
  return count;
}

function enforceGuidedLimit<T>(
  result: GuidedWindowMerge<T>,
  existing: GuidedWindowItem<T>[],
  edge: GuidedMergeEdge,
  maxItems: number | undefined,
): GuidedWindowMerge<T> {
  if (!maxItems || result.items.length <= maxItems) return result;
  if (result.ambiguous) {
    return {
      items: existing,
      addedCount: 0,
      overlapCount: 0,
      ambiguous: true,
      limitReached: true,
    };
  }
  const items =
    edge === "prepend"
      ? result.items.slice(result.items.length - maxItems)
      : result.items.slice(0, maxItems);
  return {
    ...result,
    items,
    addedCount: Math.max(0, items.length - existing.length),
    limitReached: true,
  };
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
  maxItems?: number,
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
    return enforceGuidedLimit(
      {
        items: [...incoming],
        addedCount: incoming.length,
        overlapCount: 0,
        ambiguous: false,
      },
      existing,
      edge,
      maxItems,
    );
  }

  const allStable = [...existing, ...incoming].every((item) => item.stableId);
  if (allStable) {
    const retainedIds = new Set(existing.map((item) => item.stableId));
    const additions = incoming.filter(
      (item) => !retainedIds.has(item.stableId),
    );
    return enforceGuidedLimit(
      {
        items:
          edge === "prepend"
            ? [...additions, ...existing]
            : [...existing, ...additions],
        addedCount: additions.length,
        overlapCount: incoming.length - additions.length,
        ambiguous: false,
      },
      existing,
      edge,
      maxItems,
    );
  }

  if (sameTokenSequence(existing, incoming)) {
    const left = edge === "prepend" ? incoming : existing;
    const right = edge === "prepend" ? existing : incoming;
    return enforceGuidedLimit(
      {
        items: [...left, ...right],
        addedCount: incoming.length,
        overlapCount: 0,
        ambiguous: true,
      },
      existing,
      edge,
      maxItems,
    );
  }

  const left = edge === "prepend" ? incoming : existing;
  const right = edge === "prepend" ? existing : incoming;
  const overlaps = matchingOverlapLengths(left, right);
  if (overlaps.length === 0) {
    return enforceGuidedLimit(
      {
        items: [...left, ...right],
        addedCount: incoming.length,
        overlapCount: 0,
        ambiguous: false,
      },
      existing,
      edge,
      maxItems,
    );
  }

  const overlapCount = overlaps[overlaps.length - 1];
  const overlapSequence = right.slice(0, overlapCount);
  const occurrenceAmbiguous =
    overlapCount < 2 ||
    sequenceOccurrenceCount(left, overlapSequence) > 1 ||
    sequenceOccurrenceCount(right, overlapSequence) > 1;
  if (overlaps.length > 1 || occurrenceAmbiguous) {
    return enforceGuidedLimit(
      {
        items: [...left, ...right],
        addedCount: incoming.length,
        overlapCount: 0,
        ambiguous: true,
      },
      existing,
      edge,
      maxItems,
    );
  }

  return enforceGuidedLimit(
    {
      items: [...left, ...right.slice(overlapCount)],
      addedCount: incoming.length - overlapCount,
      overlapCount,
      ambiguous: false,
    },
    existing,
    edge,
    maxItems,
  );
}
