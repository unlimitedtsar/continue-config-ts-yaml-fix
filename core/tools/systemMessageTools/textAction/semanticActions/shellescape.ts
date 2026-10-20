import os from "os";
import type { CommandSpec } from "./types";

/**
 * Wraps a value in shell-safe quotes.
 * PowerShell (Windows): single-quoted string, embedded ' → ''
 * POSIX (Linux/macOS): single-quoted string, embedded ' → '\''
 *
 * Never interpolates or constructs shell syntax — only quotes a value.
 */
export function shellEscape(value: string): string {
  const str = String(value);
  if (os.platform() === "win32") {
    return "'" + str.replace(/'/g, "''") + "'";
  }
  return "'" + str.replace(/'/g, "'\\''") + "'";
}

/**
 * Converts a code-owned executable + argv structure to the legacy terminal
 * tool's string boundary. The executable is restricted to a fixed safe token;
 * every model-derived value is escaped as one argument.
 */
export function renderCommandSpec(spec: CommandSpec): string {
  if (!/^[A-Za-z0-9_.-]+$/.test(spec.executable)) {
    throw new Error(`Unsafe semantic action executable: ${spec.executable}`);
  }
  return [spec.executable, ...spec.args.map(shellEscape)].join(" ");
}
