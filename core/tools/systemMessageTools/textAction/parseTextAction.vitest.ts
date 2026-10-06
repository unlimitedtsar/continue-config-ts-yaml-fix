import { beforeEach, describe, expect, it } from "vitest";
import { getInitialToolCallParseState, ToolCallParseState } from "../types";
import { handleTextActionBuffer } from "./parseTextAction";
import { TEXT_ACTION_ACCEPTED_STARTS } from "./detectTextActionStart";
import { normalizeToolName } from "./actionNormalizer";

describe("handleTextActionBuffer — SMAP v1 parser", () => {
  let state: ToolCallParseState;

  beforeEach(() => {
    state = getInitialToolCallParseState();
  });

  // ── Header line ─────────────────────────────────────────────────────────

  it("emits tool name delta when header line completes", () => {
    handleTextActionBuffer("@action read_file", state);
    const result = handleTextActionBuffer("\n", state);
    expect(result).toEqual({
      type: "function",
      function: { name: "read_file", arguments: "" },
      id: expect.any(String),
    });
    expect(state.currentLineIndex).toBe(1);
  });

  it("returns undefined while header line is still accumulating", () => {
    expect(handleTextActionBuffer("@action ", state)).toBeUndefined();
    expect(handleTextActionBuffer("read_file", state)).toBeUndefined();
  });

  it("is case-insensitive for @action prefix", () => {
    handleTextActionBuffer("@ACTION READ_FILE", state);
    const result = handleTextActionBuffer("\n", state);
    expect(result?.function?.name).toBe("READ_FILE");
  });

  it("throws when tool name is missing", () => {
    handleTextActionBuffer("@action ", state);
    expect(() => handleTextActionBuffer("\n", state)).toThrow(
      "SMAP v1: missing tool name after @action",
    );
  });

  // ── Single arg ───────────────────────────────────────────────────────────

  it("emits first arg with opening brace", () => {
    simulateHeader("read_file", state);
    handleTextActionBuffer("filepath: src/main.ts", state);
    const result = handleTextActionBuffer("\n", state);
    expect(result).toEqual({
      type: "function",
      function: { name: "", arguments: '{"filepath":"src/main.ts"' },
      id: expect.any(String),
    });
    expect(state.processedArgNames.has("filepath")).toBe(true);
  });

  it("supports bare colon separator (no space)", () => {
    simulateHeader("read_file", state);
    handleTextActionBuffer("filepath:src/main.ts", state);
    const result = handleTextActionBuffer("\n", state);
    expect(result?.function?.arguments).toBe('{"filepath":"src/main.ts"');
  });

  // ── Multiple args ────────────────────────────────────────────────────────

  it("emits subsequent args with comma prefix", () => {
    simulateHeader("grep_search", state);
    simulateArgLine("pattern", "TODO", state);
    const result = simulateArgLine("directory", "src/", state);
    expect(result?.function?.arguments).toBe(',"directory":"src/"');
  });

  // ── Type coercion ────────────────────────────────────────────────────────

  it("coerces numeric string value to number", () => {
    simulateHeader("scroll", state);
    handleTextActionBuffer("lines: 10", state);
    const result = handleTextActionBuffer("\n", state);
    expect(result?.function?.arguments).toBe('{"lines":10');
  });

  it("coerces boolean string value to boolean", () => {
    simulateHeader("run_terminal_command", state);
    handleTextActionBuffer("background: true", state);
    const result = handleTextActionBuffer("\n", state);
    expect(result?.function?.arguments).toBe('{"background":true');
  });

  it("keeps empty string value as JSON string", () => {
    simulateHeader("write_file", state);
    handleTextActionBuffer("content: ", state);
    const result = handleTextActionBuffer("\n", state);
    expect(result?.function?.arguments).toBe('{"content":""');
  });

  // ── Termination ──────────────────────────────────────────────────────────

  it("sets done and emits closing brace on blank line when args present", () => {
    simulateHeader("read_file", state);
    simulateArgLine("filepath", "src/main.ts", state);
    // blank line
    handleTextActionBuffer("", state);
    const result = handleTextActionBuffer("\n", state);
    expect(result?.function?.arguments).toBe("}");
    expect(state.done).toBe(true);
  });

  it("sets done on blank line with no args — no closing brace emitted", () => {
    simulateHeader("list_dir", state);
    handleTextActionBuffer("", state);
    const result = handleTextActionBuffer("\n", state);
    expect(result).toBeUndefined();
    expect(state.done).toBe(true);
  });

  it("sets done when next @action line encountered", () => {
    simulateHeader("read_file", state);
    simulateArgLine("filepath", "src/main.ts", state);
    handleTextActionBuffer("@action write_file", state);
    const result = handleTextActionBuffer("\n", state);
    expect(result?.function?.arguments).toBe("}");
    expect(state.done).toBe(true);
  });

  it("sets done on non-arg line (no colon)", () => {
    simulateHeader("read_file", state);
    simulateArgLine("filepath", "src/main.ts", state);
    handleTextActionBuffer("no colon here", state);
    const result = handleTextActionBuffer("\n", state);
    expect(result?.function?.arguments).toBe("}");
    expect(state.done).toBe(true);
  });
});

// ── detectTextActionStart ────────────────────────────────────────────────────

describe("TEXT_ACTION_ACCEPTED_STARTS", () => {
  it("contains exactly one entry starting with @action", () => {
    expect(TEXT_ACTION_ACCEPTED_STARTS).toHaveLength(1);
    expect(TEXT_ACTION_ACCEPTED_STARTS[0][0]).toBe("@action ");
  });
});

// ── actionNormalizer ─────────────────────────────────────────────────────────

describe("normalizeToolName", () => {

  it("maps common aliases to canonical names", () => {
    expect(normalizeToolName("read")).toBe("read_file");
    expect(normalizeToolName("grep")).toBe("grep_search");
    expect(normalizeToolName("ls")).toBe("list_dir");
    expect(normalizeToolName("run")).toBe("run_terminal_command");
    expect(normalizeToolName("find")).toBe("find_files");
    expect(normalizeToolName("diff")).toBe("git_diff");
  });

  it("is case-insensitive for alias lookup", () => {
    expect(normalizeToolName("READ")).toBe("read_file");
    expect(normalizeToolName("Grep")).toBe("grep_search");
  });

  it("passes through already-canonical names unchanged", () => {
    expect(normalizeToolName("read_file")).toBe("read_file");
    expect(normalizeToolName("grep_search")).toBe("grep_search");
  });

  it("passes through unknown names unchanged", () => {
    expect(normalizeToolName("my_custom_tool")).toBe("my_custom_tool");
    expect(normalizeToolName("")).toBe("");
  });

  it("trims surrounding whitespace before lookup", () => {
    expect(normalizeToolName("  read  ")).toBe("read_file");
  });
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function simulateHeader(toolName: string, state: ToolCallParseState) {
  handleTextActionBuffer(`@action ${toolName}`, state);
  handleTextActionBuffer("\n", state);
}

function simulateArgLine(
  key: string,
  value: string,
  state: ToolCallParseState,
) {
  handleTextActionBuffer(`${key}: ${value}`, state);
  return handleTextActionBuffer("\n", state);
}
