import { createWorkspace } from "@/app/app/actions";

export function WorkspaceOnboarding() {
  return (
    <main className="onboarding-page">
      <section className="onboarding-card">
        <div className="eyebrow">Welcome to MicPlotter</div>
        <h1>Create your workspace</h1>
        <p>
          Workspaces keep each sound design team, school, or theatre separate while still
          allowing productions and templates to be shared intentionally.
        </p>
        <form action={createWorkspace} className="auth-form">
          <label>
            Workspace name
            <input name="name" placeholder="Example: Northstar Sound" required />
          </label>
          <label>
            Workspace type
            <select name="kind" defaultValue="sound_design">
              <option value="sound_design">Sound design team</option>
              <option value="education">Technical theatre education</option>
              <option value="theatre">Theatre / producing organization</option>
              <option value="personal">Personal</option>
            </select>
          </label>
          <button className="primary-button">Create workspace</button>
        </form>
      </section>
    </main>
  );
}
