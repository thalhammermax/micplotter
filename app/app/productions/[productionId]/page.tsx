import { notFound, redirect } from "next/navigation";
import { ProductionEditor } from "@/components/production-editor";
import { createClient } from "@/lib/supabase/server";
import { loadProductionAllocationInput } from "@/lib/allocator/production";
import { scoreMicplot, formatFastSwapProfile } from "@/lib/allocator/score";

const validTabs = new Set([
  "show",
  "characters",
  "cast",
  "understudies",
  "movements",
  "groups",
  "micplot",
  "compare",
]);

export default async function ProductionPage({
  params,
  searchParams,
}: {
  params: Promise<{ productionId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { productionId } = await params;
  const query = await searchParams;
  const tab = validTabs.has(query.tab ?? "") ? query.tab! : "show";

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/login");

  const [
    productionResult,
    pagesResult,
    castResult,
    charactersResult,
    movementsResult,
    movementCharactersResult,
    groupsResult,
    groupMembersResult,
    swapSettingsResult,
  ] = await Promise.all([
    supabase
      .from("productions")
      .select("id,name,production_company,production_date,notes")
      .eq("id", productionId)
      .single(),
    supabase
      .from("show_pages")
      .select("id,act,scene,page_label,is_interval,comment")
      .eq("production_id", productionId)
      .order("sort_order"),
    supabase
      .from("cast_members")
      .select("id,name,abbreviation,ensemble,ensemble_priority,when_miked,mic_style,mic_colour,belt_size,projection,vocal_range")
      .eq("production_id", productionId)
      .order("sort_order"),
    supabase
      .from("characters")
      .select("id,name,abbreviation,mic_priority,mic_quality,played_by_cast_id")
      .eq("production_id", productionId)
      .order("sort_order"),
    supabase
      .from("movements")
      .select("id,cue_id,title,page_id,cue")
      .eq("production_id", productionId)
      .order("sort_order"),
    supabase
      .from("movement_characters")
      .select("movement_id,character_id,priority_override")
      .eq("production_id", productionId),
    supabase
      .from("transmitter_groups")
      .select("id,tx_name,mic_ids,sort_order")
      .eq("production_id", productionId)
      .order("sort_order"),
    supabase
      .from("group_members")
      .select("group_id,cast_member_id,sort_order")
      .eq("production_id", productionId)
      .order("sort_order"),
    supabase
      .from("swap_settings")
      .select("handheld_swap_pages,bodypack_mode,bodypack_swap_pages,lapel_boom_compatible,lapel_mic_swap_pages,boom_mic_swap_pages")
      .eq("production_id", productionId)
      .maybeSingle(),
  ]);

  if (productionResult.error || !productionResult.data) notFound();

  const allocationInput = await loadProductionAllocationInput(
    supabase,
    productionId,
  );

  const currentGroups = (groupsResult.data ?? []).map((group) => ({
    id: group.tx_name,
    members: (groupMembersResult.data ?? [])
      .filter((member) => member.group_id === group.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((member) => member.cast_member_id),
  }));

  const currentMicplot = currentGroups.length
    ? scoreMicplot(
        currentGroups,
        allocationInput.requirements,
        allocationInput.timing,
      )
    : null;

  const pages = pagesResult.data ?? [];
  const movements = movementsResult.data ?? [];
  const characters = charactersResult.data ?? [];
  const stageStates = movementCharactersResult.data ?? [];

  const pageIndexById = new Map(
    pages.map((page, index) => [page.id, index]),
  );

  const characterActorById = new Map(
    characters.map((character) => [
      character.id,
      character.played_by_cast_id,
    ]),
  );

  const onSceneActorsByMovement = new Map<string, Set<string>>();
  for (const state of stageStates) {
    const actorId = characterActorById.get(state.character_id);
    if (!actorId) continue;
    const set =
      onSceneActorsByMovement.get(state.movement_id) ?? new Set<string>();
    set.add(actorId);
    onSceneActorsByMovement.set(state.movement_id, set);
  }

  let inheritedPageIndex = 0;
  const movementPageIndexes = movements.map((movement) => {
    if (movement.page_id) {
      const explicit = pageIndexById.get(movement.page_id);
      if (explicit !== undefined) inheritedPageIndex = explicit;
    }
    return inheritedPageIndex;
  });

  const movementLabel = (movement: (typeof movements)[number], index: number) =>
    [movement.cue_id, movement.title].filter(Boolean).join(" · ") ||
    "Movement " + String(index + 1);

  const micplotPages = pages.map((page, pageIndex) => {
    const frameIndexes = movements
      .map((_, index) => index)
      .filter((index) => movementPageIndexes[index] === pageIndex);

    let latestFrame = -1;
    for (let index = 0; index < movementPageIndexes.length; index += 1) {
      if (movementPageIndexes[index] <= pageIndex) latestFrame = index;
      else break;
    }

    const framesToRender =
      frameIndexes.length > 0
        ? frameIndexes
        : latestFrame >= 0
          ? [latestFrame]
          : [];

    const cells: Record<
      string,
      Array<{
        actorId: string | null;
        onScene: boolean;
        movementLabel: string;
        isMovementOnPage: boolean;
      }>
    > = {};

    for (const group of currentGroups) {
      const assignments =
        currentMicplot?.frameAssignments[group.id] ?? [];

      cells[group.id] = framesToRender.map((frameIndex) => {
        const actorId = assignments[frameIndex] ?? null;
        const movement = movements[frameIndex];
        const onSceneActors = movement
          ? onSceneActorsByMovement.get(movement.id) ?? new Set<string>()
          : new Set<string>();

        return {
          actorId,
          onScene: actorId ? onSceneActors.has(actorId) : false,
          movementLabel: movement
            ? movementLabel(movement, frameIndex)
            : "",
          isMovementOnPage: frameIndexes.includes(frameIndex),
        };
      });
    }

    return {
      pageId: page.id,
      pageLabel: page.is_interval
        ? "Interval"
        : [page.act, page.scene, page.page_label]
            .filter(Boolean)
            .join(" · ") || "Page " + String(pageIndex + 1),
      comment: page.comment,
      isInterval: page.is_interval,
      cells,
    };
  });

  return (
    <ProductionEditor
      production={productionResult.data}
      tab={tab as Parameters<typeof ProductionEditor>[0]["tab"]}
      pages={pagesResult.data ?? []}
      cast={castResult.data ?? []}
      characters={charactersResult.data ?? []}
      movements={movementsResult.data ?? []}
      movementCharacters={movementCharactersResult.data ?? []}
      groups={groupsResult.data ?? []}
      groupMembers={groupMembersResult.data ?? []}
      micplot={
        currentMicplot
          ? {
              frameAssignments: currentMicplot.frameAssignments,
              metrics: currentMicplot.metrics,
              fastSwapProfile: formatFastSwapProfile(
                currentMicplot.metrics.fastSwaps,
              ),
              invalidSwapCount: currentMicplot.invalidSwapCount,
              pages: micplotPages,
            }
          : null
      }
      swapSettings={swapSettingsResult.data ?? {
        handheld_swap_pages: 1,
        bodypack_mode: "one_mic_per_cast",
        bodypack_swap_pages: 1,
        lapel_boom_compatible: true,
        lapel_mic_swap_pages: 1,
        boom_mic_swap_pages: 1,
      }}
    />
  );
}
