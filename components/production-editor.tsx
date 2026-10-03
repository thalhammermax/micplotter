"use client";

import Link from "next/link";
import {
  addCastMember,
  addCharacter,
  addMovement,
  addShowPage,
  addTransmitterGroup,
} from "@/app/app/productions/[productionId]/actions";

type TabName =
  | "show"
  | "characters"
  | "cast"
  | "understudies"
  | "movements"
  | "groups"
  | "micplot"
  | "compare";

interface ProductionEditorProps {
  production: {
    id: string;
    name: string;
    production_company: string | null;
    production_date: string | null;
    notes: string | null;
  };
  tab: TabName;
  pages: Array<{
    id: string;
    act: string | null;
    scene: string | null;
    page_label: string | null;
    is_interval: boolean;
    comment: string | null;
  }>;
  cast: Array<{
    id: string;
    name: string;
    abbreviation: string | null;
    ensemble: boolean;
    when_miked: string;
    mic_style: string | null;
  }>;
  characters: Array<{
    id: string;
    name: string;
    abbreviation: string | null;
    mic_priority: string;
    played_by_cast_id: string | null;
  }>;
  movements: Array<{
    id: string;
    cue_id: string | null;
    title: string | null;
    page_id: string | null;
    cue: string | null;
  }>;
  movementCharacters: Array<{
    movement_id: string;
    character_id: string;
    priority_override: string | null;
  }>;
  groups: Array<{
    id: string;
    tx_name: string;
    mic_ids: string[];
  }>;
}

const tabs: Array<{ key: TabName; label: string }> = [
  { key: "show", label: "Show" },
  { key: "characters", label: "Characters" },
  { key: "cast", label: "Cast" },
  { key: "understudies", label: "Understudies" },
  { key: "movements", label: "Movements" },
  { key: "groups", label: "Groups" },
  { key: "micplot", label: "MicPlot" },
  { key: "compare", label: "Compare" },
];

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="editor-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="editor-empty">{children}</div>;
}

export function ProductionEditor(props: ProductionEditorProps) {
  const { production, tab, pages, cast, characters, movements, movementCharacters, groups } = props;
  const castById = new Map(cast.map((member) => [member.id, member.name]));
  const pageById = new Map(
    pages.map((page) => [
      page.id,
      [page.act, page.scene, page.page_label].filter(Boolean).join(" · "),
    ]),
  );
  const onStageCountByMovement = new Map<string, number>();
  for (const row of movementCharacters) {
    onStageCountByMovement.set(
      row.movement_id,
      (onStageCountByMovement.get(row.movement_id) ?? 0) + 1,
    );
  }

  return (
    <main className="production-editor">
      <header className="editor-header">
        <div>
          <Link href="/app" className="back-link">← Productions</Link>
          <div className="eyebrow">Production</div>
          <h1>{production.name}</h1>
          <p>
            {[production.production_company, production.production_date]
              .filter(Boolean)
              .join(" · ") || "MicPlotter production"}
          </p>
        </div>
        <div className="header-actions">
          <button className="secondary-button small">Share</button>
          <button className="primary-button small">Export</button>
        </div>
      </header>

      <nav className="tabs">
        {tabs.map((item) => (
          <Link
            key={item.key}
            href={"/app/productions/" + production.id + "?tab=" + item.key}
            className={item.key === tab ? "tab active" : "tab"}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <section className="editor-body">
        {tab === "show" ? (
          <div className="editor-grid">
            <div className="editor-list-card">
              <h2>Script pages</h2>
              {pages.length ? pages.map((page, index) => (
                <div className="editor-row" key={page.id}>
                  <span className="row-number">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>
                      {page.is_interval
                        ? "Interval"
                        : [page.act, page.scene, page.page_label].filter(Boolean).join(" · ") || "Untitled page"}
                    </strong>
                    <small>{page.comment || "No comment"}</small>
                  </div>
                  {page.is_interval ? <span className="row-status">Interval</span> : null}
                </div>
              )) : <EmptyState>Add at least one script page to begin.</EmptyState>}
            </div>
            <form action={addShowPage} className="editor-form-card">
              <input type="hidden" name="productionId" value={production.id} />
              <h2>Add page</h2>
              <div className="form-grid-3">
                <FormField label="Act"><input name="act" /></FormField>
                <FormField label="Scene"><input name="scene" /></FormField>
                <FormField label="Page"><input name="pageLabel" /></FormField>
              </div>
              <FormField label="Comment / song title"><input name="comment" /></FormField>
              <label className="check-label"><input type="checkbox" name="isInterval" /> Interval / intermission</label>
              <button className="primary-button">Add page</button>
            </form>
          </div>
        ) : null}

        {tab === "cast" ? (
          <div className="editor-grid">
            <div className="editor-list-card">
              <h2>Cast</h2>
              {cast.length ? cast.map((member, index) => (
                <div className="editor-row" key={member.id}>
                  <span className="row-number">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{member.name}</strong>
                    <small>
                      {[member.abbreviation, member.when_miked, member.mic_style]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </div>
                  {member.ensemble ? <span className="row-status">Ensemble</span> : null}
                </div>
              )) : <EmptyState>Add the actors in this production.</EmptyState>}
            </div>
            <form action={addCastMember} className="editor-form-card">
              <input type="hidden" name="productionId" value={production.id} />
              <h2>Add actor</h2>
              <FormField label="Name"><input name="name" required /></FormField>
              <FormField label="Abbreviation"><input name="abbreviation" /></FormField>
              <FormField label="When miked">
                <select name="whenMiked" defaultValue="normal">
                  <option value="normal">Normal</option>
                  <option value="never">Never</option>
                  <option value="always">Always</option>
                  <option value="first_to_last">First To Last</option>
                  <option value="start_to_last">Start To Last</option>
                  <option value="first_to_end">First To End</option>
                </select>
              </FormField>
              <FormField label="Mic style">
                <select name="micStyle" defaultValue="">
                  <option value="">Unspecified</option>
                  <option value="lapel">Lapel</option>
                  <option value="boom">Boom</option>
                  <option value="handheld">Hand-held</option>
                  <option value="other">Other</option>
                </select>
              </FormField>
              <div className="form-grid-2">
                <FormField label="Mic colour"><input name="micColour" /></FormField>
                <FormField label="Belt size"><input name="beltSize" /></FormField>
              </div>
              <div className="form-grid-2">
                <FormField label="Projection"><input name="projection" /></FormField>
                <FormField label="Vocal range"><input name="vocalRange" /></FormField>
              </div>
              <label className="check-label"><input type="checkbox" name="ensemble" /> Ensemble member</label>
              <FormField label="Ensemble priority">
                <select name="ensemblePriority" defaultValue="must">
                  <option value="must">Must Mic</option>
                  <option value="nice">Nice To Mic</option>
                  <option value="dont">Don’t Mic</option>
                  <option value="variable_must">Variable (Must)</option>
                  <option value="variable_nice">Variable (Nice)</option>
                  <option value="variable_dont">Variable (Don’t)</option>
                </select>
              </FormField>
              <button className="primary-button">Add actor</button>
            </form>
          </div>
        ) : null}

        {tab === "characters" ? (
          <div className="editor-grid">
            <div className="editor-list-card">
              <h2>Characters</h2>
              {characters.length ? characters.map((character, index) => (
                <div className="editor-row" key={character.id}>
                  <span className="row-number">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{character.name}</strong>
                    <small>
                      {[character.abbreviation, character.mic_priority, character.played_by_cast_id ? castById.get(character.played_by_cast_id) : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </div>
                </div>
              )) : <EmptyState>Add the roles in the show.</EmptyState>}
            </div>
            <form action={addCharacter} className="editor-form-card">
              <input type="hidden" name="productionId" value={production.id} />
              <h2>Add character</h2>
              <FormField label="Name"><input name="name" required /></FormField>
              <FormField label="Abbreviation"><input name="abbreviation" /></FormField>
              <FormField label="Mic priority">
                <select name="micPriority" defaultValue="must">
                  <option value="must">Must Mic</option>
                  <option value="nice">Nice To Mic</option>
                  <option value="dont">Don’t Mic</option>
                  <option value="variable_must">Variable (Must)</option>
                  <option value="variable_nice">Variable (Nice)</option>
                  <option value="variable_dont">Variable (Don’t)</option>
                </select>
              </FormField>
              <FormField label="Played by">
                <select name="playedByCastId" defaultValue="">
                  <option value="">Unassigned</option>
                  {cast.map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}
                </select>
              </FormField>
              <FormField label="Mic quality"><input name="micQuality" type="number" min="0" /></FormField>
              <button className="primary-button">Add character</button>
            </form>
          </div>
        ) : null}

        {tab === "movements" ? (
          <div className="editor-grid">
            <div className="editor-list-card">
              <h2>Movements</h2>
              {movements.length ? movements.map((movement, index) => (
                <div className="editor-row" key={movement.id}>
                  <span className="row-number">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{[movement.cue_id, movement.title].filter(Boolean).join(" · ") || "Untitled movement"}</strong>
                    <small>{movement.page_id ? pageById.get(movement.page_id) : "No script page"}{movement.cue ? " · " + movement.cue : ""} · {onStageCountByMovement.get(movement.id) ?? 0} on stage</small>
                  </div>
                </div>
              )) : <EmptyState>Add movements after your script pages are set.</EmptyState>}
            </div>
            <form action={addMovement} className="editor-form-card">
              <input type="hidden" name="productionId" value={production.id} />
              <h2>Add movement</h2>
              <div className="form-grid-2">
                <FormField label="Cue ID"><input name="cueId" /></FormField>
                <FormField label="Title"><input name="title" /></FormField>
              </div>
              <FormField label="Script page">
                <select name="pageId" defaultValue="">
                  <option value="">Unassigned</option>
                  {pages.map((page) => (
                    <option value={page.id} key={page.id}>
                      {[page.act, page.scene, page.page_label].filter(Boolean).join(" · ") || "Interval"}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Cue"><input name="cue" /></FormField>
              <button className="primary-button">Add movement</button>
            </form>
          </div>
        ) : null}

        {tab === "groups" ? (
          <div className="editor-grid">
            <div className="editor-list-card">
              <div className="card-heading-row">
                <h2>Transmitters</h2>
                <button className="primary-button small">Auto allocate</button>
              </div>
              {groups.length ? groups.map((group, index) => (
                <div className="editor-row" key={group.id}>
                  <span className="row-number">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{group.tx_name}</strong>
                    <small>{group.mic_ids.length ? "Mic IDs: " + group.mic_ids.join(", ") : "No mic IDs"}</small>
                  </div>
                </div>
              )) : <EmptyState>No transmitters have been allocated yet.</EmptyState>}
            </div>
            <form action={addTransmitterGroup} className="editor-form-card">
              <input type="hidden" name="productionId" value={production.id} />
              <h2>Add transmitter</h2>
              <FormField label="TX name"><input name="txName" placeholder="TX_001" required /></FormField>
              <FormField label="Mic IDs"><input name="micIds" placeholder="A, B, C" /></FormField>
              <button className="primary-button">Add transmitter</button>
            </form>
          </div>
        ) : null}

        {tab === "understudies" ? (
          <EmptyState>
            Understudy substitutions will use the original MicPlot principal/consequential change model.
            The schema is already in place; the editor is next.
          </EmptyState>
        ) : null}

        {tab === "micplot" ? (
          <EmptyState>
            Once movement stage states and group membership are entered, this tab will render the live
            transmitter timeline and conflict indicators.
          </EmptyState>
        ) : null}

        {tab === "compare" ? (
          <EmptyState>
            Saved micplots will be selectable as references here. Compatibility will require matching
            production timing/interval structure, preserving the original comparison concept.
          </EmptyState>
        ) : null}
      </section>
    </main>
  );
}
