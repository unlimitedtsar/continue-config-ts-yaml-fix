import { ToolCallDelta } from "../../..";
import { createDelta } from "../systemToolUtils";
import { ToolCallParseState } from "../types";
import { SMAPSyntaxError, type SMAPSyntaxErrorCode } from "./types";

/*
  SMAP v1 streaming parser — two-line format:
    @action tool_name
    arg_name: value
    arg_name2: value2
    (end-of-response terminates; blank lines are tolerated)

  Reuses ToolCallParseState fields:
    lineChunks[0]     — header line accumulator ("@action tool_name")
    lineChunks[1+]    — arg line accumulators ("key: value")
    currentLineIndex  — which line we are currently building
    processedArgNames — keys already emitted (for JSON prefix logic)
    done              — set only when parsing cannot continue safely
    isWithinArgStart, currentArgName, currentArgChunks — unused by this parser
*/
export function handleTextActionBuffer(
  chunk: string,
  state: ToolCallParseState,
): ToolCallDelta | undefined {
  const lineIndex = state.currentLineIndex;
  if (!state.lineChunks[lineIndex]) {
    state.lineChunks[lineIndex] = [];
  }
  state.lineChunks[lineIndex].push(chunk);

  const isNewLine = chunk === "\n";
  if (isNewLine) {
    state.currentLineIndex++;
  }

  const line = state.lineChunks[lineIndex].join("");

  if (lineIndex === 0) {
    // Header line: full content is "@action tool_name\n"
    if (isNewLine) {
      const toolName = line.replace(/^@action\s+/i, "").replace(/\n$/, "").trim();
      if (!toolName) {
        throw syntaxError(
          "MISSING_ACTION_NAME",
          "missing tool name after @action",
        );
      }
      return createDelta(toolName, "", state.toolCallId);
    }
    return undefined;
  }

  // Arg lines: "key: value". Blank lines are tolerated because small models
  // sometimes insert one between the action header and the first argument.
  if (!isNewLine) {
    return undefined;
  }

  const trimmedLine = line.replace(/\n$/, "").trimEnd();

  // End-of-response is the only successful terminator. Streaming pauses and
  // blank lines must not finalize an action.
  if (!trimmedLine) {
    return undefined;
  }

  // SMAP v1 permits exactly one action per response.
  if (trimmedLine.toLowerCase().startsWith("@action ")) {
    state.done = true;
    throw syntaxError(
      "MULTIPLE_ACTIONS",
      "multiple @action blocks in one response",
    );
  }

  return parseArgLine(trimmedLine, state);
}

function parseArgLine(
  line: string,
  state: ToolCallParseState,
): ToolCallDelta | undefined {
  // Prefer ": " separator; fall back to bare ":"
  let key: string;
  let value: string;

  const colonSpaceIdx = line.indexOf(": ");
  if (colonSpaceIdx !== -1) {
    key = line.slice(0, colonSpaceIdx).trim();
    value = line.slice(colonSpaceIdx + 2).trim();
  } else {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) {
      state.done = true;
      throw syntaxError(
        "MALFORMED_ARGUMENT",
        `expected "key: value", received "${line}"`,
      );
    }
    key = line.slice(0, colonIdx).trim();
    value = line.slice(colonIdx + 1).trim();
  }

  if (!key) {
    state.done = true;
    throw syntaxError("MALFORMED_ARGUMENT", "argument name cannot be empty");
  }

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    state.done = true;
    throw syntaxError(
      "MALFORMED_ARGUMENT",
      `invalid argument name "${key}"`,
    );
  }

  if (state.processedArgNames.has(key)) {
    state.done = true;
    throw syntaxError("DUPLICATE_ARGUMENT", `duplicate argument "${key}"`);
  }

  return emitArg(key, value, state);
}

function emitArg(
  key: string,
  value: string,
  state: ToolCallParseState,
): ToolCallDelta {
  const prefix = state.processedArgNames.size === 0 ? "{" : ",";
  state.processedArgNames.add(key);

  // Coerce value type: boolean → boolean, numeric string → number, else string
  let jsonValue: string;
  if (value === "true" || value === "false") {
    jsonValue = value;
  } else if (value !== "" && !isNaN(Number(value)) && value.trim() !== "") {
    jsonValue = value;
  } else {
    jsonValue = JSON.stringify(value);
  }

  return createDelta("", `${prefix}"${key}":${jsonValue}`, state.toolCallId);
}

function syntaxError(code: SMAPSyntaxErrorCode, message: string): Error {
  return new SMAPSyntaxError(code, message);
}
