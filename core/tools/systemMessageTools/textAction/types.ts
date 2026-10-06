// SMAP v1 (Small Model Action Protocol v1) grammar types
// Two-line format:
//   @action tool_name
//   arg_name: value
//   arg_name2: value2
//   (blank line or EOF terminates)

export const SMAP_ACTION_START = "@action " as const;

// Per-tool description budget for small-model context windows (7B/8B).
// Keeps the tool list section from crowding out user content.
export const SMAP_DEFAULT_MAX_TOOL_DESC_CHARS = 200;
export const SMAP_DEFAULT_MAX_TOOLS_IN_PROMPT = 20;

export interface ParsedSMAPAction {
  toolName: string;
  args: Record<string, string>;
}

export interface SMAPParseResult {
  action: ParsedSMAPAction | null;
  error: string | null;
}

export interface TextActionConfig {
  maxToolDescriptionChars: number;
  maxToolsInPrompt: number;
}

export const DEFAULT_TEXT_ACTION_CONFIG: TextActionConfig = {
  maxToolDescriptionChars: SMAP_DEFAULT_MAX_TOOL_DESC_CHARS,
  maxToolsInPrompt: SMAP_DEFAULT_MAX_TOOLS_IN_PROMPT,
};
