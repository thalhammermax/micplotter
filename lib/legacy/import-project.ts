import type { SupabaseClient } from "@supabase/supabase-js";
import { parseLegacyMpl } from "./mpl";

function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseProductionDate(value: string) {
  // Legacy files often contain display strings such as "October 2006" rather
  // than ISO dates. Keep those in notes rather than inventing a specific day.
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export async function importLegacyMplProject({
  supabase,
  bytes,
  userId,
  workspaceId,
  fallbackName,
}: {
  supabase: SupabaseClient;
  bytes: Uint8Array;
  userId: string;
  workspaceId: string;
  fallbackName: string;
}) {
  const legacy = parseLegacyMpl(bytes);

  const legacyDateNote =
    legacy.productionDate && !parseProductionDate(legacy.productionDate)
      ? "Legacy production date: " + legacy.productionDate
      : null;

  const notes = [legacy.notes, legacyDateNote, ...legacy.parserWarnings]
    .filter(Boolean)
    .join("\n\n");

  const { data: production, error: productionError } = await supabase
    .from("productions")
    .insert({
      workspace_id: workspaceId,
      name: nullable(legacy.showName) ?? fallbackName,
      production_company: nullable(legacy.productionCompany),
      production_date: parseProductionDate(legacy.productionDate),
      micplot_version: nullable(legacy.micplotVersion),
      notes: nullable(notes),
      created_by: userId,
    })
    .select("id,name")
    .single();

  if (productionError || !production) {
    throw new Error(productionError?.message ?? "Unable to create imported production.");
  }

  if (legacy.pages.length) {
    const { error } = await supabase.from("show_pages").insert(
      legacy.pages.map((page, index) => ({
        production_id: production.id,
        sort_order: (index + 1) * 10,
        act: page.act ? String(page.act) : null,
        scene: page.scene ? String(page.scene) : null,
        page_label: nullable(page.pageLabel),
        is_interval: page.isInterval,
        comment: nullable(page.comment),
      })),
    );
    if (error) throw new Error(error.message);
  }

  let castRows: Array<{ id: string }> = [];
  if (legacy.cast.length) {
    const { data, error } = await supabase
      .from("cast_members")
      .insert(
        legacy.cast.map((member, index) => ({
          production_id: production.id,
          sort_order: (index + 1) * 10,
          name: member.name,
          abbreviation: nullable(member.abbreviation),
          when_miked: "normal",
        })),
      )
      .select("id");

    if (error) throw new Error(error.message);
    castRows = data ?? [];
  }

  if (legacy.characters.length) {
    const { error } = await supabase.from("characters").insert(
      legacy.characters.map((character, index) => ({
        production_id: production.id,
        sort_order: (index + 1) * 10,
        name: character.name,
        abbreviation: nullable(character.abbreviation),
        mic_priority: "must",
        played_by_cast_id:
          character.playedByIndex !== null
            ? castRows[character.playedByIndex]?.id ?? null
            : null,
      })),
    );
    if (error) throw new Error(error.message);
  }

  return {
    production,
    legacy,
  };
}
