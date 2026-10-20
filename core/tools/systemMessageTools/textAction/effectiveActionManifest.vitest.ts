import type { Tool } from "../../..";
import { describe, expect, it } from "vitest";
import { buildEffectiveActionManifest } from "./effectiveActionManifest";

function mockTool(name: string, readonly: boolean): Tool {
  return {
    type: "function",
    displayTitle: name,
    readonly,
    group: "Built-In",
    function: { name, description: name },
  };
}

describe("buildEffectiveActionManifest", () => {
  const tools = [
    mockTool("read_file", true),
    mockTool("edit_existing_file", false),
    mockTool("run_terminal_command", false),
  ];

  it("removes raw terminal while retaining ordinary active tools", () => {
    const manifest = buildEffectiveActionManifest({ tools, mode: "agent" });
    expect(manifest.tools.map((tool) => tool.function.name)).toEqual([
      "read_file",
      "edit_existing_file",
    ]);
    expect(manifest.allowedActionNames.has("run_terminal_command")).toBe(false);
  });

  it("exposes read-only semantic actions in plan mode", () => {
    const manifest = buildEffectiveActionManifest({ tools, mode: "plan" });
    expect(manifest.allowedActionNames.has("git_status")).toBe(true);
    expect(manifest.allowedActionNames.has("git_commit")).toBe(false);
    expect(manifest.allowedActionNames.has("delete_file")).toBe(false);
  });

  it("keeps mutation actions hidden by default in agent mode", () => {
    const manifest = buildEffectiveActionManifest({ tools, mode: "agent" });
    expect(manifest.allowedActionNames.has("git_commit")).toBe(false);
    expect(manifest.allowedActionNames.has("move_file")).toBe(false);
  });

  it("can expose mutation actions only through an explicit gate", () => {
    const manifest = buildEffectiveActionManifest({
      tools,
      mode: "agent",
      allowMutationActions: true,
    });
    expect(manifest.allowedActionNames.has("git_commit")).toBe(true);
    expect(manifest.allowedActionNames.has("move_file")).toBe(true);
  });

  it("honors an explicit disabled semantic action", () => {
    const manifest = buildEffectiveActionManifest({
      tools,
      mode: "agent",
      toolPolicies: { git_log: "disabled" },
    });
    expect(manifest.allowedActionNames.has("git_log")).toBe(false);
  });

  it("exposes nothing in chat mode", () => {
    const manifest = buildEffectiveActionManifest({ tools, mode: "chat" });
    expect(manifest.tools).toEqual([]);
    expect(Object.keys(manifest.semanticActions)).toEqual([]);
    expect(manifest.allowedActionNames.size).toBe(0);
  });

  it("enforces one hard budget across semantic and ordinary actions", () => {
    const manyTools = Array.from({ length: 25 }, (_, index) =>
      mockTool(`read_${index}`, true),
    );
    const manifest = buildEffectiveActionManifest({
      tools: manyTools,
      mode: "agent",
      maxActions: 10,
    });
    expect(manifest.allowedActionNames.size).toBe(10);
    expect(manifest.allowedActionNames.has("git_status")).toBe(true);
    expect(manifest.allowedActionNames.has("read_24")).toBe(false);
  });
});
