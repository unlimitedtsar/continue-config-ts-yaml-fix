// Deterministic alias map: short / common names → canonical Continue tool names.
// Small models reliably express intent but often forget the exact registered name.
// Resolution is O(1) map lookup — no LLM call, no fuzzy match.
const ALIAS_MAP: Readonly<Record<string, string>> = {
  // File read
  read: "read_file",
  view: "read_file",
  open: "read_file",
  cat: "read_file",

  // File write / edit / create
  edit: "edit_existing_file",
  write: "create_new_file",
  create: "create_new_file",

  // Search / navigation
  grep: "grep_search",
  search: "grep_search",
  find: "file_glob_search",
  glob: "file_glob_search",

  // Directory listing — actual registered name is "ls"
  list: "ls",
  dir: "ls",
  list_dir: "ls", // reverse alias in case model uses old/hallucinated name

  // Diff
  diff: "view_diff",

  // Shell / terminal
  run: "run_terminal_command",
  exec: "run_terminal_command",
  shell: "run_terminal_command",
  terminal: "run_terminal_command",
  bash: "run_terminal_command",
  cmd: "run_terminal_command",
};

export function normalizeToolName(name: string): string {
  const trimmed = name.trim();
  const canonical = ALIAS_MAP[trimmed.toLowerCase()];
  return canonical ?? trimmed;
}
