"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function required(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!value) throw new Error(key + " is required");
  return value;
}

async function nextSortOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  productionId: string,
) {
  const { data } = await supabase
    .from(table)
    .select("sort_order")
    .eq("production_id", productionId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const current = data?.[0]?.sort_order;
  return typeof current === "number" ? current + 10 : 10;
}

function finish(productionId: string, tab: string) {
  revalidatePath("/app");
  revalidatePath("/app/productions/" + productionId);
  redirect("/app/productions/" + productionId + "?tab=" + tab);
}

export async function addShowPage(formData: FormData) {
  const productionId = required(formData, "productionId");
  const supabase = await createClient();
  const sortOrder = await nextSortOrder(supabase, "show_pages", productionId);

  const { error } = await supabase.from("show_pages").insert({
    production_id: productionId,
    sort_order: sortOrder,
    act: text(formData, "act") || null,
    scene: text(formData, "scene") || null,
    page_label: text(formData, "pageLabel") || null,
    is_interval: formData.get("isInterval") === "on",
    comment: text(formData, "comment") || null,
  });

  if (error) throw new Error(error.message);
  finish(productionId, "show");
}

export async function addCastMember(formData: FormData) {
  const productionId = required(formData, "productionId");
  const supabase = await createClient();
  const sortOrder = await nextSortOrder(supabase, "cast_members", productionId);

  const { error } = await supabase.from("cast_members").insert({
    production_id: productionId,
    sort_order: sortOrder,
    name: required(formData, "name"),
    abbreviation: text(formData, "abbreviation") || null,
    ensemble: formData.get("ensemble") === "on",
    ensemble_priority: text(formData, "ensemblePriority") || "must",
    when_miked: text(formData, "whenMiked") || "normal",
    mic_style: text(formData, "micStyle") || null,
    mic_colour: text(formData, "micColour") || null,
    belt_size: text(formData, "beltSize") || null,
    projection: text(formData, "projection") || null,
    vocal_range: text(formData, "vocalRange") || null,
  });

  if (error) throw new Error(error.message);
  finish(productionId, "cast");
}

export async function addCharacter(formData: FormData) {
  const productionId = required(formData, "productionId");
  const supabase = await createClient();
  const sortOrder = await nextSortOrder(supabase, "characters", productionId);

  const playedBy = text(formData, "playedByCastId");

  const { error } = await supabase.from("characters").insert({
    production_id: productionId,
    sort_order: sortOrder,
    name: required(formData, "name"),
    abbreviation: text(formData, "abbreviation") || null,
    mic_priority: text(formData, "micPriority") || "must",
    mic_quality: text(formData, "micQuality")
      ? Number(text(formData, "micQuality"))
      : null,
    played_by_cast_id: playedBy || null,
  });

  if (error) throw new Error(error.message);
  finish(productionId, "characters");
}

export async function addMovement(formData: FormData) {
  const productionId = required(formData, "productionId");
  const supabase = await createClient();
  const sortOrder = await nextSortOrder(supabase, "movements", productionId);
  const pageId = text(formData, "pageId");

  const { error } = await supabase.from("movements").insert({
    production_id: productionId,
    sort_order: sortOrder,
    cue_id: text(formData, "cueId") || null,
    title: text(formData, "title") || null,
    page_id: pageId || null,
    cue: text(formData, "cue") || null,
  });

  if (error) throw new Error(error.message);
  finish(productionId, "movements");
}

export async function addTransmitterGroup(formData: FormData) {
  const productionId = required(formData, "productionId");
  const supabase = await createClient();
  const sortOrder = await nextSortOrder(supabase, "transmitter_groups", productionId);

  const micIds = text(formData, "micIds")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const { error } = await supabase.from("transmitter_groups").insert({
    production_id: productionId,
    sort_order: sortOrder,
    tx_name: required(formData, "txName"),
    mic_ids: micIds,
  });

  if (error) throw new Error(error.message);
  finish(productionId, "groups");
}


export async function updateShowPage(formData: FormData) {
  const productionId = required(formData, "productionId");
  const id = required(formData, "id");
  const supabase = await createClient();

  const { error } = await supabase
    .from("show_pages")
    .update({
      act: text(formData, "act") || null,
      scene: text(formData, "scene") || null,
      page_label: text(formData, "pageLabel") || null,
      is_interval: formData.get("isInterval") === "on",
      comment: text(formData, "comment") || null,
    })
    .eq("id", id)
    .eq("production_id", productionId);

  if (error) throw new Error(error.message);
  finish(productionId, "show");
}

export async function deleteShowPage(formData: FormData) {
  const productionId = required(formData, "productionId");
  const id = required(formData, "id");
  const supabase = await createClient();
  const { error } = await supabase
    .from("show_pages")
    .delete()
    .eq("id", id)
    .eq("production_id", productionId);
  if (error) throw new Error(error.message);
  finish(productionId, "show");
}

export async function updateCastMember(formData: FormData) {
  const productionId = required(formData, "productionId");
  const id = required(formData, "id");
  const supabase = await createClient();

  const { error } = await supabase
    .from("cast_members")
    .update({
      name: required(formData, "name"),
      abbreviation: text(formData, "abbreviation") || null,
      ensemble: formData.get("ensemble") === "on",
      ensemble_priority: text(formData, "ensemblePriority") || "must",
      when_miked: text(formData, "whenMiked") || "normal",
      mic_style: text(formData, "micStyle") || null,
      mic_colour: text(formData, "micColour") || null,
      belt_size: text(formData, "beltSize") || null,
      projection: text(formData, "projection") || null,
      vocal_range: text(formData, "vocalRange") || null,
    })
    .eq("id", id)
    .eq("production_id", productionId);

  if (error) throw new Error(error.message);
  finish(productionId, "cast");
}

export async function deleteCastMember(formData: FormData) {
  const productionId = required(formData, "productionId");
  const id = required(formData, "id");
  const supabase = await createClient();
  const { error } = await supabase
    .from("cast_members")
    .delete()
    .eq("id", id)
    .eq("production_id", productionId);
  if (error) throw new Error(error.message);
  finish(productionId, "cast");
}

export async function updateCharacter(formData: FormData) {
  const productionId = required(formData, "productionId");
  const id = required(formData, "id");
  const supabase = await createClient();
  const playedBy = text(formData, "playedByCastId");

  const { error } = await supabase
    .from("characters")
    .update({
      name: required(formData, "name"),
      abbreviation: text(formData, "abbreviation") || null,
      mic_priority: text(formData, "micPriority") || "must",
      mic_quality: text(formData, "micQuality")
        ? Number(text(formData, "micQuality"))
        : null,
      played_by_cast_id: playedBy || null,
    })
    .eq("id", id)
    .eq("production_id", productionId);

  if (error) throw new Error(error.message);
  finish(productionId, "characters");
}

export async function deleteCharacter(formData: FormData) {
  const productionId = required(formData, "productionId");
  const id = required(formData, "id");
  const supabase = await createClient();
  const { error } = await supabase
    .from("characters")
    .delete()
    .eq("id", id)
    .eq("production_id", productionId);
  if (error) throw new Error(error.message);
  finish(productionId, "characters");
}

export async function updateMovement(formData: FormData) {
  const productionId = required(formData, "productionId");
  const id = required(formData, "id");
  const supabase = await createClient();
  const pageId = text(formData, "pageId");

  const { error } = await supabase
    .from("movements")
    .update({
      cue_id: text(formData, "cueId") || null,
      title: text(formData, "title") || null,
      page_id: pageId || null,
      cue: text(formData, "cue") || null,
    })
    .eq("id", id)
    .eq("production_id", productionId);

  if (error) throw new Error(error.message);
  finish(productionId, "movements");
}

export async function deleteMovement(formData: FormData) {
  const productionId = required(formData, "productionId");
  const id = required(formData, "id");
  const supabase = await createClient();
  const { error } = await supabase
    .from("movements")
    .delete()
    .eq("id", id)
    .eq("production_id", productionId);
  if (error) throw new Error(error.message);
  finish(productionId, "movements");
}

export async function updateTransmitterGroup(formData: FormData) {
  const productionId = required(formData, "productionId");
  const id = required(formData, "id");
  const supabase = await createClient();
  const micIds = text(formData, "micIds")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const { error } = await supabase
    .from("transmitter_groups")
    .update({
      tx_name: required(formData, "txName"),
      mic_ids: micIds,
    })
    .eq("id", id)
    .eq("production_id", productionId);

  if (error) throw new Error(error.message);
  finish(productionId, "groups");
}

export async function deleteTransmitterGroup(formData: FormData) {
  const productionId = required(formData, "productionId");
  const id = required(formData, "id");
  const supabase = await createClient();
  const { error } = await supabase
    .from("transmitter_groups")
    .delete()
    .eq("id", id)
    .eq("production_id", productionId);
  if (error) throw new Error(error.message);
  finish(productionId, "groups");
}
