import os from "os";
import { shellEscape } from "./shellescape";
import { SemanticActionDef } from "./types";

export const SEMANTIC_ACTION_REGISTRY: Readonly<
  Record<string, SemanticActionDef>
> = {
  // ── Git ──────────────────────────────────────────────────────────────────

  git_status: {
    description: "Show working tree status (short format)",
    args: [],
    adapter: {
      kind: "terminal",
      buildCommand: () => "git status --short",
    },
  },

  git_log: {
    description: "Show recent commit history",
    args: [
      {
        name: "limit",
        type: "number",
        description: "Number of commits to show (default 20)",
      },
      {
        name: "file",
        type: "string",
        description: "Optional: filter to commits that touched this file",
      },
    ],
    adapter: {
      kind: "terminal",
      buildCommand: (args) => {
        const limit = Number(args.limit) > 0 ? Number(args.limit) : 20;
        const file =
          args.file ? ` -- ${shellEscape(String(args.file))}` : "";
        return `git log --oneline -${limit}${file}`;
      },
    },
  },

  git_diff: {
    description: "Show changes in the working tree or for a specific file",
    args: [
      {
        name: "file",
        type: "string",
        description: "Optional: path to a specific file",
      },
      {
        name: "staged",
        type: "boolean",
        description: "If true, show staged (--cached) changes instead",
      },
    ],
    adapter: {
      kind: "terminal",
      buildCommand: (args) => {
        const staged =
          args.staged === true || args.staged === "true" ? " --cached" : "";
        const file =
          args.file ? ` -- ${shellEscape(String(args.file))}` : "";
        return `git diff${staged}${file}`;
      },
    },
  },

  git_blame: {
    description: "Show who last modified each line of a file",
    args: [
      {
        name: "file",
        type: "string",
        required: true,
        description: "Path to the file",
      },
    ],
    adapter: {
      kind: "terminal",
      buildCommand: (args) =>
        `git blame ${shellEscape(String(args.file))}`,
    },
  },

  git_commit: {
    description: "Create a commit with the given message (stages nothing — run git add first if needed)",
    args: [
      {
        name: "message",
        type: "string",
        required: true,
        description: "Commit message",
      },
    ],
    adapter: {
      kind: "terminal",
      buildCommand: (args) =>
        `git commit -m ${shellEscape(String(args.message))}`,
    },
  },

  // ── File management ───────────────────────────────────────────────────────

  delete_file: {
    description: "Delete a file permanently",
    args: [
      {
        name: "path",
        type: "string",
        required: true,
        description: "Path to the file to delete",
      },
    ],
    adapter: {
      kind: "terminal",
      buildCommand: (args) => {
        const p = shellEscape(String(args.path));
        return os.platform() === "win32"
          ? `Remove-Item -Force ${p}`
          : `rm ${p}`;
      },
    },
  },

  move_file: {
    description: "Move or rename a file",
    args: [
      {
        name: "source",
        type: "string",
        required: true,
        description: "Current file path",
      },
      {
        name: "destination",
        type: "string",
        required: true,
        description: "Target path (new name or directory)",
      },
    ],
    adapter: {
      kind: "terminal",
      buildCommand: (args) => {
        const src = shellEscape(String(args.source));
        const dst = shellEscape(String(args.destination));
        return os.platform() === "win32"
          ? `Move-Item ${src} ${dst}`
          : `mv ${src} ${dst}`;
      },
    },
  },

  copy_file: {
    description: "Copy a file to a new location",
    args: [
      {
        name: "source",
        type: "string",
        required: true,
        description: "Source file path",
      },
      {
        name: "destination",
        type: "string",
        required: true,
        description: "Destination path",
      },
    ],
    adapter: {
      kind: "terminal",
      buildCommand: (args) => {
        const src = shellEscape(String(args.source));
        const dst = shellEscape(String(args.destination));
        return os.platform() === "win32"
          ? `Copy-Item ${src} ${dst}`
          : `cp ${src} ${dst}`;
      },
    },
  },
};
