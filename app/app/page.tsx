import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace-shell";
import { WorkspaceOnboarding } from "@/components/workspace-onboarding";
import { NewProductionCard } from "@/components/new-production-card";
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

  const { data: workspaces, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id,name,kind")
    .order("name");

  if (workspaceError) {
    console.error(workspaceError);
  }

  const workspace = workspaces?.[0];
  if (!workspace) {
    return <WorkspaceOnboarding />;
  }

  const { data: productions, error: productionError } = await supabase
    .from("productions")
    .select("id,name,is_template")
    .eq("workspace_id", workspace.id)
    .order("updated_at", { ascending: false });

  if (productionError) {
    console.error(productionError);
  }

  if (!productions?.length) {
    return (
      <main className="empty-workspace">
        <WorkspaceShell previewMode={false} workspaceName={workspace.name} compact />
        <NewProductionCard workspaceId={workspace.id} />
      </main>
    );
  }

  return (
    <WorkspaceShell
      previewMode={false}
      workspaceName={workspace.name}
      productions={productions.map((production) => ({
        id: production.id,
        name: production.name,
        isTemplate: production.is_template,
      }))}
    />
  );
}
