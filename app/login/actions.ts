"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

export async function login(formData: FormData) {
  const supabase = await createClient();
  const email = value(formData, "email");
  const password = value(formData, "password");

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=signin");

  revalidatePath("/", "layout");
  redirect("/app");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();
  const email = value(formData, "email");
  const password = value(formData, "password");
  const displayName = value(formData, "displayName");

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
    },
  });

  if (error) redirect("/login?error=signup");
  redirect("/login?created=1");
}
