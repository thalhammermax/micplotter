import type { SupabaseClient } from "@supabase/supabase-js";
import { deriveCastRequirements } from "./requirements";
import type {
  AllocationTimingContext,
  CastRequirement,
  SwapTimingSettings,
} from "./model";

export interface ProductionAllocationInput {
  requirements: CastRequirement[];
  timing: AllocationTimingContext;
}

export async function loadProductionAllocationInput(
  supabase: SupabaseClient,
  productionId: string,
): Promise<ProductionAllocationInput> {
  const [
    castResult,
    charactersResult,
    pagesResult,
    movementsResult,
    stageStatesResult,
    swapSettingsResult,
  ] = await Promise.all([
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
      .from("show_pages")
      .select("id,is_interval")
      .eq("production_id", productionId)
      .order("sort_order"),
    supabase
      .from("movements")
      .select("id,page_id")
      .eq("production_id", productionId)
      .order("sort_order"),
    supabase
      .from("movement_characters")
      .select("movement_id,character_id,priority_override")
      .eq("production_id", productionId),
    supabase
      .from("swap_settings")
      .select(
        "handheld_swap_pages,bodypack_mode,bodypack_swap_pages,lapel_boom_compatible,lapel_mic_swap_pages,boom_mic_swap_pages",
      )
      .eq("production_id", productionId)
      .maybeSingle(),
  ]);

  const error =
    castResult.error ||
    charactersResult.error ||
    pagesResult.error ||
    movementsResult.error ||
    stageStatesResult.error ||
    swapSettingsResult.error;
  if (error) throw new Error(error.message);

  const pages = pagesResult.data ?? [];
  const pageOrdinalById = new Map(
    pages.map((page, index) => [page.id, index]),
  );

  const requirements = deriveCastRequirements({
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
    movements: (movementsResult.data ?? []).map((movement) => ({
      id: movement.id,
    })),
    stageStates: (stageStatesResult.data ?? []).map((state) => ({
      movementId: state.movement_id,
      characterId: state.character_id,
      priorityOverride: state.priority_override,
    })),
  });

  const settings = swapSettingsResult.data;
  const swapSettings: SwapTimingSettings = {
    handheldSwapPages: settings?.handheld_swap_pages ?? 1,
    bodypackMode: settings?.bodypack_mode ?? "one_mic_per_cast",
    bodypackSwapPages: settings?.bodypack_swap_pages ?? 1,
    lapelBoomCompatible: settings?.lapel_boom_compatible ?? true,
    lapelMicSwapPages: settings?.lapel_mic_swap_pages ?? 1,
    boomMicSwapPages: settings?.boom_mic_swap_pages ?? 1,
  };

  let inheritedPageOrdinal = 0;
  const frames = (movementsResult.data ?? []).map((movement) => {
    const explicit =
      movement.page_id !== null
        ? pageOrdinalById.get(movement.page_id)
        : undefined;

    if (explicit !== undefined) inheritedPageOrdinal = explicit;

    return {
      movementId: movement.id,
      pageOrdinal: inheritedPageOrdinal,
    };
  });

  const intervalPageOrdinals = pages
    .map((page, index) => (page.is_interval ? index : -1))
    .filter((index) => index >= 0);

  return {
    requirements,
    timing: {
      frames,
      intervalPageOrdinals,
      swapSettings,
    },
  };
}

export async function loadProductionRequirements(
  supabase: SupabaseClient,
  productionId: string,
): Promise<CastRequirement[]> {
  const input = await loadProductionAllocationInput(supabase, productionId);
  return input.requirements;
}
