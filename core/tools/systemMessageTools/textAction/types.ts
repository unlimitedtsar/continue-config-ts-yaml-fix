// SMAP v1 (Small Model Action Protocol v1) grammar types
// Two-line format:
//   @action tool_name
//   arg_name: value
//   arg_name2: value2
//   (end-of-response terminates; blank lines are tolerated but are not terminators)

export const SMAP_ACTION_START = "@action " as const;

// Per-tool description budget for small-model context windows (7B/8B).
// Keeps the tool list section from crowding out user content.
export const SMAP_DEFAULT_MAX_TOOL_DESC_CHARS = 200;
export const SMAP_DEFAULT_MAX_TOOLS_IN_PROMPT = 20;

/** Syntax-level output. Tool availability/schema/policy are validated later. */
export interface ActionCandidate {
  toolName: string;
  args: Record<string, string | number | boolean>;
}

/** Backward-compatible name retained while callers migrate to ActionCandidate. */
export type ParsedSMAPAction = ActionCandidate;

export type SMAPSyntaxErrorCode =
  | "MISSING_ACTION_NAME"
  | "MALFORMED_ARGUMENT"
  | "DUPLICATE_ARGUMENT"
  | "MULTIPLE_ACTIONS";

export const SMAP_ERROR_ACTION = "__smap_error__" as const;

export class SMAPSyntaxError extends Error {
  constructor(
    public readonly code: SMAPSyntaxErrorCode,
    message: string,
  ) {
    super(`SMAP v1 ${code}: ${message}`);
    this.name = "SMAPSyntaxError";
  }
}

export interface SMAPParseResult {
  action: ActionCandidate | null;
  error: { code: SMAPSyntaxErrorCode; message: string } | null;
}

export interface TextActionConfig {
  maxToolDescriptionChars: number;
  maxToolsInPrompt: number;
}

export const DEFAULT_TEXT_ACTION_CONFIG: TextActionConfig = {
  maxToolDescriptionChars: SMAP_DEFAULT_MAX_TOOL_DESC_CHARS,
  maxToolsInPrompt: SMAP_DEFAULT_MAX_TOOLS_IN_PROMPT,
};
