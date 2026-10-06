import { ToolCallDelta } from "../../..";
import { createDelta } from "../systemToolUtils";
import { ToolCallParseState } from "../types";

/*
  SMAP v1 streaming parser — two-line format:
    @action tool_name
    arg_name: value
    arg_name2: value2
    (blank line or EOF terminates)

  Reuses ToolCallParseState fields:
    lineChunks[0]     — header line accumulator ("@action tool_name")
    lineChunks[1+]    — arg line accumulators ("key: value")
    currentLineIndex  — which line we are currently building
    processedArgNames — keys already emitted (for JSON prefix logic)
    done              — set on blank-line or EOF terminator
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
        throw new Error("SMAP v1: missing tool name after @action");
      }
      return createDelta(toolName, "", state.toolCallId);
    }
    return undefined;
  }

  // Arg lines: "key: value" or blank line terminator
  if (!isNewLine) {
    return undefined;
  }

  const trimmedLine = line.replace(/\n$/, "").trimEnd();

  // Blank line = end of action block
  if (!trimmedLine) {
    state.done = true;
    if (state.processedArgNames.size > 0) {
      return createDelta("", "}", state.toolCallId);
    }
    return undefined;
  }

  // Next @action = start of a new action; terminate current
  if (trimmedLine.toLowerCase().startsWith("@action ")) {
    state.done = true;
    if (state.processedArgNames.size > 0) {
      return createDelta("", "}", state.toolCallId);
    }
    return undefined;
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
      // Not a valid arg line — treat as end of action
      state.done = true;
      if (state.processedArgNames.size > 0) {
        return createDelta("", "}", state.toolCallId);
      }
      return undefined;
    }
    key = line.slice(0, colonIdx).trim();
    value = line.slice(colonIdx + 1).trim();
  }

  if (!key) {
    return undefined;
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
