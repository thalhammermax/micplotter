import type { CastRequirement, EffectivePriority, EquipmentProfile } from "./model";

export interface RequirementCastMember extends EquipmentProfile {
  id: string;
  name: string;
  whenMiked:
    | "normal"
    | "never"
    | "always"
    | "first_to_last"
    | "start_to_last"
    | "first_to_end";
}

export interface RequirementCharacter {
  id: string;
  playedByCastId: string | null;
  micPriority:
    | "must"
    | "nice"
    | "dont"
    | "variable_must"
    | "variable_nice"
    | "variable_dont";
}

export interface RequirementMovement {
  id: string;
}

export interface RequirementStageState {
  movementId: string;
  characterId: string;
  priorityOverride:
    | "must"
    | "nice"
    | "dont"
    | "variable_must"
    | "variable_nice"
    | "variable_dont"
    | null;
}

function basePriority(
  value:
    | "must"
    | "nice"
    | "dont"
    | "variable_must"
    | "variable_nice"
    | "variable_dont",
): EffectivePriority {
  if (value === "must" || value === "variable_must") return "must";
  if (value === "nice" || value === "variable_nice") return "nice";
  return "dont";
}

function stronger(
  a: EffectivePriority,
  b: EffectivePriority,
): EffectivePriority {
  if (a === "must" || b === "must") return "must";
  if (a === "nice" || b === "nice") return "nice";
  return "dont";
}

function applyWhenMiked(
  needs: EffectivePriority[],
  mode: RequirementCastMember["whenMiked"],
): EffectivePriority[] {
  if (!needs.length) return needs;
  if (mode === "never") return needs.map(() => "dont");
  if (mode === "always") return needs.map(() => "must");
  if (mode === "normal") return needs;

  const requiredFrames = needs
    .map((need, index) => (need === "dont" ? -1 : index))
    .filter((index) => index >= 0);

  if (!requiredFrames.length) return needs;

  const first = requiredFrames[0];
  const last = requiredFrames[requiredFrames.length - 1];
  let start = first;
  let end = last;

  if (mode === "start_to_last") start = 0;
  if (mode === "first_to_end") end = needs.length - 1;

  return needs.map((need, index) => {
    if (index >= start && index <= end) return "must";
    return need;
  });
}

export function deriveCastRequirements({
  cast,
  characters,
  movements,
  stageStates,
}: {
  cast: RequirementCastMember[];
  characters: RequirementCharacter[];
  movements: RequirementMovement[];
  stageStates: RequirementStageState[];
}): CastRequirement[] {
  const movementIndex = new Map(
    movements.map((movement, index) => [movement.id, index]),
  );
  const characterById = new Map(
    characters.map((character) => [character.id, character]),
  );
  const castById = new Map(cast.map((member) => [member.id, member]));

  const needsByCast = new Map<string, EffectivePriority[]>();
  for (const member of cast) {
    needsByCast.set(
      member.id,
      Array.from({ length: movements.length }, () => "dont" as EffectivePriority),
    );
  }

  for (const state of stageStates) {
    const frame = movementIndex.get(state.movementId);
    const character = characterById.get(state.characterId);
    if (frame === undefined || !character?.playedByCastId) continue;
    if (!castById.has(character.playedByCastId)) continue;

    const priority = basePriority(
      state.priorityOverride ?? character.micPriority,
    );
    const needs = needsByCast.get(character.playedByCastId)!;
    needs[frame] = stronger(needs[frame], priority);
  }

  return cast.map((member) => ({
    castMemberId: member.id,
    name: member.name,
    micStyle: member.micStyle,
    micColour: member.micColour,
    micQuality: member.micQuality,
    beltSize: member.beltSize,
    projection: member.projection,
    vocalRange: member.vocalRange,
    movementNeeds: applyWhenMiked(
      needsByCast.get(member.id)!,
      member.whenMiked,
    ),
  }));
}
