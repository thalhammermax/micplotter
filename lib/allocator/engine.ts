import { compareAllocationMetrics } from "./compare";
import { allocateTransmitterGroups } from "./grouping";
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

function activeRequirements(requirements: CastRequirement[]) {
  return requirements.filter((requirement) =>
    requirement.movementNeeds.some((need) => need !== "dont"),
  );
}

function zeroTransmitterCandidate(
  requirements: CastRequirement[],
  timing: AllocationTimingContext,
) {
  const groups: AllocationGroup[] = [];
  return {
    groups,
    scored: scoreMicplot(groups, requirements, timing),
    transmitterCount: 0,
  };
}

function candidateForCount(
  requirements: CastRequirement[],
  timing: AllocationTimingContext,
  count: number,
  deadlineMs: number,
): MicPlotAllocationResult | null {
  if (count === 0) {
    if (hasMustRequirement(requirements)) return null;
    return zeroTransmitterCandidate(requirements, timing);
  }

  try {
    const grouping = allocateTransmitterGroups(
      requirements,
      count,
      deadlineMs,
      timing,
    );
    const scored = scoreMicplot(grouping.groups, requirements, timing);

    if (scored.invalidSwapCount > 0) {
      return null;
    }

    return {
      groups: grouping.groups,
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
) {
  const active = activeRequirements(requirements);
  const start = hasMustRequirement(active) ? 1 : 0;

  for (let count = start; count <= active.length; count += 1) {
    const candidate = candidateForCount(active, timing, count, deadlineMs);
    if (candidate) return candidate;
  }

  return null;
}

export function allocateLikeMicPlot(
  requirements: CastRequirement[],
  timing: AllocationTimingContext,
  options: MicPlotAllocationOptions,
): MicPlotAllocationResult {
  const active = activeRequirements(requirements);
  const deadlineMs = Date.now() + effortBudgetMs(options.effort);
  const rules = enabledRules(options.rules, options.transmitterCountMode);

  if (options.transmitterCountMode === "manual") {
    const count = options.manualTransmitterCount;
    if (count === undefined || count < 0 || !Number.isInteger(count)) {
      throw new Error("Enter the number of transmitters to use.");
    }

    const candidate = candidateForCount(active, timing, count, deadlineMs);
    if (candidate) return candidate;

    const minimum = findMinimumFeasibleCount(active, timing, deadlineMs);
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

  // This is an explicit MicPlot behavior: if "Minimise number of
  // transmitters" is rule 1, Auto always uses the least feasible count.
  if (firstRule === "min_transmitters") {
    const minimum = findMinimumFeasibleCount(active, timing, deadlineMs);
    if (!minimum) {
      throw new Error("MicPlot could not find a valid transmitter allocation.");
    }
    return minimum;
  }

  // Otherwise Auto lets the ordered rules decide which transmitter count is
  // best. Evaluate feasible counts and compare the resulting micplots by the
  // same ordered rule list shown in MicPlot's Auto Group Allocation form.
  let best: MicPlotAllocationResult | null = null;
  const start = hasMustRequirement(active) ? 1 : 0;

  for (let count = start; count <= active.length; count += 1) {
    if (Date.now() > deadlineMs && best) break;

    const candidate = candidateForCount(active, timing, count, deadlineMs);
    if (!candidate) continue;

    if (
      !best ||
      compareAllocationMetrics(
        candidate.scored.metrics,
        best.scored.metrics,
        rules,
      ) < 0
    ) {
      best = candidate;
    }
  }

  if (!best) {
    throw new Error("MicPlot could not find a valid transmitter allocation.");
  }

  return best;
}
