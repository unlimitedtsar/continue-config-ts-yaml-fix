import type { ToolPolicy } from "@continuedev/terminal-security";
import type { MessageModes, Tool } from "../../..";
import { BuiltInToolNames } from "../../builtIn";
import { SEMANTIC_ACTION_REGISTRY } from "./semanticActions/registry";
import type { SemanticActionDef } from "./semanticActions/types";
import { SMAP_DEFAULT_MAX_TOOLS_IN_PROMPT } from "./types";

export type EffectiveActionManifest = {
  tools: Tool[];
  semanticActions: Readonly<Record<string, SemanticActionDef>>;
  allowedActionNames: ReadonlySet<string>;
};

type BuildEffectiveActionManifestOptions = {
  tools: Tool[];
  mode: MessageModes;
  toolPolicies?: Readonly<Record<string, ToolPolicy>>;
  allowMutationActions?: boolean;
  maxActions?: number;
};

/**
 * Compiles the single action surface used by the TextAction prompt and policy
 * gate. `tools` must already be filtered by mode/group/tool-toggle selection.
 */
export function buildEffectiveActionManifest({
  tools,
  mode,
  toolPolicies = {},
  allowMutationActions = false,
  maxActions = SMAP_DEFAULT_MAX_TOOLS_IN_PROMPT,
}: BuildEffectiveActionManifestOptions): EffectiveActionManifest {
  if (mode === "chat") {
    return {
      tools: [],
      semanticActions: {},
      allowedActionNames: new Set(),
    };
  }

  // Raw terminal is an implementation backend in TextAction mode, not a
  // public model action. Semantic adapters cover approved command families.
  const candidateTools = tools.filter(
    (tool) => tool.function.name !== BuiltInToolNames.RunTerminalCommand,
  );

  const semanticEntries = Object.entries(SEMANTIC_ACTION_REGISTRY).filter(
    ([name, def]) => {
      if (toolPolicies[name] === "disabled") {
        return false;
      }
      if (!allowMutationActions && def.policy !== "allowedWithoutPermission") {
        return false;
      }
      if (mode === "plan") {
        return def.policy === "allowedWithoutPermission";
      }
      return true;
    },
  );
  const boundedSemanticEntries = semanticEntries.slice(0, maxActions);
  const effectiveTools = candidateTools.slice(
    0,
    Math.max(0, maxActions - boundedSemanticEntries.length),
  );
  const semanticActions = Object.fromEntries(boundedSemanticEntries);

  return {
    tools: effectiveTools,
    semanticActions,
    allowedActionNames: new Set([
      ...effectiveTools.map((tool) => tool.function.name),
      ...Object.keys(semanticActions),
    ]),
  };
}
