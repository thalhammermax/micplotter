import { createProduction } from "@/app/app/actions";

export function NewProductionCard({ workspaceId }: { workspaceId: string }) {
  return (
    <section className="new-production-card">
      <div>
        <div className="eyebrow">Start a show</div>
        <h2>Create a production</h2>
        <p>
          Build a production from scratch now; reusable show templates and legacy MicPlot
          import will plug into this same production model.
        </p>
      </div>
      <form action={createProduction} className="inline-production-form">
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <input name="name" placeholder="Production name" required />
        <label className="check-label">
          <input type="checkbox" name="isTemplate" /> Start as a reusable template
        </label>
        <button className="primary-button">Create</button>
      </form>
    </section>
  );
}
