import type { SupabaseClient } from "@supabase/supabase-js";
import { deriveCastRequirements } from "./requirements";
import type { CastRequirement } from "./model";

export async function loadProductionRequirements(
  supabase: SupabaseClient,
  productionId: string,
): Promise<CastRequirement[]> {
  const [castResult, charactersResult, movementsResult, stageStatesResult] =
    await Promise.all([
      supabase
        .from("cast_members")
        .select(
          "id,name,when_miked,mic_style,mic_colour,mic_quality,belt_size,projection,vocal_range",
        )
        .eq("production_id", productionId)
        .order("sort_order"),
      supabase
        .from("characters")
        .select("id,played_by_cast_id,mic_priority")
        .eq("production_id", productionId),
      supabase
        .from("movements")
        .select("id")
        .eq("production_id", productionId)
        .order("sort_order"),
      supabase
        .from("movement_characters")
        .select("movement_id,character_id,priority_override")
        .eq("production_id", productionId),
    ]);

  const error =
    castResult.error ||
    charactersResult.error ||
    movementsResult.error ||
    stageStatesResult.error;
  if (error) throw new Error(error.message);

  return deriveCastRequirements({
    cast: (castResult.data ?? []).map((member) => ({
      id: member.id,
      name: member.name,
      whenMiked: member.when_miked,
      micStyle: member.mic_style,
      micColour: member.mic_colour,
      micQuality: member.mic_quality,
      beltSize: member.belt_size,
      projection: member.projection,
      vocalRange: member.vocal_range,
    })),
    characters: (charactersResult.data ?? []).map((character) => ({
      id: character.id,
      playedByCastId: character.played_by_cast_id,
      micPriority: character.mic_priority,
    })),
    movements: movementsResult.data ?? [],
    stageStates: (stageStatesResult.data ?? []).map((state) => ({
      movementId: state.movement_id,
      characterId: state.character_id,
      priorityOverride: state.priority_override,
    })),
  });
}
