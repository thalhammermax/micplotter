"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  addCastMember,
  addCharacter,
  addMovement,
  addShowPage,
  addTransmitterGroup,
  deleteCastMember,
  deleteCharacter,
  deleteMovement,
  deleteShowPage,
  deleteTransmitterGroup,
  updateCastMember,
  updateCharacter,
  updateMovement,
  updateShowPage,
  updateTransmitterGroup,
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
    ensemble_priority: string;
    when_miked: string;
    mic_style: string | null;
    mic_colour: string | null;
    belt_size: string | null;
    projection: string | null;
    vocal_range: string | null;
  }>;
  characters: Array<{
    id: string;
    name: string;
    abbreviation: string | null;
    mic_priority: string;
    mic_quality: number | null;
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

const micPriorityOptions = [
  ["must", "Must Mic"],
  ["nice", "Nice To Mic"],
  ["dont", "Don’t Mic"],
  ["variable_must", "Variable (Must)"],
  ["variable_nice", "Variable (Nice)"],
  ["variable_dont", "Variable (Don’t)"],
] as const;

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

function HiddenIds({
  productionId,
  id,
}: {
  productionId: string;
  id?: string;
}) {
  return (
    <>
      <input type="hidden" name="productionId" value={productionId} />
      {id ? <input type="hidden" name="id" value={id} /> : null}
    </>
  );
}

function DeleteButton({
  action,
  label,
}: {
  action: (formData: FormData) => void | Promise<void>;
  label: string;
}) {
  return (
    <button className="danger-button small" formAction={action}>
      {label}
    </button>
  );
}

export function ProductionEditor(props: ProductionEditorProps) {
  const {
    production,
    tab,
    pages,
    cast,
    characters,
    movements,
    movementCharacters,
    groups,
  } = props;

  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [selectedCastId, setSelectedCastId] = useState<string | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [selectedMovementId, setSelectedMovementId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const selectedPage = pages.find((item) => item.id === selectedPageId) ?? null;
  const selectedCast = cast.find((item) => item.id === selectedCastId) ?? null;
  const selectedCharacter =
    characters.find((item) => item.id === selectedCharacterId) ?? null;
  const selectedMovement =
    movements.find((item) => item.id === selectedMovementId) ?? null;
  const selectedGroup = groups.find((item) => item.id === selectedGroupId) ?? null;

  const castById = new Map(cast.map((member) => [member.id, member.name]));
  const pageById = new Map(
    pages.map((page) => [
      page.id,
      [page.act, page.scene, page.page_label].filter(Boolean).join(" · "),
    ]),
  );

  const onStageByMovement = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const row of movementCharacters) {
      const set = map.get(row.movement_id) ?? new Set<string>();
      set.add(row.character_id);
      map.set(row.movement_id, set);
    }
    return map;
  }, [movementCharacters]);

  const selectedMovementOnStage = selectedMovement
    ? onStageByMovement.get(selectedMovement.id) ?? new Set<string>()
    : new Set<string>();

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
              <div className="card-heading-row">
                <h2>Script pages</h2>
                <button className="secondary-button small" onClick={() => setSelectedPageId(null)}>
                  Add
                </button>
              </div>
              {pages.length ? pages.map((page, index) => (
                <button
                  type="button"
                  className={selectedPageId === page.id ? "editor-row selectable selected" : "editor-row selectable"}
                  key={page.id}
                  onClick={() => setSelectedPageId(page.id)}
                >
                  <span className="row-number">{String(index + 1).padStart(2, "0")}</span>
                  <span>
                    <strong>
                      {page.is_interval
                        ? "Interval"
                        : [page.act, page.scene, page.page_label].filter(Boolean).join(" · ") || "Untitled page"}
                    </strong>
                    <small>{page.comment || "No comment"}</small>
                  </span>
                  <span className="row-edit">Edit</span>
                </button>
              )) : <EmptyState>Add at least one script page to begin.</EmptyState>}
            </div>

            <form
              key={selectedPage?.id ?? "new-page"}
              action={selectedPage ? updateShowPage : addShowPage}
              className="editor-form-card"
            >
              <HiddenIds productionId={production.id} id={selectedPage?.id} />
              <h2>{selectedPage ? "Edit page" : "Add page"}</h2>
              <div className="form-grid-3">
                <FormField label="Act"><input name="act" defaultValue={selectedPage?.act ?? ""} /></FormField>
                <FormField label="Scene"><input name="scene" defaultValue={selectedPage?.scene ?? ""} /></FormField>
                <FormField label="Page"><input name="pageLabel" defaultValue={selectedPage?.page_label ?? ""} /></FormField>
              </div>
              <FormField label="Comment / song title"><input name="comment" defaultValue={selectedPage?.comment ?? ""} /></FormField>
              <label className="check-label">
                <input type="checkbox" name="isInterval" defaultChecked={selectedPage?.is_interval ?? false} />
                Interval / intermission
              </label>
              <div className="form-actions">
                <button className="primary-button">{selectedPage ? "Save changes" : "Add page"}</button>
                {selectedPage ? (
                  <DeleteButton
                    action={deleteShowPage}
                    label="Delete"
                  />
                ) : null}
              </div>
            </form>
          </div>
        ) : null}

        {tab === "cast" ? (
          <div className="editor-grid">
            <div className="editor-list-card">
              <div className="card-heading-row">
                <h2>Cast</h2>
                <button className="secondary-button small" onClick={() => setSelectedCastId(null)}>
                  Add
                </button>
              </div>
              {cast.length ? cast.map((member, index) => (
                <button
                  type="button"
                  className={selectedCastId === member.id ? "editor-row selectable selected" : "editor-row selectable"}
                  key={member.id}
                  onClick={() => setSelectedCastId(member.id)}
                >
                  <span className="row-number">{String(index + 1).padStart(2, "0")}</span>
                  <span>
                    <strong>{member.name}</strong>
                    <small>
                      {[member.abbreviation, member.when_miked, member.mic_style]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </span>
                  <span className="row-edit">Edit</span>
                </button>
              )) : <EmptyState>Add the actors in this production.</EmptyState>}
            </div>

            <form
              key={selectedCast?.id ?? "new-cast"}
              action={selectedCast ? updateCastMember : addCastMember}
              className="editor-form-card"
            >
              <HiddenIds productionId={production.id} id={selectedCast?.id} />
              <h2>{selectedCast ? "Edit actor" : "Add actor"}</h2>
              <FormField label="Name"><input name="name" defaultValue={selectedCast?.name ?? ""} required /></FormField>
              <FormField label="Abbreviation"><input name="abbreviation" defaultValue={selectedCast?.abbreviation ?? ""} /></FormField>
              <FormField label="When miked">
                <select name="whenMiked" defaultValue={selectedCast?.when_miked ?? "normal"}>
                  <option value="normal">Normal</option>
                  <option value="never">Never</option>
                  <option value="always">Always</option>
                  <option value="first_to_last">First To Last</option>
                  <option value="start_to_last">Start To Last</option>
                  <option value="first_to_end">First To End</option>
                </select>
              </FormField>
              <FormField label="Mic style">
                <select name="micStyle" defaultValue={selectedCast?.mic_style ?? ""}>
                  <option value="">Unspecified</option>
                  <option value="lapel">Lapel</option>
                  <option value="boom">Boom</option>
                  <option value="handheld">Hand-held</option>
                  <option value="other">Other</option>
                </select>
              </FormField>
              <div className="form-grid-2">
                <FormField label="Mic colour"><input name="micColour" defaultValue={selectedCast?.mic_colour ?? ""} /></FormField>
                <FormField label="Belt size"><input name="beltSize" defaultValue={selectedCast?.belt_size ?? ""} /></FormField>
              </div>
              <div className="form-grid-2">
                <FormField label="Projection"><input name="projection" defaultValue={selectedCast?.projection ?? ""} /></FormField>
                <FormField label="Vocal range"><input name="vocalRange" defaultValue={selectedCast?.vocal_range ?? ""} /></FormField>
              </div>
              <label className="check-label">
                <input type="checkbox" name="ensemble" defaultChecked={selectedCast?.ensemble ?? false} />
                Ensemble member
              </label>
              <FormField label="Ensemble priority">
                <select name="ensemblePriority" defaultValue={selectedCast?.ensemble_priority ?? "must"}>
                  {micPriorityOptions.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </FormField>
              <div className="form-actions">
                <button className="primary-button">{selectedCast ? "Save changes" : "Add actor"}</button>
                {selectedCast ? (
                  <DeleteButton
                    action={deleteCastMember}
                    label="Delete"
                  />
                ) : null}
              </div>
            </form>
          </div>
        ) : null}

        {tab === "characters" ? (
          <div className="editor-grid">
            <div className="editor-list-card">
              <div className="card-heading-row">
                <h2>Characters</h2>
                <button className="secondary-button small" onClick={() => setSelectedCharacterId(null)}>
                  Add
                </button>
              </div>
              {characters.length ? characters.map((character, index) => (
                <button
                  type="button"
                  className={selectedCharacterId === character.id ? "editor-row selectable selected" : "editor-row selectable"}
                  key={character.id}
                  onClick={() => setSelectedCharacterId(character.id)}
                >
                  <span className="row-number">{String(index + 1).padStart(2, "0")}</span>
                  <span>
                    <strong>{character.name}</strong>
                    <small>
                      {[character.abbreviation, character.mic_priority, character.played_by_cast_id ? castById.get(character.played_by_cast_id) : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </span>
                  <span className="row-edit">Edit</span>
                </button>
              )) : <EmptyState>Add the roles in the show.</EmptyState>}
            </div>

            <form
              key={selectedCharacter?.id ?? "new-character"}
              action={selectedCharacter ? updateCharacter : addCharacter}
              className="editor-form-card"
            >
              <HiddenIds productionId={production.id} id={selectedCharacter?.id} />
              <h2>{selectedCharacter ? "Edit character" : "Add character"}</h2>
              <FormField label="Name"><input name="name" defaultValue={selectedCharacter?.name ?? ""} required /></FormField>
              <FormField label="Abbreviation"><input name="abbreviation" defaultValue={selectedCharacter?.abbreviation ?? ""} /></FormField>
              <FormField label="Mic priority">
                <select name="micPriority" defaultValue={selectedCharacter?.mic_priority ?? "must"}>
                  {micPriorityOptions.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Played by">
                <select name="playedByCastId" defaultValue={selectedCharacter?.played_by_cast_id ?? ""}>
                  <option value="">Unassigned</option>
                  {cast.map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}
                </select>
              </FormField>
              <FormField label="Mic quality">
                <input
                  name="micQuality"
                  type="number"
                  min="0"
                  defaultValue={selectedCharacter?.mic_quality ?? ""}
                />
              </FormField>
              <div className="form-actions">
                <button className="primary-button">{selectedCharacter ? "Save changes" : "Add character"}</button>
                {selectedCharacter ? (
                  <DeleteButton
                    action={deleteCharacter}
                    label="Delete"
                  />
                ) : null}
              </div>
            </form>
          </div>
        ) : null}

        {tab === "movements" ? (
          <div className="editor-grid">
            <div className="editor-list-card">
              <div className="card-heading-row">
                <h2>Movements</h2>
                <button className="secondary-button small" onClick={() => setSelectedMovementId(null)}>
                  Add
                </button>
              </div>
              {movements.length ? movements.map((movement, index) => {
                const onStage = onStageByMovement.get(movement.id)?.size ?? 0;
                return (
                  <button
                    type="button"
                    className={selectedMovementId === movement.id ? "editor-row selectable selected" : "editor-row selectable"}
                    key={movement.id}
                    onClick={() => setSelectedMovementId(movement.id)}
                  >
                    <span className="row-number">{String(index + 1).padStart(2, "0")}</span>
                    <span>
                      <strong>{[movement.cue_id, movement.title].filter(Boolean).join(" · ") || "Untitled movement"}</strong>
                      <small>
                        {movement.page_id ? pageById.get(movement.page_id) : "No script page"}
                        {movement.cue ? " · " + movement.cue : ""}
                        {" · "}{onStage} on stage
                      </small>
                    </span>
                    <span className="row-edit">Edit</span>
                  </button>
                );
              }) : <EmptyState>Add movements after your script pages are set.</EmptyState>}
            </div>

            <form
              key={selectedMovement?.id ?? "new-movement"}
              action={selectedMovement ? updateMovement : addMovement}
              className="editor-form-card"
            >
              <HiddenIds productionId={production.id} id={selectedMovement?.id} />
              <h2>{selectedMovement ? "Edit movement" : "Add movement"}</h2>
              <div className="form-grid-2">
                <FormField label="Id"><input name="cueId" defaultValue={selectedMovement?.cue_id ?? ""} /></FormField>
                <FormField label="Title"><input name="title" defaultValue={selectedMovement?.title ?? ""} /></FormField>
              </div>
              <FormField label="Page">
                <select name="pageId" defaultValue={selectedMovement?.page_id ?? ""}>
                  <option value="">Unassigned</option>
                  {pages.map((page) => (
                    <option value={page.id} key={page.id}>
                      {[page.act, page.scene, page.page_label].filter(Boolean).join(" · ") || "Interval"}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Cue"><input name="cue" defaultValue={selectedMovement?.cue ?? ""} /></FormField>

              <fieldset className="stage-editor">
                <legend>Characters on stage</legend>
                <div className="stage-character-grid">
                  {characters.map((character) => (
                    <label key={character.id}>
                      <input
                        type="checkbox"
                        name="characterIds"
                        value={character.id}
                        defaultChecked={selectedMovementOnStage.has(character.id)}
                      />
                      <span>{character.name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="form-actions">
                <button className="primary-button">{selectedMovement ? "Save changes" : "Add movement"}</button>
                {selectedMovement ? (
                  <DeleteButton
                    action={deleteMovement}
                    label="Delete"
                  />
                ) : null}
              </div>
            </form>
          </div>
        ) : null}

        {tab === "groups" ? (
          <div className="editor-grid">
            <div className="editor-list-card">
              <div className="card-heading-row">
                <h2>Transmitters</h2>
                <div className="header-actions">
                  <button className="secondary-button small" onClick={() => setSelectedGroupId(null)}>
                    Add
                  </button>
                  <button className="primary-button small">Auto Allocate</button>
                </div>
              </div>
              {groups.length ? groups.map((group, index) => (
                <button
                  type="button"
                  className={selectedGroupId === group.id ? "editor-row selectable selected" : "editor-row selectable"}
                  key={group.id}
                  onClick={() => setSelectedGroupId(group.id)}
                >
                  <span className="row-number">{String(index + 1).padStart(2, "0")}</span>
                  <span>
                    <strong>{group.tx_name}</strong>
                    <small>{group.mic_ids.length ? "Mic IDs: " + group.mic_ids.join(", ") : "No mic IDs"}</small>
                  </span>
                  <span className="row-edit">Edit</span>
                </button>
              )) : <EmptyState>No transmitters have been allocated yet.</EmptyState>}
            </div>

            <form
              key={selectedGroup?.id ?? "new-group"}
              action={selectedGroup ? updateTransmitterGroup : addTransmitterGroup}
              className="editor-form-card"
            >
              <HiddenIds productionId={production.id} id={selectedGroup?.id} />
              <h2>{selectedGroup ? "Edit transmitter" : "Add transmitter"}</h2>
              <FormField label="TX name">
                <input name="txName" placeholder="TX_001" defaultValue={selectedGroup?.tx_name ?? ""} required />
              </FormField>
              <FormField label="Mic IDs">
                <input name="micIds" placeholder="A, B, C" defaultValue={selectedGroup?.mic_ids.join(", ") ?? ""} />
              </FormField>
              <div className="form-actions">
                <button className="primary-button">{selectedGroup ? "Save changes" : "Add transmitter"}</button>
                {selectedGroup ? (
                  <DeleteButton
                    action={deleteTransmitterGroup}
                    label="Delete"
                  />
                ) : null}
              </div>
            </form>
          </div>
        ) : null}

        {tab === "understudies" ? (
          <EmptyState>
            Understudy editing is next; the existing schema already supports principal and consequential changes.
          </EmptyState>
        ) : null}

        {tab === "micplot" ? (
          <EmptyState>
            The MicPlot timeline will render from the movement states and transmitter groups.
          </EmptyState>
        ) : null}

        {tab === "compare" ? (
          <EmptyState>
            Reference MicPlots will be compared here using the original compatible-page/interval rules.
          </EmptyState>
        ) : null}
      </section>
    </main>
  );
}
