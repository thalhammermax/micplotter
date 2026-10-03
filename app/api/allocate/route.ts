import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { allocateLikeMicPlot } from "@/lib/allocator/engine";
import { loadProductionAllocationInput } from "@/lib/allocator/production";
import { formatFastSwapProfile } from "@/lib/allocator/score";
import type {
  AllocationEffort,
  AllocationType,
  OrderedAllocationRule,
  TransmitterCountMode,
} from "@/lib/allocator/types";

interface AllocatePayload {
  productionId: string;
  type: AllocationType;
  effort: AllocationEffort;
  transmitterCountMode: TransmitterCountMode;
  manualTransmitterCount?: number;
  rules: OrderedAllocationRule[];
  commit?: boolean;
}

export async function POST(request: Request) {
  let payload: AllocatePayload;

  try {
    payload = (await request.json()) as AllocatePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (!payload.productionId) {
    return NextResponse.json({ error: "productionId is required." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const input = await loadProductionAllocationInput(
      supabase,
      payload.productionId,
    );

    if (!input.timing.frames.length) {
      return NextResponse.json(
        { error: "Add show movements before running Auto Allocate." },
        { status: 422 },
      );
    }

    const result = allocateLikeMicPlot(input.requirements, input.timing, {
      type: payload.type,
      effort: payload.effort,
      transmitterCountMode: payload.transmitterCountMode,
      manualTransmitterCount: payload.manualTransmitterCount,
      rules: payload.rules,
    });

    if (payload.commit) {
      const { error: groupMemberDeleteError } = await supabase
        .from("group_members")
        .delete()
        .eq("production_id", payload.productionId);
      if (groupMemberDeleteError) throw groupMemberDeleteError;

      const { error: groupDeleteError } = await supabase
        .from("transmitter_groups")
        .delete()
        .eq("production_id", payload.productionId);
      if (groupDeleteError) throw groupDeleteError;

      const insertedGroups: Array<{ id: string; tx_name: string }> = [];
      if (result.groups.length) {
        const { data, error } = await supabase
          .from("transmitter_groups")
          .insert(
            result.groups.map((group, index) => ({
              production_id: payload.productionId,
              sort_order: (index + 1) * 10,
              tx_name: group.id,
              mic_ids: [],
            })),
          )
          .select("id,tx_name");

        if (error) throw error;
        insertedGroups.push(...(data ?? []));
      }

      const groupIdByName = new Map(
        insertedGroups.map((group) => [group.tx_name, group.id]),
      );

      const memberships = result.groups.flatMap((group) => {
        const databaseGroupId = groupIdByName.get(group.id);
        if (!databaseGroupId) return [];

        return group.members.map((castMemberId, index) => ({
          production_id: payload.productionId,
          group_id: databaseGroupId,
          cast_member_id: castMemberId,
          sort_order: (index + 1) * 10,
        }));
      });

      if (memberships.length) {
        const { error } = await supabase.from("group_members").insert(memberships);
        if (error) throw error;
      }
    }

    return NextResponse.json({
      transmitterCount: result.transmitterCount,
      groups: result.groups,
      metrics: result.scored.metrics,
      fastSwapProfile: formatFastSwapProfile(result.scored.metrics.fastSwaps),
      swaps: result.scored.swaps,
      committed: Boolean(payload.commit),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Allocation failed.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
