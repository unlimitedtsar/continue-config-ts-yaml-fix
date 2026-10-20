import { SemanticActionDef } from "./types";

function isWindowsHost(): boolean {
  return typeof process !== "undefined" && process.platform === "win32";
}

export const SEMANTIC_ACTION_REGISTRY: Readonly<
  Record<string, SemanticActionDef>
> = {
  // ── Git ──────────────────────────────────────────────────────────────────

  git_status: {
    description: "Show working tree status (short format)",
    args: [],
    policy: "allowedWithoutPermission",
    adapter: {
      kind: "terminal",
      buildCommandSpec: () => ({
        executable: "git",
        args: ["status", "--short"],
      }),
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
    policy: "allowedWithoutPermission",
    adapter: {
      kind: "terminal",
      buildCommandSpec: (args) => {
        const requested = Number(args.limit);
        const limit = Number.isFinite(requested) && requested > 0
          ? Math.min(Math.trunc(requested), 100)
          : 20;
        const commandArgs = ["log", "--oneline", `-${limit}`];
        if (args.file) {
          commandArgs.push("--", String(args.file));
        }
        return { executable: "git", args: commandArgs };
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
    policy: "allowedWithoutPermission",
    adapter: {
      kind: "terminal",
      buildCommandSpec: (args) => {
        const commandArgs = ["diff"];
        if (args.staged === true || args.staged === "true") {
          commandArgs.push("--cached");
        }
        if (args.file) {
          commandArgs.push("--", String(args.file));
        }
        return { executable: "git", args: commandArgs };
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
    policy: "allowedWithoutPermission",
    adapter: {
      kind: "terminal",
      buildCommandSpec: (args) => ({
        executable: "git",
        args: ["blame", "--", String(args.file)],
      }),
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
    policy: "allowedWithPermission",
    adapter: {
      kind: "terminal",
      buildCommandSpec: (args) => ({
        executable: "git",
        args: ["commit", "-m", String(args.message)],
      }),
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
    policy: "allowedWithPermission",
    adapter: {
      kind: "terminal",
      buildCommandSpec: (args) =>
        isWindowsHost()
          ? {
              executable: "Remove-Item",
              args: ["-LiteralPath", String(args.path), "-Force"],
            }
          : { executable: "rm", args: ["--", String(args.path)] },
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
    policy: "allowedWithPermission",
    adapter: {
      kind: "terminal",
      buildCommandSpec: (args) =>
        isWindowsHost()
          ? {
              executable: "Move-Item",
              args: [
                "-LiteralPath",
                String(args.source),
                "-Destination",
                String(args.destination),
              ],
            }
          : {
              executable: "mv",
              args: ["--", String(args.source), String(args.destination)],
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
    policy: "allowedWithPermission",
    adapter: {
      kind: "terminal",
      buildCommandSpec: (args) =>
        isWindowsHost()
          ? {
              executable: "Copy-Item",
              args: [
                "-LiteralPath",
                String(args.source),
                "-Destination",
                String(args.destination),
              ],
            }
          : {
              executable: "cp",
              args: ["--", String(args.source), String(args.destination)],
            },
    },
  },
};
