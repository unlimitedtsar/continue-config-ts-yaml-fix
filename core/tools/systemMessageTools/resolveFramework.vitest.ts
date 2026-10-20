import { describe, expect, it } from "vitest";
import { resolveSystemMessageToolsFramework } from "./resolveFramework";
import { TextActionFramework } from "./textAction/TextActionFramework";
import { SEMANTIC_ACTION_REGISTRY } from "./textAction/semanticActions/registry";
import { SystemMessageToolCodeblocksFramework } from "./toolCodeblocks";

describe("resolveSystemMessageToolsFramework", () => {
  it("selects TextAction only for text_action protocol", () => {
    expect(
      resolveSystemMessageToolsFramework({ toolProtocol: "text_action" }),
    ).toBeInstanceOf(TextActionFramework);
    expect(
      resolveSystemMessageToolsFramework({ toolProtocol: "tool_codeblocks" }),
    ).toBeInstanceOf(SystemMessageToolCodeblocksFramework);
    expect(resolveSystemMessageToolsFramework(undefined)).toBeInstanceOf(
      SystemMessageToolCodeblocksFramework,
    );
  });

  it("passes the effective semantic subset into TextAction", () => {
    const framework = resolveSystemMessageToolsFramework(
      { toolProtocol: "text_action" },
      { git_status: SEMANTIC_ACTION_REGISTRY.git_status },
    );
    expect(framework.getExtraToolDefinitions?.()).toHaveLength(1);
    expect(framework.getExtraToolDefinitions?.()[0]).toContain("git_status");
  });
});
