"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const tabs = [
  "Show",
  "Characters",
  "Cast",
  "Understudies",
  "Movements",
  "Groups",
  "MicPlot",
  "Compare",
] as const;

type Tab = (typeof tabs)[number];

const demoRows: Record<Tab, Array<Record<string, string>>> = {
  Show: [
    { primary: "Act 1 · Scene 1 · p.1", secondary: "Opening", status: "Page" },
    { primary: "Act 1 · Scene 1 · p.2", secondary: "Company entrance", status: "Page" },
    { primary: "Interval", secondary: "Intermission", status: "Interval" },
  ],
  Characters: [
    { primary: "Narrator", secondary: "NAR · Must Mic", status: "Lead" },
    { primary: "Alex", secondary: "ALX · Must Mic", status: "Principal" },
    { primary: "Ensemble", secondary: "ENS · Variable (Nice)", status: "Ensemble" },
  ],
  Cast: [
    { primary: "Jordan Lee", secondary: "JL · First To Last", status: "2 roles" },
    { primary: "Sam Rivera", secondary: "SR · Normal", status: "1 role" },
    { primary: "Taylor Morgan", secondary: "TM · Always", status: "Lead" },
  ],
  Understudies: [
    { primary: "Sam as Narrator", secondary: "Narrator · Jordan → Sam", status: "Ready" },
    { primary: "Taylor as Alex", secondary: "Alex · Sam → Taylor", status: "Ready" },
  ],
  Movements: [
    { primary: "1.0 · Preset", secondary: "Page 1 · House to half", status: "3 on stage" },
    { primary: "2.0 · Opening", secondary: "Page 2 · Company enters", status: "8 on stage" },
    { primary: "15.0 · Interval clear", secondary: "Interval · All off", status: "0 on stage" },
  ],
  Groups: [
    { primary: "TX_001", secondary: "Jordan → Sam", status: "No conflict" },
    { primary: "TX_002", secondary: "Taylor", status: "No conflict" },
    { primary: "TX_003", secondary: "Ensemble rotation", status: "1 fast swap" },
  ],
  MicPlot: [
    { primary: "TX_001", secondary: "Jordan 1–22 · Sam 24–38", status: "1 swap" },
    { primary: "TX_002", secondary: "Taylor 1–56", status: "0 swaps" },
    { primary: "TX_003", secondary: "Alex 5–12 · Ensemble 16–29", status: "2 swaps" },
  ],
  Compare: [
    { primary: "Current", secondary: "9 transmitters · 14 swaps", status: "Active" },
    { primary: "Reference", secondary: "9 transmitters · 16 swaps", status: "Reference" },
  ],
};

function DataList({ rows }: { rows: Array<Record<string, string>> }) {
  return (
    <div className="data-list">
      {rows.map((row, index) => (
        <button className="data-row" key={row.primary + "-" + index}>
          <span className="row-number">{String(index + 1).padStart(2, "0")}</span>
          <span className="row-main">
            <strong>{row.primary}</strong>
            <small>{row.secondary}</small>
          </span>
          <span className="row-status">{row.status}</span>
        </button>
      ))}
      <button className="add-row">+ Add</button>
    </div>
  );
}

function TabPanel({ tab }: { tab: Tab }) {
  const rows = demoRows[tab];

  if (tab === "Groups") {
    return (
      <>
        <div className="action-strip">
          <button className="primary-button small">Auto allocate</button>
          <button className="secondary-button small">Swap times</button>
          <div className="metric-pill"><span>TXs</span><strong>9</strong></div>
          <div className="metric-pill"><span>Swaps</span><strong>14</strong></div>
          <div className="metric-pill"><span>Peak</span><strong>2</strong></div>
        </div>
        <DataList rows={rows} />
      </>
    );
  }

  if (tab === "MicPlot") {
    return (
      <>
        <div className="plot-summary">
          <div><span>Conflict</span><strong className="good">None</strong></div>
          <div><span>Ungrouped</span><strong className="good">0</strong></div>
          <div><span>Transmitters</span><strong>9</strong></div>
          <div><span>Total swaps</span><strong>14</strong></div>
        </div>
        <div className="timeline">
          {["TX_001", "TX_002", "TX_003", "TX_004"].map((tx, index) => (
            <div className="timeline-row" key={tx}>
              <strong>{tx}</strong>
              <div className="timeline-track">
                <span
                  className={"plot-block b" + ((index % 3) + 1)}
                  style={{ left: String(index * 5) + "%", width: String(35 + index * 7) + "%" }}
                >
                  {index === 0 ? "Jordan → Sam" : index === 1 ? "Taylor" : index === 2 ? "Alex → Ensemble" : "Morgan"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  if (tab === "Compare") {
    return (
      <>
        <div className="compare-grid">
          <div className="compare-card">
            <span>Current plot</span>
            <strong>9 TX · 14 swaps</strong>
            <p>2 non-interval swaps · peak simultaneous swaps 2</p>
          </div>
          <div className="compare-card">
            <span>Reference plot</span>
            <strong>9 TX · 16 swaps</strong>
            <p>4 non-interval swaps · peak simultaneous swaps 3</p>
          </div>
        </div>
        <DataList rows={rows} />
      </>
    );
  }

  return <DataList rows={rows} />;
}

export function WorkspaceShell({
  previewMode,
  workspaceName = "Northstar Sound",
  productions = [
    { id: "demo", name: "Demonstration Show", isTemplate: false },
    { id: "template", name: "Spring Musical Template", isTemplate: true },
  ],
  compact = false,
}: {
  previewMode: boolean;
  workspaceName?: string;
  productions?: Array<{ id: string; name: string; isTemplate: boolean }>;
  compact?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("Show");
  const subtitle = useMemo(() => {
    const labels: Record<Tab, string> = {
      Show: "Script structure and production metadata",
      Characters: "Roles, mic priorities, quality, and casting",
      Cast: "Actors, mic preferences, projection, range, and belt requirements",
      Understudies: "Principal and consequential cover changes",
      Movements: "Stage presence, entrances, exits, cues, and notes",
      Groups: "Transmitter sharing groups and allocation controls",
      MicPlot: "Current transmitter assignment timeline",
      Compare: "Compare current and reference micplots",
    };
    return labels[tab];
  }, [tab]);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <span className="brand-mark">MP</span>
          <div>
            <strong>MicPlotter</strong>
            <small>Collaborative mic planning</small>
          </div>
        </div>

        <div className="workspace-card">
          <small>Workspace</small>
          <strong>{workspaceName}</strong>
          <span>Sound design team</span>
        </div>

        <nav className="production-nav">
          <div className="nav-label">Productions</div>
          <div className="production-list">
            {productions.map((production, index) => (
              <Link
                className={index === 0 ? "production-link active" : "production-link"}
                key={production.id}
                href={production.id === "demo" || production.id === "template" ? "#" : "/app/productions/" + production.id}
                title={production.name}
              >
                <span className={production.isTemplate ? "production-dot muted" : "production-dot"} />
                <span className="production-link-copy">
                  <strong>{production.name}</strong>
                  <small>{production.isTemplate ? "Template" : "Production"}</small>
                </span>
                <span className="production-chevron">›</span>
              </Link>
            ))}
          </div>
          <button className="new-production">+ New production</button>
          <Link className="import-mpl-link" href="/app/import">
            <span>↑</span>
            Import .mpl file
          </Link>
        </nav>

        <div className="sidebar-footer">
          <button>Templates</button>
          <button>Workspace members</button>
          <button>Settings</button>
        </div>
      </aside>

      <section className={compact ? "workspace-main compact" : "workspace-main"}>
        {previewMode ? (
          <div className="preview-banner">
            Preview mode — connect Supabase to enable accounts, saving, invitations, and collaboration.
          </div>
        ) : null}

        {!compact ? <header className="workspace-header">
          <div>
            <div className="eyebrow">Demonstration Show</div>
            <h1>{tab}</h1>
            <p>{subtitle}</p>
          </div>
          <div className="header-actions">
            <div className="collaborators" aria-label="Production collaborators">
              <span>JL</span><span>SR</span><span>TM</span>
            </div>
            <button className="secondary-button small">Share</button>
            <button className="primary-button small">Save</button>
          </div>
        </header> : null}

        {!compact ? <div className="tabs" role="tablist" aria-label="MicPlot production sections">
          {tabs.map((item) => (
            <button
              key={item}
              className={item === tab ? "tab active" : "tab"}
              onClick={() => setTab(item)}
              role="tab"
              aria-selected={item === tab}
            >
              {item}
            </button>
          ))}
        </div> : null}

        {!compact ? <section className="work-panel">
          <div className="panel-toolbar">
            <div className="search-box">Search {tab.toLowerCase()}…</div>
            <div className="toolbar-buttons">
              <button>Sort</button>
              <button>Duplicate</button>
              <button>More ···</button>
            </div>
          </div>
          <TabPanel tab={tab} />
        </section> : null}
      </section>
    </main>
  );
}
