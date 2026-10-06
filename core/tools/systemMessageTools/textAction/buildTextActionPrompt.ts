import { Tool } from "../../..";
import { SMAP_DEFAULT_MAX_TOOL_DESC_CHARS } from "./types";

// Compact tool definition block for the system message.
// Shorter than toolCodeblocks format to preserve context budget for 7–8B models.
export function toolToTextActionDefinition(
  tool: Tool,
  maxDescChars = SMAP_DEFAULT_MAX_TOOL_DESC_CHARS,
): string {
  const name = tool.function.name;
  const rawDesc = tool.function.description ?? "";
  const desc = rawDesc.length > maxDescChars
    ? rawDesc.slice(0, maxDescChars) + "…"
    : rawDesc;

  const lines: string[] = [`@tool ${name}`];
  if (desc) {
    lines.push(`desc: ${desc}`);
  }

  if (tool.function.parameters && "properties" in tool.function.parameters) {
    const props = tool.function.parameters.properties as Record<string, any>;
    const required: string[] = (tool.function.parameters as any).required ?? [];
    for (const [key, val] of Object.entries(props)) {
      const isRequired = required.includes(key);
      const type: string = (val as any).type ?? "string";
      const argDesc: string = (val as any).description ?? "";
      const shortArgDesc = argDesc.length > 80 ? argDesc.slice(0, 80) + "…" : argDesc;
      const descSuffix = shortArgDesc ? ` — ${shortArgDesc}` : "";
      lines.push(`arg: ${key} (${type}${isRequired ? ", required" : ""})${descSuffix}`);
    }
  }

  return lines.join("\n");
}

export const TEXT_ACTION_SYSTEM_PREFIX = `You have access to tools. To call a tool use the @action format:

@action tool_name
arg_name: value
arg_name2: value2

Rules:
1. One @action block per response.
2. @action MUST be the last thing in your response. Stop immediately after the last arg line.
3. If the task is complete without needing a tool, respond in plain prose only.
4. Do not invent tool names — only use the tools listed below.`;

export const TEXT_ACTION_SYSTEM_SUFFIX =
  `Only use the tools listed above. Do not wrap @action in markdown code blocks.`;

export const TEXT_ACTION_EXAMPLE_DEFINITION = `@tool example_tool
desc: Does something useful with the provided arguments
arg: arg_1 (string, required) — first argument description
arg: arg_2 (number) — optional numeric argument`;

export const TEXT_ACTION_EXAMPLE_CALL = `@action example_tool
arg_1: the value of arg 1
arg_2: 3`;

export function createTextActionExampleCall(
  toolName: string,
  prefix: string,
  exampleArgs: Array<[string, string | number]> = [],
): string {
  const lines = [`@action ${toolName}`];
  for (const [argName, argValue] of exampleArgs) {
    lines.push(`${argName}: ${argValue}`);
  }
  return `${prefix.trim()}\n${lines.join("\n")}`;
}
