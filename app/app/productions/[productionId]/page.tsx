import { notFound, redirect } from "next/navigation";
import { ProductionEditor } from "@/components/production-editor";
import { createClient } from "@/lib/supabase/server";

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
    groupsResult,
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
      .select("id,name,abbreviation,ensemble,when_miked,mic_style")
      .eq("production_id", productionId)
      .order("sort_order"),
    supabase
      .from("characters")
      .select("id,name,abbreviation,mic_priority,played_by_cast_id")
      .eq("production_id", productionId)
      .order("sort_order"),
    supabase
      .from("movements")
      .select("id,cue_id,title,page_id,cue")
      .eq("production_id", productionId)
      .order("sort_order"),
    supabase
      .from("transmitter_groups")
      .select("id,tx_name,mic_ids")
      .eq("production_id", productionId)
      .order("sort_order"),
  ]);

  if (productionResult.error || !productionResult.data) notFound();

  return (
    <ProductionEditor
      production={productionResult.data}
      tab={tab as Parameters<typeof ProductionEditor>[0]["tab"]}
      pages={pagesResult.data ?? []}
      cast={castResult.data ?? []}
      characters={charactersResult.data ?? []}
      movements={movementsResult.data ?? []}
      groups={groupsResult.data ?? []}
    />
  );
}
