export type AllocationRule =
  | "min_transmitters"
  | "min_total_swaps"
  | "min_fast_swaps"
  | "min_non_interval_swaps"
  | "min_peak_simultaneous_swaps"
  | "min_refits"
  | "min_spare_unavailability"
  | "min_mic_colour_mismatches"
  | "min_mic_quality_mismatches"
  | "min_projection_mismatches"
  | "min_vocal_range_mismatches"
  | "min_belt_size_mismatches"
  | "min_unmiked_pages";

export interface OrderedAllocationRule {
  rule: AllocationRule;
  enabled: boolean;
}

export interface AllocationMetrics {
  transmitters: number;
  totalSwaps: number;
  /**
   * MicPlot displays fast swaps as a profile such as 01.02.03:
   * swaps at the minimum time, minimum+1 page, minimum+2 pages, etc.
   */
  fastSwaps: number[];
  nonIntervalSwaps: number;
  peakSimultaneousSwaps: number;
  refits: number;
  spareUnavailablePages: number;
  micColourMismatches: number;
  micQualityMismatches: number;
  projectionMismatches: number;
  vocalRangeMismatches: number;
  beltSizeMismatches: number;
  unmikedNicePages: number;
  changedAssignments?: number;
}

export type AllocationType = "new" | "finish" | "update";
export type AllocationEffort = "rough" | "normal" | "thorough";
export type TransmitterCountMode = "auto" | "manual";

export interface AllocationRequest {
  productionId: string;
  type: AllocationType;
  effort: AllocationEffort;
  transmitterCountMode: TransmitterCountMode;
  manualTransmitterCount?: number;
  rules: OrderedAllocationRule[];
  currentMicplotId?: string;
}

export const DEFAULT_ALLOCATION_RULES: OrderedAllocationRule[] = [
  { rule: "min_transmitters", enabled: true },
  { rule: "min_fast_swaps", enabled: true },
  { rule: "min_non_interval_swaps", enabled: true },
  { rule: "min_total_swaps", enabled: true },
  { rule: "min_peak_simultaneous_swaps", enabled: true },
  { rule: "min_refits", enabled: true },
  { rule: "min_spare_unavailability", enabled: true },
  { rule: "min_mic_colour_mismatches", enabled: false },
  { rule: "min_mic_quality_mismatches", enabled: false },
  { rule: "min_projection_mismatches", enabled: false },
  { rule: "min_vocal_range_mismatches", enabled: false },
  { rule: "min_belt_size_mismatches", enabled: false },
];

export const ALLOCATION_RULE_LABELS: Record<AllocationRule, string> = {
  min_transmitters: "Minimise number of transmitters",
  min_total_swaps: "Minimise total number of swaps",
  min_fast_swaps: "Minimise number of fast swaps",
  min_non_interval_swaps: "Minimise number of non-interval swaps",
  min_peak_simultaneous_swaps: "Minimise peak simultaneous swaps",
  min_refits: "Minimise number of refits",
  min_spare_unavailability: "Minimise “spare” transmitter unavailability",
  min_mic_colour_mismatches: "Minimise mic colour mismatches",
  min_mic_quality_mismatches: "Minimise mic quality mismatches",
  min_projection_mismatches: "Minimise projection mismatches",
  min_vocal_range_mismatches: "Minimise vocal range mismatches",
  min_belt_size_mismatches: "Minimise belt size mismatches",
  min_unmiked_pages: "Minimise unmiked pages",
};
