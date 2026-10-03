import Link from "next/link";

export default function Home() {
  return (
    <main className="landing">
      <section className="landing-card">
        <div className="eyebrow">Sound design · technical theatre</div>
        <h1>MicPlotter</h1>
        <p className="lede">
          Build, optimize, share, and teach wireless microphone plots from the browser.
        </p>
        <div className="landing-actions">
          <Link className="primary-button" href="/app">
            Open workspace
          </Link>
          <Link className="secondary-button" href="/login">
            Sign in
          </Link>
        </div>
        <div className="feature-grid">
          <div>
            <strong>Collaborative</strong>
            <span>Shared productions, roles, invitations, and workspace ownership.</span>
          </div>
          <div>
            <strong>MicPlot-compatible workflow</strong>
            <span>Show, Characters, Cast, Understudies, Movements, Groups, Plot, Compare.</span>
          </div>
          <div>
            <strong>Designed for education</strong>
            <span>Duplicate templates and teaching examples without exposing private production data.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
