import Link from "next/link";
import { redirect } from "next/navigation";
import { importMpl } from "@/app/app/actions";
import { createClient } from "@/lib/supabase/server";

const errors: Record<string, string> = {
  file: "Choose a MicPlot .mpl file to import.",
  extension: "The selected file must use the .mpl extension.",
  size: "The selected file is empty or larger than 4 MB.",
  parse:
    "MicPlotter could not decode that .mpl file yet. The original file was not modified.",
};

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/login");

  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id,name")
    .order("name");

  if (!workspaces?.length) redirect("/app");

  return (
    <main className="import-page">
      <section className="import-card">
        <Link href="/app" className="back-link">← Back to productions</Link>
        <div className="eyebrow">Legacy import</div>
        <h1>Open a MicPlot file</h1>
        <p>
          Upload a legacy <strong>.mpl</strong> file and MicPlotter will convert
          the supported project data into a collaborative web production.
        </p>

        {query.error ? (
          <div className="setup-notice">
            {errors[query.error] ?? "The MicPlot file could not be imported."}
          </div>
        ) : null}

        <form action={importMpl} className="auth-form">
          <label>
            Workspace
            <select name="workspaceId" defaultValue={workspaces[0].id}>
              {workspaces.map((workspace) => (
                <option value={workspace.id} key={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            MicPlot file
            <input name="file" type="file" accept=".mpl" required />
          </label>

          <button className="primary-button">Import and open</button>
        </form>

        <div className="compatibility-note">
          <strong>Current compatibility</strong>
          <p>
            MicPlot 2.1 files are decoded directly. The first compatibility pass
            imports production metadata, script pages, cast, and characters.
            Additional legacy sections such as understudy substitutions,
            movement stage-state details, and transmitter allocations are being
            mapped next.
          </p>
        </div>
      </section>
    </main>
  );
}
