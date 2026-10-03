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

  let pageRows: Array<{ id: string; sort_order: number }> = [];
  if (legacy.pages.length) {
    const { data, error } = await supabase
      .from("show_pages")
      .insert(
        legacy.pages.map((page, index) => ({
          production_id: production.id,
          sort_order: (index + 1) * 10,
          act: page.act ? String(page.act) : null,
          scene: page.scene ? String(page.scene) : null,
          page_label: nullable(page.pageLabel),
          is_interval: page.isInterval,
          comment: nullable(page.comment),
        })),
      )
      .select("id,sort_order");
    if (error) throw new Error(error.message);
    pageRows = (data ?? []).sort((a, b) => a.sort_order - b.sort_order);
  }

  let castRows: Array<{ id: string; sort_order: number }> = [];
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
      .select("id,sort_order");

    if (error) throw new Error(error.message);
    castRows = (data ?? []).sort((a, b) => a.sort_order - b.sort_order);
  }

  let characterRows: Array<{ id: string; sort_order: number }> = [];
  if (legacy.characters.length) {
    const { data, error } = await supabase
      .from("characters")
      .insert(
        legacy.characters.map((character, index) => ({
          production_id: production.id,
          sort_order: (index + 1) * 10,
          name: character.name,
          abbreviation: nullable(character.abbreviation),
          mic_priority: character.micPriority,
          mic_quality: character.micQuality,
          played_by_cast_id:
            character.playedByIndex !== null
              ? castRows[character.playedByIndex]?.id ?? null
              : null,
        })),
      )
      .select("id,sort_order");
    if (error) throw new Error(error.message);
    characterRows = (data ?? []).sort((a, b) => a.sort_order - b.sort_order);
  }

  if (legacy.movements.length) {
    const { data: movementRows, error: movementError } = await supabase
      .from("movements")
      .insert(
        legacy.movements.map((movement, index) => ({
          production_id: production.id,
          sort_order: (index + 1) * 10,
          cue_id: nullable(movement.cueId),
          title: nullable(movement.title),
          page_id:
            movement.pageIndex !== null
              ? pageRows[movement.pageIndex]?.id ?? null
              : null,
          cue: nullable(movement.cue),
        })),
      )
      .select("id,sort_order");

    if (movementError) throw new Error(movementError.message);
    const orderedMovements = (movementRows ?? []).sort(
      (a, b) => a.sort_order - b.sort_order,
    );

    const stageRows = legacy.movements.flatMap((movement, movementIndex) => {
      const movementId = orderedMovements[movementIndex]?.id;
      if (!movementId) return [];

      return movement.onStageCharacterIndexes.flatMap((characterIndex) => {
        const characterId = characterRows[characterIndex]?.id;
        if (!characterId) return [];
        return [{
          production_id: production.id,
          movement_id: movementId,
          character_id: characterId,
          priority_override: null,
        }];
      });
    });

    if (stageRows.length) {
      const { error } = await supabase.from("movement_characters").insert(stageRows);
      if (error) throw new Error(error.message);
    }

    const noteRows = legacy.movements.flatMap((movement, movementIndex) => {
      const movementId = orderedMovements[movementIndex]?.id;
      if (!movementId) return [];

      return movement.notes.flatMap((body, noteIndex) =>
        body
          ? [{
              production_id: production.id,
              movement_id: movementId,
              note_page: noteIndex + 1,
              heading: "Note " + (noteIndex + 1),
              body,
            }]
          : [],
      );
    });

    if (noteRows.length) {
      const { error } = await supabase.from("movement_notes").insert(noteRows);
      if (error) throw new Error(error.message);
    }
  }

  return {
    production,
    legacy,
  };
}
