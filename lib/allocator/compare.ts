import type { AllocationMetrics, AllocationRule, OrderedAllocationRule } from "./types";

type ScalarMetric = Exclude<keyof AllocationMetrics, "fastSwaps">;

const metricForRule: Partial<Record<AllocationRule, ScalarMetric>> = {
  min_transmitters: "transmitters",
  min_total_swaps: "totalSwaps",
  min_non_interval_swaps: "nonIntervalSwaps",
  min_peak_simultaneous_swaps: "peakSimultaneousSwaps",
  min_refits: "refits",
  min_spare_unavailability: "spareUnavailablePages",
  min_mic_colour_mismatches: "micColourMismatches",
  min_mic_quality_mismatches: "micQualityMismatches",
  min_projection_mismatches: "projectionMismatches",
  min_vocal_range_mismatches: "vocalRangeMismatches",
  min_belt_size_mismatches: "beltSizeMismatches",
  min_unmiked_pages: "unmikedNicePages",
};

export function compareFastSwapProfiles(a: number[], b: number[]) {
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const aValue = a[index] ?? 0;
    const bValue = b[index] ?? 0;
    if (aValue < bValue) return -1;
    if (aValue > bValue) return 1;
  }
  return 0;
}

/**
 * MicPlot applies the enabled rules in the order selected by the user.
 * This is lexicographic comparison, not a weighted "score".
 */
export function compareAllocationMetrics(
  a: AllocationMetrics,
  b: AllocationMetrics,
  rules: OrderedAllocationRule[],
): number {
  for (const orderedRule of rules) {
    if (!orderedRule.enabled) continue;

    if (orderedRule.rule === "min_fast_swaps") {
      const comparison = compareFastSwapProfiles(a.fastSwaps, b.fastSwaps);
      if (comparison !== 0) return comparison;
      continue;
    }

    const metric = metricForRule[orderedRule.rule];
    if (!metric) continue;

    const aValue = Number(a[metric] ?? 0);
    const bValue = Number(b[metric] ?? 0);

    if (aValue < bValue) return -1;
    if (aValue > bValue) return 1;
  }

  return 0;
}
