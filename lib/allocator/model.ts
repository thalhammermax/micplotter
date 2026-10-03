export type EffectivePriority = "must" | "nice" | "dont";

export interface EquipmentProfile {
  micStyle?: "lapel" | "boom" | "handheld" | "other" | null;
  micColour?: string | null;
  micQuality?: number | null;
  beltSize?: string | null;
  projection?: string | null;
  vocalRange?: string | null;
}

export interface CastRequirement extends EquipmentProfile {
  castMemberId: string;
  name: string;
  /**
   * Each entry represents one ordered movement state in the production.
   * "must" conflicts are hard constraints; "nice" conflicts are soft constraints.
   */
  movementNeeds: EffectivePriority[];
}

export interface AllocationFrame {
  movementId: string;
  pageOrdinal: number;
}

export interface SwapTimingSettings {
  handheldSwapPages: number;
  bodypackMode: "one_mic_per_cast" | "one_mic_per_pack";
  bodypackSwapPages: number;
  lapelBoomCompatible: boolean;
  lapelMicSwapPages: number;
  boomMicSwapPages: number;
}

export interface AllocationTimingContext {
  frames: AllocationFrame[];
  intervalPageOrdinals: number[];
  swapSettings: SwapTimingSettings;
}

export interface AllocationGroup {
  id: string;
  members: string[];
}

export interface GroupingResult {
  groups: AllocationGroup[];
  transmitterCount: number;
  majorConflicts: number;
  minorConflicts: number;
}

export interface ConflictGraph {
  vertices: string[];
  hard: Map<string, Set<string>>;
  soft: Map<string, Set<string>>;
}
