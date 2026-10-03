import type {
  AllocationGroup,
  CastRequirement,
  ConflictGraph,
  GroupingResult,
} from "./model";

function pairKey(a: string, b: string) {
  return a < b ? a + "|" + b : b + "|" + a;
}

export function buildConflictGraph(requirements: CastRequirement[]): ConflictGraph {
  const hard = new Map<string, Set<string>>();
  const soft = new Map<string, Set<string>>();
  const vertices = requirements.map((requirement) => requirement.castMemberId);

  for (const vertex of vertices) {
    hard.set(vertex, new Set());
    soft.set(vertex, new Set());
  }

  const byId = new Map(requirements.map((requirement) => [requirement.castMemberId, requirement]));
  const seenHard = new Set<string>();
  const seenSoft = new Set<string>();

  for (let i = 0; i < vertices.length; i += 1) {
    for (let j = i + 1; j < vertices.length; j += 1) {
      const aId = vertices[i];
      const bId = vertices[j];
      const a = byId.get(aId)!;
      const b = byId.get(bId)!;
      const frames = Math.max(a.movementNeeds.length, b.movementNeeds.length);

      let major = false;
      let minor = false;

      for (let frame = 0; frame < frames; frame += 1) {
        const aNeed = a.movementNeeds[frame] ?? "dont";
        const bNeed = b.movementNeeds[frame] ?? "dont";

        if (aNeed === "must" && bNeed === "must") {
          major = true;
          break;
        }

        if (
          aNeed !== "dont" &&
          bNeed !== "dont" &&
          (aNeed === "nice" || bNeed === "nice")
        ) {
          minor = true;
        }
      }

      const key = pairKey(aId, bId);
      if (major && !seenHard.has(key)) {
        hard.get(aId)!.add(bId);
        hard.get(bId)!.add(aId);
        seenHard.add(key);
      } else if (minor && !seenSoft.has(key)) {
        soft.get(aId)!.add(bId);
        soft.get(bId)!.add(aId);
        seenSoft.add(key);
      }
    }
  }

  return { vertices, hard, soft };
}

function saturation(vertex: string, colors: Map<string, number>, graph: ConflictGraph) {
  const neighborColors = new Set<number>();
  for (const neighbor of graph.hard.get(vertex) ?? []) {
    const color = colors.get(neighbor);
    if (color !== undefined) neighborColors.add(color);
  }
  return neighborColors.size;
}

function chooseNextVertex(colors: Map<string, number>, graph: ConflictGraph) {
  const uncolored = graph.vertices.filter((vertex) => !colors.has(vertex));

  uncolored.sort((a, b) => {
    const saturationDifference =
      saturation(b, colors, graph) - saturation(a, colors, graph);
    if (saturationDifference !== 0) return saturationDifference;

    const degreeDifference =
      (graph.hard.get(b)?.size ?? 0) - (graph.hard.get(a)?.size ?? 0);
    if (degreeDifference !== 0) return degreeDifference;

    return a.localeCompare(b);
  });

  return uncolored[0];
}

function canUseColor(
  vertex: string,
  color: number,
  colors: Map<string, number>,
  graph: ConflictGraph,
) {
  for (const neighbor of graph.hard.get(vertex) ?? []) {
    if (colors.get(neighbor) === color) return false;
  }
  return true;
}

function softPenalty(
  vertex: string,
  color: number,
  colors: Map<string, number>,
  graph: ConflictGraph,
) {
  let penalty = 0;
  for (const neighbor of graph.soft.get(vertex) ?? []) {
    if (colors.get(neighbor) === color) penalty += 1;
  }
  return penalty;
}

export function greedyDsatur(graph: ConflictGraph) {
  const colors = new Map<string, number>();

  while (colors.size < graph.vertices.length) {
    const vertex = chooseNextVertex(colors, graph);
    if (!vertex) break;

    const usedByHardNeighbors = new Set<number>();
    for (const neighbor of graph.hard.get(vertex) ?? []) {
      const color = colors.get(neighbor);
      if (color !== undefined) usedByHardNeighbors.add(color);
    }

    const maxExisting = colors.size ? Math.max(...colors.values()) : -1;
    const candidates: Array<{ color: number; penalty: number }> = [];

    for (let color = 0; color <= maxExisting + 1; color += 1) {
      if (!usedByHardNeighbors.has(color)) {
        candidates.push({
          color,
          penalty: softPenalty(vertex, color, colors, graph),
        });
      }
    }

    candidates.sort((a, b) => a.penalty - b.penalty || a.color - b.color);
    colors.set(vertex, candidates[0].color);
  }

  return colors;
}

export function colorWithinLimit(
  graph: ConflictGraph,
  maxColors: number,
  deadlineMs = Date.now() + 2_000,
) {
  const colors = new Map<string, number>();

  function search(): boolean {
    if (Date.now() > deadlineMs) return false;
    if (colors.size === graph.vertices.length) return true;

    const vertex = chooseNextVertex(colors, graph);
    if (!vertex) return true;

    const candidates = Array.from({ length: maxColors }, (_, color) => ({
      color,
      penalty: softPenalty(vertex, color, colors, graph),
    })).filter(({ color }) => canUseColor(vertex, color, colors, graph));

    candidates.sort((a, b) => a.penalty - b.penalty || a.color - b.color);

    for (const candidate of candidates) {
      colors.set(vertex, candidate.color);
      if (search()) return true;
      colors.delete(vertex);
    }

    return false;
  }

  return search() ? colors : null;
}

function countSameGroupSoftConflicts(colors: Map<string, number>, graph: ConflictGraph) {
  const seen = new Set<string>();
  let count = 0;

  for (const [vertex, neighbors] of graph.soft.entries()) {
    for (const neighbor of neighbors) {
      const key = pairKey(vertex, neighbor);
      if (seen.has(key)) continue;
      seen.add(key);
      if (colors.get(vertex) === colors.get(neighbor)) count += 1;
    }
  }

  return count;
}

export function allocateTransmitterGroups(
  requirements: CastRequirement[],
  requestedTransmitterCount?: number,
  deadlineMs?: number,
): GroupingResult {
  const graph = buildConflictGraph(requirements);
  let colors: Map<string, number>;

  if (requestedTransmitterCount !== undefined) {
    const result = colorWithinLimit(
      graph,
      requestedTransmitterCount,
      deadlineMs ?? Date.now() + 4_000,
    );

    if (!result) {
      throw new Error(
        "The cast cannot be allocated without a must-mic conflict using " +
          requestedTransmitterCount +
          " transmitters.",
      );
    }

    colors = result;
  } else {
    colors = greedyDsatur(graph);
  }

  const groupsByColor = new Map<number, string[]>();
  for (const [castMemberId, color] of colors.entries()) {
    const members = groupsByColor.get(color) ?? [];
    members.push(castMemberId);
    groupsByColor.set(color, members);
  }

  const groups = [...groupsByColor.entries()]
    .sort(([a], [b]) => a - b)
    .map(([color, members]) => ({
      id: "TX_" + String(color + 1).padStart(3, "0"),
      members,
    }));

  return {
    groups,
    transmitterCount: groups.length,
    majorConflicts: 0,
    minorConflicts: countSameGroupSoftConflicts(colors, graph),
  };
}
