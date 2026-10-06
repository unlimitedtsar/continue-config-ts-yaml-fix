import { describe, expect, it } from "vitest";
import { Tool } from "../../..";
import {
  createTextActionExampleCall,
  TEXT_ACTION_EXAMPLE_CALL,
  TEXT_ACTION_EXAMPLE_DEFINITION,
  TEXT_ACTION_SYSTEM_PREFIX,
  TEXT_ACTION_SYSTEM_SUFFIX,
  toolToTextActionDefinition,
} from "./buildTextActionPrompt";

const MOCK_TOOL: Tool = {
  type: "function",
  displayTitle: "Read File",
  readonly: true,
  group: "filesystem",
  function: {
    name: "read_file",
    description: "Read the contents of a file at the given filepath.",
    parameters: {
      type: "object",
      properties: {
        filepath: {
          type: "string",
          description: "Absolute path to the file.",
        },
        lines: {
          type: "number",
          description: "Max lines to read.",
        },
      },
      required: ["filepath"],
    },
  },
};

describe("toolToTextActionDefinition", () => {
  it("includes tool name on first line with @tool prefix", () => {
    const def = toolToTextActionDefinition(MOCK_TOOL);
    expect(def.split("\n")[0]).toBe("@tool read_file");
  });

  it("includes description on desc: line", () => {
    const def = toolToTextActionDefinition(MOCK_TOOL);
    expect(def).toContain("desc: Read the contents");
  });

  it("lists required args with (type, required) annotation", () => {
    const def = toolToTextActionDefinition(MOCK_TOOL);
    expect(def).toContain("arg: filepath (string, required)");
  });

  it("lists optional args without required annotation", () => {
    const def = toolToTextActionDefinition(MOCK_TOOL);
    expect(def).toContain("arg: lines (number)");
    expect(def).not.toContain("arg: lines (number, required)");
  });

  it("truncates description at maxDescChars", () => {
    const longDesc = "A".repeat(500);
    const tool: Tool = {
      ...MOCK_TOOL,
      function: { ...MOCK_TOOL.function, description: longDesc },
    };
    const def = toolToTextActionDefinition(tool, 50);
    const descLine = def.split("\n").find((l) => l.startsWith("desc:"))!;
    // 50 chars + "…" suffix
    expect(descLine.length).toBeLessThanOrEqual("desc: ".length + 51);
    expect(descLine).toMatch(/…$/);
  });

  it("omits desc line when description is empty", () => {
    const tool: Tool = {
      ...MOCK_TOOL,
      function: { ...MOCK_TOOL.function, description: "" },
    };
    const def = toolToTextActionDefinition(tool);
    expect(def).not.toContain("desc:");
  });

  it("handles tool with no parameters gracefully", () => {
    const tool: Tool = {
      type: "function",
      displayTitle: "Noop",
      readonly: true,
      group: "misc",
      function: { name: "noop", description: "Does nothing." },
    };
    const def = toolToTextActionDefinition(tool);
    expect(def).toBe("@tool noop\ndesc: Does nothing.");
    expect(def).not.toContain("arg:");
  });
});

describe("prompt constants", () => {
  it("system prefix contains @action format example", () => {
    expect(TEXT_ACTION_SYSTEM_PREFIX).toContain("@action");
  });

  it("system prefix instructs to stop after last arg line", () => {
    expect(TEXT_ACTION_SYSTEM_PREFIX).toContain("last thing in your response");
  });

  it("system suffix warns against wrapping @action in code blocks", () => {
    expect(TEXT_ACTION_SYSTEM_SUFFIX).toContain("Do not wrap @action");
  });

  it("example definition uses @tool prefix", () => {
    expect(TEXT_ACTION_EXAMPLE_DEFINITION.split("\n")[0]).toMatch(/^@tool /);
  });

  it("example call uses @action prefix", () => {
    expect(TEXT_ACTION_EXAMPLE_CALL.split("\n")[0]).toMatch(/^@action /);
  });
});

describe("createTextActionExampleCall", () => {
  it("renders @action header and arg lines", () => {
    const result = createTextActionExampleCall("read_file", "To read a file:", [
      ["filepath", "src/main.ts"],
    ]);
    expect(result).toContain("@action read_file");
    expect(result).toContain("filepath: src/main.ts");
    expect(result).toContain("To read a file:");
  });

  it("renders with no args", () => {
    const result = createTextActionExampleCall("list_dir", "List files:");
    expect(result).toContain("@action list_dir");
    expect(result.split("\n")).toHaveLength(2); // prefix + @action line
  });

  it("handles numeric arg values", () => {
    const result = createTextActionExampleCall("scroll", "Scroll:", [
      ["lines", 10],
    ]);
    expect(result).toContain("lines: 10");
  });
});
