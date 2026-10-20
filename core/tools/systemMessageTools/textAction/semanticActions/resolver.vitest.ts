import os from "os";
import { describe, expect, it } from "vitest";
import { resolveSemanticAction } from "./resolver";

describe("resolveSemanticAction", () => {
  it("renders a fixed git executable with escaped argv", () => {
    const resolved = resolveSemanticAction("git_log", {
      limit: 5,
      file: "src/file with spaces.ts",
    });
    expect(resolved?.tool).toBe("run_terminal_command");
    expect(resolved?.toolArgs.command).toBe(
      os.platform() === "win32"
        ? "git 'log' '--oneline' '-5' '--' 'src/file with spaces.ts'"
        : "git 'log' '--oneline' '-5' '--' 'src/file with spaces.ts'",
    );
  });

  it("keeps model text inside one escaped commit-message argument", () => {
    const resolved = resolveSemanticAction("git_commit", {
      message: "fix'; echo unsafe",
    });
    const command = String(resolved?.toolArgs.command);
    expect(command).toContain("git 'commit' '-m'");
    if (os.platform() === "win32") {
      expect(command).toContain("'fix''; echo unsafe'");
    } else {
      expect(command).toContain("'fix'\\''; echo unsafe'");
    }
  });

  it("caps git log limit at 100", () => {
    const resolved = resolveSemanticAction("git_log", { limit: 999999 });
    expect(String(resolved?.toolArgs.command)).toContain("'-100'");
  });

  it("returns null for ordinary Continue tools", () => {
    expect(resolveSemanticAction("read_file", { filepath: "a.ts" })).toBeNull();
  });
});
