import { Tool, ToolCallDelta, ToolCallState } from "../../..";
import { SystemMessageToolsFramework, ToolCallParseState } from "../types";
import { createDelta } from "../systemToolUtils";
import { TEXT_ACTION_ACCEPTED_STARTS } from "./detectTextActionStart";
import { handleTextActionBuffer } from "./parseTextAction";
import { normalizeToolName } from "./actionNormalizer";
import {
  createTextActionExampleCall,
  TEXT_ACTION_EXAMPLE_CALL,
  TEXT_ACTION_EXAMPLE_DEFINITION,
  TEXT_ACTION_SYSTEM_PREFIX,
  TEXT_ACTION_SYSTEM_SUFFIX,
  toolToTextActionDefinition,
} from "./buildTextActionPrompt";
import {
  DEFAULT_TEXT_ACTION_CONFIG,
  SMAP_ERROR_ACTION,
  SMAPSyntaxError,
  TextActionConfig,
} from "./types";
import { SEMANTIC_ACTION_REGISTRY } from "./semanticActions/registry";

export class TextActionFramework implements SystemMessageToolsFramework {
  private config: TextActionConfig;
  private semanticActions: typeof SEMANTIC_ACTION_REGISTRY;

  constructor(
    config: Partial<TextActionConfig> = {},
    semanticActions: typeof SEMANTIC_ACTION_REGISTRY = SEMANTIC_ACTION_REGISTRY,
  ) {
    this.config = { ...DEFAULT_TEXT_ACTION_CONFIG, ...config };
    this.semanticActions = semanticActions;
  }

  // Self-contained detection — does not add to any global list.
  acceptedToolCallStarts: [string, string][] = TEXT_ACTION_ACCEPTED_STARTS;
  allowToolCallInsideCodeBlock = false;

  toolCallStateToSystemToolCall(state: ToolCallState): string {
    const lines = [`@action ${state.toolCall.function.name}`];
    try {
      const args = state.parsedArgs ?? {};
      for (const [key, value] of Object.entries(args)) {
        const rendered =
          typeof value === "string" ? value : JSON.stringify(value);
        lines.push(`${key}: ${rendered}`);
      }
    } catch {
      // parsedArgs not serializable — emit tool name only
    }
    return lines.join("\n");
  }

  handleToolCallBuffer(
    chunk: string,
    state: ToolCallParseState,
  ): ToolCallDelta | undefined {
    let delta: ToolCallDelta | undefined;
    try {
      delta = handleTextActionBuffer(chunk, state);
    } catch (error) {
      if (!(error instanceof SMAPSyntaxError)) {
        throw error;
      }
      state.done = true;
      return {
        type: "function",
        id: state.toolCallId,
        function: {
          name: SMAP_ERROR_ACTION,
          arguments: JSON.stringify({
            code: error.code,
            message: error.message,
            retryable: true,
          }),
        },
      };
    }
    // Apply alias normalization when tool name is first emitted (header delta)
    if (delta?.function?.name) {
      const normalized = normalizeToolName(delta.function.name);
      if (normalized !== delta.function.name) {
        return {
          ...delta,
          function: { ...delta.function, name: normalized },
        };
      }
    }
    return delta;
  }

  finalizeToolCall(state: ToolCallParseState): ToolCallDelta[] {
    if (state.done) {
      return [];
    }

    const deltas: ToolCallDelta[] = [];
    const pendingLine = state.lineChunks[state.currentLineIndex]?.join("") ?? "";
    if (pendingLine.length > 0) {
      const pendingDelta = this.handleToolCallBuffer("\n", state);
      if (pendingDelta) {
        deltas.push(pendingDelta);
      }
    }

    if (!state.done && state.processedArgNames.size > 0) {
      deltas.push(createDelta("", "}", state.toolCallId));
    }
    state.done = true;
    return deltas;
  }

  toolToSystemToolDefinition(tool: Tool): string {
    return toolToTextActionDefinition(tool, this.config.maxToolDescriptionChars);
  }

  systemMessagePrefix = TEXT_ACTION_SYSTEM_PREFIX;
  systemMessageSuffix = TEXT_ACTION_SYSTEM_SUFFIX;
  exampleDynamicToolDefinition = TEXT_ACTION_EXAMPLE_DEFINITION;
  exampleDynamicToolCall = TEXT_ACTION_EXAMPLE_CALL;

  createSystemMessageExampleCall(
    toolName: string,
    prefix: string,
    exampleArgs: Array<[string, string | number]> = [],
  ): string {
    return createTextActionExampleCall(toolName, prefix, exampleArgs);
  }

  getExtraToolDefinitions(): string[] {
    return Object.entries(this.semanticActions).map(([name, def]) => {
      const lines: string[] = [`@tool ${name}`, `desc: ${def.description}`];
      for (const arg of def.args) {
        const req = arg.required ? ", required" : "";
        const desc = arg.description.length > 80
          ? arg.description.slice(0, 80) + "…"
          : arg.description;
        lines.push(`arg: ${arg.name} (${arg.type}${req}) — ${desc}`);
      }
      return lines.join("\n");
    });
  }
}
