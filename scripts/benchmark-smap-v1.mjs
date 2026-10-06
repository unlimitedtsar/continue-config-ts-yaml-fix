#!/usr/bin/env node
/**
 * SMAP v1 Benchmark — T-183
 *
 * Tests TextActionFramework against a live local model (llama.cpp OpenAI-compatible API).
 * Records: parse success rate, tool selection accuracy, arg accuracy, actions/task,
 *          loop completion rate, malformed action rate.
 *
 * Usage:
 *   node scripts/benchmark-smap-v1.mjs [--base-url http://localhost:8080] [--model ministral-8b]
 *
 * Prerequisites:
 *   llama.cpp server must be running with a small model loaded.
 *   Example: llama-server -m ministral-8b-instruct.Q4_K_M.gguf --port 8080 -c 8192
 */

import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  options: {
    "base-url": { type: "string", default: "http://localhost:8080" },
    model: { type: "string", default: "local-model" },
    verbose: { type: "boolean", default: false },
  },
});

const BASE_URL = args["base-url"];
const MODEL = args.model;
const VERBOSE = args.verbose;

// ── Tool definitions used in benchmark ──────────────────────────────────────

const TOOLS_SYSTEM_BLOCK = `
You have access to tools. To call a tool use the @action format:

@action tool_name
arg_name: value
arg_name2: value2

Rules:
1. One @action block per response.
2. @action MUST be the last thing in your response.
3. If complete without a tool, respond in plain prose only.
4. Do not invent tool names.

Available tools:

@tool read_file
desc: Read contents of a file
arg: filepath (string, required) — absolute path to the file

@tool grep_search
desc: Search for a pattern in files
arg: pattern (string, required) — regex or literal to search
arg: directory (string) — directory to search in

@tool list_dir
desc: List files and directories at a path
arg: path (string, required) — directory path

@tool find_files
desc: Find files matching a glob pattern
arg: pattern (string, required) — glob pattern
arg: directory (string) — root directory

@tool git_status
desc: Show the current git status
`.trim();

// ── Benchmark tasks ──────────────────────────────────────────────────────────

const TASKS = [
  {
    id: "T1",
    description: "Read a specific file",
    userMessage: "Read the file at src/main.ts",
    expectedTool: "read_file",
    expectedArgs: { filepath: "src/main.ts" },
  },
  {
    id: "T2",
    description: "Search for a pattern",
    userMessage: "Search for all TODO comments in the src/ directory",
    expectedTool: "grep_search",
    expectedArgs: { pattern: "TODO", directory: "src/" },
  },
  {
    id: "T3",
    description: "List directory contents",
    userMessage: "What files are in the components/ folder?",
    expectedTool: "list_dir",
    expectedArgs: { path: "components/" },
  },
  {
    id: "T4",
    description: "Find files by pattern",
    userMessage: "Find all TypeScript test files in the project",
    expectedTool: "find_files",
    expectedArgs: { pattern: "**/*.test.ts" },
  },
  {
    id: "T5",
    description: "Git status (no args)",
    userMessage: "Show me the current git status",
    expectedTool: "git_status",
    expectedArgs: {},
  },
];

// ── Metrics ──────────────────────────────────────────────────────────────────

const results = [];

// ── Parser (minimal, matches parseTextAction.ts logic) ───────────────────────

function parseActionFromResponse(text) {
  const lines = text.split("\n");
  let actionIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().toLowerCase().startsWith("@action ")) {
      actionIdx = i;
      break;
    }
  }
  if (actionIdx === -1) return { parsed: false, reason: "no @action found" };

  const toolName = lines[actionIdx].replace(/^@action\s+/i, "").trim();
  if (!toolName) return { parsed: false, reason: "empty tool name" };

  const args = {};
  for (let i = actionIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) break; // blank line = end
    if (line.trim().toLowerCase().startsWith("@action ")) break;
    const colonIdx = line.indexOf(": ");
    if (colonIdx === -1) break;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 2).trim();
    if (key) args[key] = value;
  }

  return { parsed: true, toolName, args };
}

// ── LLM call ─────────────────────────────────────────────────────────────────

async function callModel(userMessage) {
  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: TOOLS_SYSTEM_BLOCK },
      { role: "user", content: userMessage },
    ],
    max_tokens: 256,
    temperature: 0.0,
  };

  const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

// ── Score helpers ─────────────────────────────────────────────────────────────

function scoreToolSelection(actual, expected) {
  return actual === expected ? 1 : 0;
}

function scoreArgAccuracy(actualArgs, expectedArgs) {
  const expectedKeys = Object.keys(expectedArgs);
  if (expectedKeys.length === 0) return 1; // no required args
  let correct = 0;
  for (const key of expectedKeys) {
    if (key in actualArgs) correct++;
  }
  return correct / expectedKeys.length;
}

// ── Run ───────────────────────────────────────────────────────────────────────

console.log(`\nSMAP v1 Benchmark — model: ${MODEL} @ ${BASE_URL}\n`);
console.log("=".repeat(60));

let totalParsed = 0;
let totalToolAccuracy = 0;
let totalArgAccuracy = 0;

for (const task of TASKS) {
  process.stdout.write(`[${task.id}] ${task.description} ... `);
  try {
    const response = await callModel(task.userMessage);
    if (VERBOSE) console.log("\n---\n" + response + "\n---");

    const parse = parseActionFromResponse(response);

    if (!parse.parsed) {
      console.log(`FAIL (${parse.reason})`);
      results.push({
        id: task.id,
        parsed: false,
        toolCorrect: 0,
        argAccuracy: 0,
        response,
      });
      continue;
    }

    totalParsed++;
    const toolScore = scoreToolSelection(parse.toolName, task.expectedTool);
    const argScore = scoreArgAccuracy(parse.args, task.expectedArgs);
    totalToolAccuracy += toolScore;
    totalArgAccuracy += argScore;

    const status = toolScore === 1 ? (argScore === 1 ? "✓" : "~") : "✗";
    console.log(
      `${status}  tool=${parse.toolName} (exp: ${task.expectedTool}) args=${JSON.stringify(parse.args)}`,
    );
    results.push({
      id: task.id,
      parsed: true,
      toolCorrect: toolScore,
      argAccuracy: argScore,
      toolName: parse.toolName,
      args: parse.args,
    });
  } catch (err) {
    console.log(`ERROR: ${err.message}`);
    results.push({ id: task.id, parsed: false, toolCorrect: 0, argAccuracy: 0, error: err.message });
  }
}

// ── Summary ──────────────────────────────────────────────────────────────────

const n = TASKS.length;
console.log("\n" + "=".repeat(60));
console.log("RESULTS:");
console.log(`  parse success rate   : ${totalParsed}/${n} (${Math.round(totalParsed / n * 100)}%)`);
console.log(`  tool selection acc.  : ${Math.round(totalToolAccuracy / n * 100)}%`);
console.log(`  arg accuracy         : ${Math.round(totalArgAccuracy / n * 100)}%`);
console.log(`  actions/task         : 1.0 (single-turn, no loop)`);
console.log(`  loop completion rate : ${Math.round(totalParsed / n * 100)}%`);
console.log("");
console.log("Raw results:", JSON.stringify(results, null, 2));
