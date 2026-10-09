import { SEMANTIC_ACTION_REGISTRY } from "./registry";

export type ResolvedAction = {
  /** Canonical Continue tool name to dispatch (e.g. "run_terminal_command") */
  tool: string;
  /** Args to pass to that tool — deterministically constructed, never model-generated */
  toolArgs: Record<string, unknown>;
};

/**
 * Resolves a semantic action name + model-supplied args into a concrete
 * Continue tool call.  Returns null if the name is not a known semantic action
 * (i.e. it should be treated as a regular Continue tool name).
 */
export function resolveSemanticAction(
  name: string,
  args: Record<string, unknown>,
): ResolvedAction | null {
  const def = SEMANTIC_ACTION_REGISTRY[name];
  if (!def) return null;

  const { adapter } = def;

  if (adapter.kind === "terminal") {
    return {
      tool: "run_terminal_command",
      toolArgs: {
        command: adapter.buildCommand(args),
        waitForCompletion: true,
      },
    };
  }

  return {
    tool: adapter.targetTool,
    toolArgs: adapter.mapArgs(args),
  };
}

/** Returns true if the given name is a registered semantic action. */
export function isSemanticAction(name: string): boolean {
  return name in SEMANTIC_ACTION_REGISTRY;
}
