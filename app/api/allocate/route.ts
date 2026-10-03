import { NextResponse } from "next/server";
import { allocateTransmitterGroups } from "@/lib/allocator/grouping";
import type { CastRequirement } from "@/lib/allocator/model";

interface AllocatePayload {
  cast: CastRequirement[];
  transmitterCount?: number;
}

export async function POST(request: Request) {
  let payload: AllocatePayload;

  try {
    payload = (await request.json()) as AllocatePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (!Array.isArray(payload.cast)) {
    return NextResponse.json({ error: "cast must be an array." }, { status: 400 });
  }

  try {
    const result = allocateTransmitterGroups(
      payload.cast,
      payload.transmitterCount,
      Date.now() + 8_000,
    );
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Allocation failed.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
