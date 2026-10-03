"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ALLOCATION_RULE_LABELS,
  DEFAULT_ALLOCATION_RULES,
  type AllocationEffort,
  type AllocationRule,
  type AllocationType,
  type OrderedAllocationRule,
  type TransmitterCountMode,
} from "@/lib/allocator/types";
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
  updateSwapSettings,
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

interface AllocationPreview {
  transmitterCount: number;
  groups: Array<{ id: string; members: string[] }>;
  metrics: {
    transmitters: number;
    totalSwaps: number;
    fastSwaps: number[];
    nonIntervalSwaps: number;
    peakSimultaneousSwaps: number;
    refits: number;
    spareUnavailablePages: number;
    micColourMismatches: number;
    micQualityMismatches: number;
    projectionMismatches: number;
    vocalRangeMismatches: number;
    beltSizeMismatches: number;
    unmikedNicePages: number;
    changedAssignments?: number;
  };
  fastSwapProfile: string;
  swaps: Array<{
    groupId: string;
    fromCastMemberId: string;
    toCastMemberId: string;
    fromPage: number;
    toPage: number;
    availablePages: number;
    minimumPages: number;
    isInterval: boolean;
  }>;
  committed: boolean;
}

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
  swapSettings: {
    handheld_swap_pages: number;
    bodypack_mode: string;
    bodypack_swap_pages: number;
    lapel_boom_compatible: boolean;
    lapel_mic_swap_pages: number;
    boom_mic_swap_pages: number;
  };
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
  const router = useRouter();
  const {
    production,
    tab,
    pages,
    cast,
    characters,
    movements,
    movementCharacters,
    groups,
    swapSettings,
  } = props;

  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [selectedCastId, setSelectedCastId] = useState<string | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [selectedMovementId, setSelectedMovementId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [allocationOpen, setAllocationOpen] = useState(false);
  const [swapTimesOpen, setSwapTimesOpen] = useState(false);
  const [allocationRunning, setAllocationRunning] = useState(false);
  const [allocationError, setAllocationError] = useState<string | null>(null);
  const [allocationResult, setAllocationResult] = useState<AllocationPreview | null>(null);
  const [allocationType, setAllocationType] = useState<AllocationType>("new");
  const [allocationEffort, setAllocationEffort] = useState<AllocationEffort>("normal");
  const [transmitterCountMode, setTransmitterCountMode] =
    useState<TransmitterCountMode>("auto");
  const [manualTransmitterCount, setManualTransmitterCount] = useState(
    Math.max(groups.length, 1),
  );
  const [allocationRules, setAllocationRules] = useState<OrderedAllocationRule[]>(
    () => DEFAULT_ALLOCATION_RULES.map((rule) => ({ ...rule })),
  );


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

  function resetAllocationDialog() {
    setAllocationResult(null);
    setAllocationError(null);
    const nextType: AllocationType = groups.length ? "update" : "new";
    setAllocationType(nextType);
    setTransmitterCountMode(nextType === "update" ? "manual" : "auto");
    setManualTransmitterCount(Math.max(groups.length, 1));
    setAllocationOpen(true);
  }

  function toggleAllocationRule(rule: AllocationRule) {
    setAllocationRules((current) =>
      current.map((item) =>
        item.rule === rule ? { ...item, enabled: !item.enabled } : item,
      ),
    );
    setAllocationResult(null);
  }

  function moveAllocationRule(index: number, direction: -1 | 1) {
    setAllocationRules((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
    setAllocationResult(null);
  }

  async function runAllocation(commit: boolean) {
    setAllocationRunning(true);
    setAllocationError(null);

    try {
      const response = await fetch("/api/allocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productionId: production.id,
          type: allocationType,
          effort: allocationEffort,
          transmitterCountMode,
          manualTransmitterCount:
            transmitterCountMode === "manual" ? manualTransmitterCount : undefined,
          rules: allocationRules,
          commit,
        }),
      });

      const data = (await response.json()) as AllocationPreview & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Allocation failed.");
      }

      setAllocationResult(data);

      if (commit) {
        setAllocationOpen(false);
        setSelectedGroupId(null);
        router.refresh();
      }
    } catch (error) {
      setAllocationError(
        error instanceof Error ? error.message : "Allocation failed.",
      );
    } finally {
      setAllocationRunning(false);
    }
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
                  <button
                    type="button"
                    className="secondary-button small"
                    onClick={() => setSwapTimesOpen(true)}
                  >
                    Swap Times
                  </button>
                  <button
                    type="button"
                    className="primary-button small"
                    onClick={resetAllocationDialog}
                  >
                    Auto Allocate
                  </button>
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

      {swapTimesOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section className="swap-times-modal" role="dialog" aria-modal="true" aria-labelledby="swap-times-title">
            <header className="modal-header">
              <div>
                <div className="eyebrow">Groups</div>
                <h2 id="swap-times-title">Swap Times</h2>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setSwapTimesOpen(false)}
                aria-label="Close swap times form"
              >
                ×
              </button>
            </header>

            <form action={updateSwapSettings} className="swap-times-form">
              <input type="hidden" name="productionId" value={production.id} />

              <div className="swap-times-section">
                <h3>Hand-held</h3>
                <FormField label="Minimum swap time (pages)">
                  <input
                    name="handheldSwapPages"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue={swapSettings.handheld_swap_pages}
                  />
                </FormField>
              </div>

              <div className="swap-times-section">
                <h3>Bodypack</h3>
                <FormField label="Mic handling">
                  <select name="bodypackMode" defaultValue={swapSettings.bodypack_mode}>
                    <option value="one_mic_per_cast">One mic per cast member</option>
                    <option value="one_mic_per_pack">One mic per transmitter / pack</option>
                  </select>
                </FormField>

                <FormField label="Minimum bodypack swap time (pages)">
                  <input
                    name="bodypackSwapPages"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue={swapSettings.bodypack_swap_pages}
                  />
                </FormField>

                <label className="check-label">
                  <input
                    name="lapelBoomCompatible"
                    type="checkbox"
                    defaultChecked={swapSettings.lapel_boom_compatible}
                  />
                  Lapel and boom mics are compatible for sharing
                </label>

                <div className="form-grid-2">
                  <FormField label="Lapel mic swap time">
                    <input
                      name="lapelMicSwapPages"
                      type="number"
                      min="0"
                      step="1"
                      defaultValue={swapSettings.lapel_mic_swap_pages}
                    />
                  </FormField>
                  <FormField label="Boom mic swap time">
                    <input
                      name="boomMicSwapPages"
                      type="number"
                      min="0"
                      step="1"
                      defaultValue={swapSettings.boom_mic_swap_pages}
                    />
                  </FormField>
                </div>
              </div>

              <footer className="modal-footer">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setSwapTimesOpen(false)}
                >
                  Cancel
                </button>
                <button className="primary-button">Save</button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}

      {allocationOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section className="allocation-modal" role="dialog" aria-modal="true" aria-labelledby="allocation-title">
            <header className="modal-header">
              <div>
                <div className="eyebrow">Groups</div>
                <h2 id="allocation-title">Auto Group Allocation</h2>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setAllocationOpen(false)}
                aria-label="Close allocation form"
              >
                ×
              </button>
            </header>

            <div className="allocation-layout">
              <div className="allocation-settings">
                <div className="allocation-section">
                  <h3>Allocation type</h3>
                  <div className="segmented-control">
                    {(["new", "finish", "update"] as AllocationType[]).map((value) => (
                      <button
                        type="button"
                        key={value}
                        className={allocationType === value ? "selected" : ""}
                        onClick={() => {
                          setAllocationType(value);
                          if (value === "update" && groups.length) {
                            setTransmitterCountMode("manual");
                            setManualTransmitterCount(groups.length);
                          }
                          setAllocationResult(null);
                        }}
                      >
                        {value[0].toUpperCase() + value.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="allocation-section">
                  <h3>Number of transmitters</h3>
                  <div className="mode-row">
                    <label>
                      <input
                        type="radio"
                        checked={transmitterCountMode === "auto"}
                        onChange={() => {
                          setTransmitterCountMode("auto");
                          setAllocationResult(null);
                        }}
                      />
                      Auto
                    </label>
                    <label>
                      <input
                        type="radio"
                        checked={transmitterCountMode === "manual"}
                        onChange={() => {
                          setTransmitterCountMode("manual");
                          setAllocationResult(null);
                        }}
                      />
                      Manual
                    </label>
                    <input
                      className="tx-count-input"
                      type="number"
                      min="0"
                      step="1"
                      value={manualTransmitterCount}
                      disabled={transmitterCountMode !== "manual"}
                      onChange={(event) => {
                        setManualTransmitterCount(Number(event.target.value));
                        setAllocationResult(null);
                      }}
                      aria-label="Manual transmitter count"
                    />
                  </div>
                </div>

                <div className="allocation-section">
                  <h3>Effort</h3>
                  <div className="segmented-control">
                    {(["rough", "normal", "thorough"] as AllocationEffort[]).map((value) => (
                      <button
                        type="button"
                        key={value}
                        className={allocationEffort === value ? "selected" : ""}
                        onClick={() => {
                          setAllocationEffort(value);
                          setAllocationResult(null);
                        }}
                      >
                        {value[0].toUpperCase() + value.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="allocation-section">
                  <div className="section-title-row">
                    <h3>Rules</h3>
                    <span>Applied top to bottom</span>
                  </div>
                  <div className="allocation-rules">
                    {allocationRules.map((rule, index) => {
                      const forcedOff =
                        transmitterCountMode === "manual" &&
                        rule.rule === "min_transmitters";
                      return (
                        <div className="allocation-rule" key={rule.rule}>
                          <span className="rule-order">{index + 1}</span>
                          <label>
                            <input
                              type="checkbox"
                              checked={rule.enabled && !forcedOff}
                              disabled={forcedOff}
                              onChange={() => toggleAllocationRule(rule.rule)}
                            />
                            <span>{ALLOCATION_RULE_LABELS[rule.rule]}</span>
                          </label>
                          <div className="rule-move-buttons">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => moveAllocationRule(index, -1)}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              disabled={index === allocationRules.length - 1}
                              onClick={() => moveAllocationRule(index, 1)}
                            >
                              ↓
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="allocation-results">
                <div className="section-title-row">
                  <h3>Results</h3>
                  {allocationResult ? <span>Preview — not yet applied</span> : null}
                </div>

                {allocationError ? (
                  <div className="allocation-error">{allocationError}</div>
                ) : null}

                {!allocationResult && !allocationError ? (
                  <div className="allocation-placeholder">
                    Run the allocation to calculate transmitter groups and swap metrics.
                  </div>
                ) : null}

                {allocationResult ? (
                  <>
                    <div className="allocation-metrics">
                      <div><span>Transmitters</span><strong>{allocationResult.metrics.transmitters}</strong></div>
                      <div><span>Total swaps</span><strong>{allocationResult.metrics.totalSwaps}</strong></div>
                      <div><span>Fast swaps</span><strong>{allocationResult.fastSwapProfile}</strong></div>
                      <div><span>Non-interval</span><strong>{allocationResult.metrics.nonIntervalSwaps}</strong></div>
                      <div><span>Peak simultaneous</span><strong>{allocationResult.metrics.peakSimultaneousSwaps}</strong></div>
                      <div><span>Refits</span><strong>{allocationResult.metrics.refits}</strong></div>
                      {allocationType === "update" ? (
                        <div><span>Actors changed</span><strong>{allocationResult.metrics.changedAssignments ?? 0}</strong></div>
                      ) : null}
                    </div>

                    <div className="allocation-group-preview">
                      {allocationResult.groups.map((group) => (
                        <div key={group.id} className="allocation-group-row">
                          <strong>{group.id}</strong>
                          <span>
                            {group.members.length
                              ? group.members
                                  .map((memberId) => castById.get(memberId) ?? "Unknown actor")
                                  .join(" → ")
                              : "Spare / unused"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            </div>

            <footer className="modal-footer">
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setAllocationRules(DEFAULT_ALLOCATION_RULES.map((rule) => ({ ...rule })));
                  setAllocationResult(null);
                  setAllocationError(null);
                }}
                disabled={allocationRunning}
              >
                Default
              </button>
              <span className="modal-footer-spacer" />
              <button
                type="button"
                className="secondary-button"
                onClick={() => setAllocationOpen(false)}
                disabled={allocationRunning}
              >
                Cancel
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => void runAllocation(false)}
                disabled={allocationRunning}
              >
                {allocationRunning ? "Calculating…" : "Allocate"}
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => void runAllocation(true)}
                disabled={allocationRunning || !allocationResult}
              >
                Apply
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </main>
  );
}
