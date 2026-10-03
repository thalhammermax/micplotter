"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { importLegacyMplProject } from "@/lib/legacy/import-project";

function required(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  if (!value) throw new Error(name + " is required");
  return value;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "workspace";
}

export async function createWorkspace(formData: FormData) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/login");

  const name = required(formData, "name");
  const kind = String(formData.get("kind") ?? "sound_design");
  const slug = slugify(name) + "-" + crypto.randomUUID().slice(0, 8);

  const { error } = await supabase.from("workspaces").insert({
    name,
    slug,
    kind,
    owner_id: userId,
  });

  if (error) {
    console.error(error);
    redirect("/app?error=workspace");
  }

  revalidatePath("/app");
  redirect("/app");
}

export async function createProduction(formData: FormData) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/login");

  const workspaceId = required(formData, "workspaceId");
  const name = required(formData, "name");
  const isTemplate = formData.get("isTemplate") === "on";

  const { error } = await supabase.from("productions").insert({
    workspace_id: workspaceId,
    name,
    created_by: userId,
    is_template: isTemplate,
    template_visibility: isTemplate ? "workspace" : "private",
  });

  if (error) {
    console.error(error);
    redirect("/app?error=production");
  }

  revalidatePath("/app");
  redirect("/app");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}


export async function importMpl(formData: FormData) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/login");

  const workspaceId = required(formData, "workspaceId");
  const upload = formData.get("file");

  if (!(upload instanceof File)) {
    redirect("/app/import?error=file");
  }

  if (!upload.name.toLowerCase().endsWith(".mpl")) {
    redirect("/app/import?error=extension");
  }

  if (upload.size === 0 || upload.size > 10 * 1024 * 1024) {
    redirect("/app/import?error=size");
  }

  try {
    const bytes = new Uint8Array(await upload.arrayBuffer());
    const result = await importLegacyMplProject({
      supabase,
      bytes,
      userId,
      workspaceId,
      fallbackName: upload.name.replace(/\.mpl$/i, ""),
    });

    revalidatePath("/app");
    redirect("/app/productions/" + result.production.id + "?tab=show");
  } catch (error) {
    console.error("MicPlot import failed", error);
    redirect("/app/import?error=parse");
  }
}
