// Deterministic alias map: short / common names → canonical Continue tool names.
// Small models reliably express intent but often forget the exact registered name.
// Resolution is O(1) map lookup — no LLM call, no fuzzy match.
const ALIAS_MAP: Readonly<Record<string, string>> = {
  // File read / write
  read: "read_file",
  write: "write_file",
  edit: "edit_file",
  create: "create_file",
  delete: "delete_file",
  remove: "delete_file",
  move: "move_file",
  copy: "copy_file",
  view: "read_file",
  open: "read_file",
  cat: "read_file",

  // Search / navigation
  grep: "grep_search",
  search: "grep_search",
  find: "find_files",
  glob: "find_files",
  ls: "list_dir",
  list: "list_dir",
  dir: "list_dir",

  // Git
  diff: "git_diff",
  log: "git_log",
  status: "git_status",
  commit: "git_commit",
  blame: "git_blame",

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
