export type ArgDef = {
  name: string;
  type: "string" | "number" | "boolean";
  required?: boolean;
  description: string;
};

/** Routes the semantic action to run_terminal_command with a deterministic command string. */
export type TerminalAdapter = {
  kind: "terminal";
  buildCommand: (args: Record<string, unknown>) => string;
};

/** Routes the semantic action to an existing Continue tool, remapping args. */
export type ToolAdapter = {
  kind: "tool";
  targetTool: string;
  mapArgs: (args: Record<string, unknown>) => Record<string, unknown>;
};

export type SemanticActionDef = {
  description: string;
  args: ArgDef[];
  adapter: TerminalAdapter | ToolAdapter;
};
