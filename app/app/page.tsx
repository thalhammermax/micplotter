import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace-shell";
import { createClient } from "@/lib/supabase/server";

export default async function WorkspacePage() {
  const configured =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  if (!configured) {
    return <WorkspaceShell previewMode />;
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) redirect("/login");

  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id,name,kind")
    .order("name");

  return (
    <WorkspaceShell
      previewMode={false}
      workspaceName={workspaces?.[0]?.name ?? "My Workspace"}
    />
  );
}
