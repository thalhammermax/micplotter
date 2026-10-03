import { compareAllocationMetrics } from "./compare";
import {
  allocateTransmitterGroups,
  type GroupingPreferences,
} from "./grouping";
import type {
  AllocationGroup,
  AllocationTimingContext,
  CastRequirement,
} from "./model";
import { scoreMicplot, type ScoredMicplot } from "./score";
import type {
  AllocationEffort,
  AllocationRule,
  AllocationType,
  OrderedAllocationRule,
  TransmitterCountMode,
} from "./types";

export interface MicPlotAllocationOptions {
  type: AllocationType;
  effort: AllocationEffort;
  transmitterCountMode: TransmitterCountMode;
  manualTransmitterCount?: number;
  rules: OrderedAllocationRule[];
  currentGroups?: AllocationGroup[];
}

export interface MicPlotAllocationResult {
  groups: AllocationGroup[];
  scored: ScoredMicplot;
  transmitterCount: number;
  suggestedMinimum?: number;
}

function effortBudgetMs(effort: AllocationEffort) {
  if (effort === "rough") return 750;
  if (effort === "thorough") return 12_000;
  return 4_000;
}

function hasMustRequirement(requirements: CastRequirement[]) {
  return requirements.some((requirement) =>
    requirement.movementNeeds.some((need) => need === "must"),
  );
}

function enabledRules(
  rules: OrderedAllocationRule[],
  transmitterCountMode: TransmitterCountMode,
) {
  if (transmitterCountMode === "auto") return rules;
  return rules.map((rule) =>
    rule.rule === "min_transmitters" ? { ...rule, enabled: false } : rule,
  );
}

function firstEnabledRule(rules: OrderedAllocationRule[]): AllocationRule | null {
  return rules.find((rule) => rule.enabled)?.rule ?? null;
}

function currentColorMap(groups: AllocationGroup[]) {
  const colors = new Map<string, number>();
  groups.forEach((group, color) => {
    group.members.forEach((memberId) => colors.set(memberId, color));
  });
  return colors;
}

function requirementsForAllocation(
  requirements: CastRequirement[],
  type: AllocationType,
  currentGroups: AllocationGroup[],
) {
  const currentlyGrouped = new Set(currentGroups.flatMap((group) => group.members));
  return requirements.filter(
    (requirement) =>
      requirement.movementNeeds.some((need) => need !== "dont") ||
      ((type === "finish" || type === "update") &&
        currentlyGrouped.has(requirement.castMemberId)),
  );
}

function renameAndOrderGroups(
  groups: AllocationGroup[],
  currentGroups: AllocationGroup[],
) {
  return groups.map((group, index) => {
    const existing = currentGroups[index];
    const existingOrder = new Map(
      (existing?.members ?? []).map((memberId, memberIndex) => [
        memberId,
        memberIndex,
      ]),
    );

    const members = [...group.members].sort((a, b) => {
      const aOrder = existingOrder.get(a);
      const bOrder = existingOrder.get(b);

      if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder;
      if (aOrder !== undefined) return -1;
      if (bOrder !== undefined) return 1;
      return 0;
    });

    return {
      id: existing?.id ?? group.id,
      members,
    };
  });
}

function changedAssignmentCount(
  groups: AllocationGroup[],
  currentGroups: AllocationGroup[],
) {
  const before = currentColorMap(currentGroups);
  const after = currentColorMap(groups);
  let changed = 0;

  for (const [memberId, oldColor] of before) {
    if (after.get(memberId) !== oldColor) changed += 1;
  }

  return changed;
}

function zeroTransmitterCandidate(
  requirements: CastRequirement[],
  timing: AllocationTimingContext,
): MicPlotAllocationResult {
  const groups: AllocationGroup[] = [];
  return {
    groups,
    scored: scoreMicplot(groups, requirements, timing),
    transmitterCount: 0,
  };
}

function preferencesForType(
  type: AllocationType,
  currentGroups: AllocationGroup[],
): GroupingPreferences {
  const current = currentColorMap(currentGroups);

  if (type === "finish") {
    return { fixedColors: current };
  }

  if (type === "update") {
    return { preferredColors: current };
  }

  return {};
}

function candidateForCount(
  requirements: CastRequirement[],
  timing: AllocationTimingContext,
  count: number,
  deadlineMs: number,
  type: AllocationType,
  currentGroups: AllocationGroup[],
): MicPlotAllocationResult | null {
  if (count === 0) {
    if (hasMustRequirement(requirements)) return null;
    if (type === "finish" && currentGroups.some((group) => group.members.length)) {
      return null;
    }
    return zeroTransmitterCandidate(requirements, timing);
  }

  if (type === "finish" && count < currentGroups.length) {
    return null;
  }

  try {
    const grouping = allocateTransmitterGroups(
      requirements,
      count,
      deadlineMs,
      timing,
      preferencesForType(type, currentGroups),
    );

    const groups = renameAndOrderGroups(grouping.groups, currentGroups);
    const scored = scoreMicplot(groups, requirements, timing);

    if (scored.invalidSwapCount > 0) {
      return null;
    }

    if (type === "update") {
      scored.metrics.changedAssignments = changedAssignmentCount(
        groups,
        currentGroups,
      );
    }

    return {
      groups,
      scored,
      transmitterCount: count,
    };
  } catch {
    return null;
  }
}

function findMinimumFeasibleCount(
  requirements: CastRequirement[],
  timing: AllocationTimingContext,
  deadlineMs: number,
  type: AllocationType,
  currentGroups: AllocationGroup[],
) {
  const minimumFromCurrent =
    type === "finish" ? currentGroups.length : 0;
  const start = Math.max(
    minimumFromCurrent,
    hasMustRequirement(requirements) ? 1 : 0,
  );

  for (let count = start; count <= requirements.length; count += 1) {
    const candidate = candidateForCount(
      requirements,
      timing,
      count,
      deadlineMs,
      type,
      currentGroups,
    );
    if (candidate) return candidate;
  }

  return null;
}

function compareCandidates(
  a: MicPlotAllocationResult,
  b: MicPlotAllocationResult,
  rules: OrderedAllocationRule[],
  type: AllocationType,
) {
  if (type === "update") {
    const aChanged = a.scored.metrics.changedAssignments ?? 0;
    const bChanged = b.scored.metrics.changedAssignments ?? 0;

    if (aChanged < bChanged) return -1;
    if (aChanged > bChanged) return 1;
  }

  return compareAllocationMetrics(a.scored.metrics, b.scored.metrics, rules);
}

export function allocateLikeMicPlot(
  requirements: CastRequirement[],
  timing: AllocationTimingContext,
  options: MicPlotAllocationOptions,
): MicPlotAllocationResult {
  const currentGroups = options.currentGroups ?? [];
  const active = requirementsForAllocation(
    requirements,
    options.type,
    currentGroups,
  );
  const deadlineMs = Date.now() + effortBudgetMs(options.effort);
  const rules = enabledRules(options.rules, options.transmitterCountMode);

  if (options.transmitterCountMode === "manual") {
    const count = options.manualTransmitterCount;
    if (count === undefined || count < 0 || !Number.isInteger(count)) {
      throw new Error("Enter the number of transmitters to use.");
    }

    const candidate = candidateForCount(
      active,
      timing,
      count,
      deadlineMs,
      options.type,
      currentGroups,
    );
    if (candidate) return candidate;

    const minimum = findMinimumFeasibleCount(
      active,
      timing,
      deadlineMs,
      options.type,
      currentGroups,
    );
    const suggestion = minimum?.transmitterCount;

    throw new Error(
      suggestion !== undefined
        ? "MicPlot cannot allocate this show using " +
            count +
            " transmitters. Try at least " +
            suggestion +
            "."
        : "MicPlot cannot find a valid allocation with the selected transmitter count.",
    );
  }

  const firstRule = firstEnabledRule(rules);

  if (firstRule === "min_transmitters") {
    const minimum = findMinimumFeasibleCount(
      active,
      timing,
      deadlineMs,
      options.type,
      currentGroups,
    );
    if (!minimum) {
      throw new Error("MicPlot could not find a valid transmitter allocation.");
    }
    return minimum;
  }

  let best: MicPlotAllocationResult | null = null;
  const start = Math.max(
    options.type === "finish" ? currentGroups.length : 0,
    hasMustRequirement(active) ? 1 : 0,
  );

  for (let count = start; count <= active.length; count += 1) {
    if (Date.now() > deadlineMs && best) break;

    const candidate = candidateForCount(
      active,
      timing,
      count,
      deadlineMs,
      options.type,
      currentGroups,
    );
    if (!candidate) continue;

    if (!best || compareCandidates(candidate, best, rules, options.type) < 0) {
      best = candidate;
    }
  }

  if (!best) {
    throw new Error("MicPlot could not find a valid transmitter allocation.");
  }

  return best;
}
