import type {
  AllocationTimingContext,
  CastRequirement,
  SwapTimingSettings,
} from "./model";

export function minimumSwapPages(
  from: CastRequirement,
  to: CastRequirement,
  settings: SwapTimingSettings,
) {
  if (from.micStyle === "handheld" || to.micStyle === "handheld") {
    return settings.handheldSwapPages;
  }

  if (settings.bodypackMode === "one_mic_per_cast") {
    if (
      !settings.lapelBoomCompatible &&
      from.micStyle &&
      to.micStyle &&
      from.micStyle !== to.micStyle &&
      (from.micStyle === "lapel" || from.micStyle === "boom") &&
      (to.micStyle === "lapel" || to.micStyle === "boom")
    ) {
      return Number.POSITIVE_INFINITY;
    }
    return settings.bodypackSwapPages;
  }

  const micSwap = Math.max(
    from.micStyle === "boom" ? settings.boomMicSwapPages : settings.lapelMicSwapPages,
    to.micStyle === "boom" ? settings.boomMicSwapPages : settings.lapelMicSwapPages,
  );

  return micSwap;
}

export function freePagesBetween(
  fromFrame: number,
  toFrame: number,
  context: AllocationTimingContext,
) {
  const fromPage = context.frames[fromFrame]?.pageOrdinal ?? fromFrame;
  const toPage = context.frames[toFrame]?.pageOrdinal ?? toFrame;

  if (toPage <= fromPage) return 0;
  return Math.max(0, toPage - fromPage - 1);
}

export function intervalBetweenPages(
  fromPage: number,
  toPage: number,
  context: AllocationTimingContext,
) {
  return context.intervalPageOrdinals.some(
    (interval) => interval > fromPage && interval < toPage,
  );
}
