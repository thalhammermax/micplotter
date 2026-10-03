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
  fastSwaps: number;
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
