import os from "os";

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
