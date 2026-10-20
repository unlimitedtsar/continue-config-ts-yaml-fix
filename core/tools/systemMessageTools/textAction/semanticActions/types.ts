import type { ToolPolicy } from "@continuedev/terminal-security";

export type ArgDef = {
  name: string;
  type: "string" | "number" | "boolean";
  required?: boolean;
  description: string;
};

export type CommandSpec = {
  /** Fixed executable/cmdlet chosen by code, never supplied by the model. */
  executable: string;
  /** Structured argv values. Rendering/escaping happens at the backend boundary. */
  args: string[];
};

/** Routes the semantic action to a deterministic executable + argv spec. */
export type TerminalAdapter = {
  kind: "terminal";
  buildCommandSpec: (args: Record<string, unknown>) => CommandSpec;
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
  /**
   * Controls whether the user must approve before this action runs.
   * Read-only/safe actions: "allowedWithoutPermission"
   * Destructive actions: "allowedWithPermission"
   */
  policy: ToolPolicy;
};
