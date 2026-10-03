import type {
  AllocationGroup,
  AllocationTimingContext,
  CastRequirement,
} from "./model";
import type { AllocationMetrics } from "./types";
import {
  freePagesBetween,
  intervalBetweenPages,
  minimumSwapPages,
} from "./swaps";

export interface SwapEvent {
  groupId: string;
  fromCastMemberId: string;
  toCastMemberId: string;
  fromFrame: number;
  toFrame: number;
  fromPage: number;
  toPage: number;
  availablePages: number;
  minimumPages: number;
  isInterval: boolean;
}

export interface ScoredMicplot {
  metrics: AllocationMetrics;
  swaps: SwapEvent[];
  invalidSwapCount: number;
  frameAssignments: Record<string, Array<string | null>>;
}

function countMismatch(values: Array<string | number | null | undefined>) {
  const normalized = values.filter((value) => value !== null && value !== undefined && value !== "");
  if (normalized.length < 2) return 0;

  const counts = new Map<string, number>();
  for (const value of normalized) {
    const key = String(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const best = Math.max(...counts.values());
  return normalized.length - best;
}

function chooseAssignments(
  group: AllocationGroup,
  byId: Map<string, CastRequirement>,
  frameCount: number,
) {
  const assignments: Array<string | null> = [];
  let unmikedNice = 0;

  for (let frame = 0; frame < frameCount; frame += 1) {
    const must = group.members.filter(
      (memberId) => byId.get(memberId)?.movementNeeds[frame] === "must",
    );

    if (must.length) {
      assignments.push(must[0]);
      for (const memberId of group.members) {
        if (byId.get(memberId)?.movementNeeds[frame] === "nice") {
          unmikedNice += 1;
        }
      }
      continue;
    }

    const nice = group.members.filter(
      (memberId) => byId.get(memberId)?.movementNeeds[frame] === "nice",
    );

    assignments.push(nice[0] ?? null);
    if (nice.length > 1) unmikedNice += nice.length - 1;
  }

  return { assignments, unmikedNice };
}

export function scoreMicplot(
  groups: AllocationGroup[],
  requirements: CastRequirement[],
  context: AllocationTimingContext,
): ScoredMicplot {
  const byId = new Map(requirements.map((requirement) => [requirement.castMemberId, requirement]));
  const frameCount = context.frames.length;
  const swaps: SwapEvent[] = [];
  const frameAssignments: Record<string, Array<string | null>> = {};
  let unmikedNicePages = 0;
  let invalidSwapCount = 0;

  const possessionRunsByActor = new Map<string, number>();
  const occupiedPagesByGroup: number[] = [];

  for (const group of groups) {
    const { assignments, unmikedNice } = chooseAssignments(group, byId, frameCount);
    frameAssignments[group.id] = assignments;
    unmikedNicePages += unmikedNice;

    const occupiedPages = new Set<number>();
    for (let frame = 0; frame < assignments.length; frame += 1) {
      if (assignments[frame]) {
        occupiedPages.add(context.frames[frame]?.pageOrdinal ?? frame);
      }
    }
    occupiedPagesByGroup.push(occupiedPages.size);

    let previousActor: string | null = null;
    let previousDemandFrame = -1;
    const seenPossession = new Set<string>();

    for (let frame = 0; frame < assignments.length; frame += 1) {
      const actor = assignments[frame];
      if (!actor) continue;

      if (actor === previousActor) {
        previousDemandFrame = frame;
        continue;
      }

      if (previousActor !== null && previousDemandFrame >= 0) {
        const from = byId.get(previousActor)!;
        const to = byId.get(actor)!;
        const availablePages = freePagesBetween(previousDemandFrame, frame, context);
        const minimumPages = minimumSwapPages(from, to, context.swapSettings);
        const fromPage = context.frames[previousDemandFrame]?.pageOrdinal ?? previousDemandFrame;
        const toPage = context.frames[frame]?.pageOrdinal ?? frame;

        if (availablePages < minimumPages) invalidSwapCount += 1;

        swaps.push({
          groupId: group.id,
          fromCastMemberId: previousActor,
          toCastMemberId: actor,
          fromFrame: previousDemandFrame,
          toFrame: frame,
          fromPage,
          toPage,
          availablePages,
          minimumPages,
          isInterval: intervalBetweenPages(fromPage, toPage, context),
        });
      }

      if (seenPossession.has(actor)) {
        possessionRunsByActor.set(actor, (possessionRunsByActor.get(actor) ?? 1) + 1);
      } else {
        seenPossession.add(actor);
        possessionRunsByActor.set(actor, possessionRunsByActor.get(actor) ?? 1);
      }

      previousActor = actor;
      previousDemandFrame = frame;
    }
  }

  const fastSwapProfile: number[] = [];
  for (const swap of swaps) {
    if (!Number.isFinite(swap.minimumPages)) continue;
    const offset = swap.availablePages - swap.minimumPages;
    if (offset < 0) continue;
    fastSwapProfile[offset] = (fastSwapProfile[offset] ?? 0) + 1;
  }

  const swapsByPage = new Map<number, number>();
  for (const swap of swaps) {
    swapsByPage.set(swap.toPage, (swapsByPage.get(swap.toPage) ?? 0) + 1);
  }

  let peakSimultaneousSwaps = 0;
  for (const count of swapsByPage.values()) {
    peakSimultaneousSwaps = Math.max(peakSimultaneousSwaps, count);
  }

  let refits = 0;
  for (const runs of possessionRunsByActor.values()) {
    refits += Math.max(0, runs - 1);
  }

  const profiles = groups.map((group) =>
    group.members.map((memberId) => byId.get(memberId)).filter(Boolean) as CastRequirement[],
  );

  return {
    swaps,
    invalidSwapCount,
    frameAssignments,
    metrics: {
      transmitters: groups.length,
      totalSwaps: swaps.length,
      fastSwaps: fastSwapProfile,
      nonIntervalSwaps: swaps.filter((swap) => !swap.isInterval).length,
      peakSimultaneousSwaps,
      refits,
      spareUnavailablePages: occupiedPagesByGroup.length
        ? Math.min(...occupiedPagesByGroup)
        : 0,
      micColourMismatches: profiles.reduce(
        (sum, group) => sum + countMismatch(group.map((member) => member.micColour)),
        0,
      ),
      micQualityMismatches: profiles.reduce(
        (sum, group) => sum + countMismatch(group.map((member) => member.micQuality)),
        0,
      ),
      projectionMismatches: profiles.reduce(
        (sum, group) => sum + countMismatch(group.map((member) => member.projection)),
        0,
      ),
      vocalRangeMismatches: profiles.reduce(
        (sum, group) => sum + countMismatch(group.map((member) => member.vocalRange)),
        0,
      ),
      beltSizeMismatches: profiles.reduce(
        (sum, group) => sum + countMismatch(group.map((member) => member.beltSize)),
        0,
      ),
      unmikedNicePages,
    },
  };
}

export function formatFastSwapProfile(profile: number[]) {
  if (!profile.length) return "0";
  const lastNonZero = profile.reduce(
    (last, value, index) => (value ? index : last),
    0,
  );
  return profile
    .slice(0, lastNonZero + 1)
    .map((value) => String(value ?? 0).padStart(2, "0"))
    .join(".");
}
