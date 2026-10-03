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

  const pageLabelById = new Map(
    (pagesResult.data ?? []).map((page) => [
      page.id,
      page.is_interval
        ? "Interval"
        : [page.act, page.scene, page.page_label]
            .filter(Boolean)
            .join(" · "),
    ]),
  );

  const micplotFrames = (movementsResult.data ?? []).map((movement, index) => ({
    movementId: movement.id,
    movementLabel:
      [movement.cue_id, movement.title].filter(Boolean).join(" · ") ||
      "Movement " + String(index + 1),
    pageLabel: movement.page_id
      ? pageLabelById.get(movement.page_id) ?? ""
      : "",
  }));

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
              frames: micplotFrames,
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
