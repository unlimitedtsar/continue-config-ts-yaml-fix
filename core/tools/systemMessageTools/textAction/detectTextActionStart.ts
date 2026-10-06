import { SMAP_ACTION_START } from "./types";

// SMAP v1 detection patterns consumed by TextActionFramework.acceptedToolCallStarts.
// Format: [detection prefix (lowercase), replacement buffer passed to parser].
// Self-contained — does NOT write into the shared parent acceptedToolCallStarts array.
export const TEXT_ACTION_ACCEPTED_STARTS: [string, string][] = [
  [SMAP_ACTION_START.toLowerCase(), SMAP_ACTION_START],
];
