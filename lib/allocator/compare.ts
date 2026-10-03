import type { AllocationMetrics, AllocationRule, OrderedAllocationRule } from "./types";

const metricForRule: Record<AllocationRule, keyof AllocationMetrics> = {
  min_transmitters: "transmitters",
  min_total_swaps: "totalSwaps",
  min_fast_swaps: "fastSwaps",
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

/**
 * MicPlot exposes its optimization rules in an explicit user-defined order.
 * We preserve that behavior by comparing candidate plots lexicographically:
 * the first enabled rule decides first, then the second rule breaks ties, etc.
 */
export function compareAllocationMetrics(
  a: AllocationMetrics,
  b: AllocationMetrics,
  rules: OrderedAllocationRule[],
): number {
  for (const orderedRule of rules) {
    if (!orderedRule.enabled) continue;

    const metric = metricForRule[orderedRule.rule];
    const aValue = Number(a[metric] ?? 0);
    const bValue = Number(b[metric] ?? 0);

    if (aValue < bValue) return -1;
    if (aValue > bValue) return 1;
  }

  return 0;
}
