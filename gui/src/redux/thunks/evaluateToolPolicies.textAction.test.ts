import { describe, expect, it, vi } from "vitest";
import { evaluateToolPolicies } from "./evaluateToolPolicies";

function toolCallState(name: string) {
  return {
    status: "generated",
    toolCallId: `call_${name}`,
    toolCall: {
      id: `call_${name}`,
      type: "function",
      function: { name, arguments: "{}" },
    },
    parsedArgs: {},
  } as any;
}

describe("evaluateToolPolicies TextAction exposure", () => {
  it("preserves native and legacy policy flow when no manifest is provided", async () => {
    const dispatch = vi.fn();
    const ideMessenger = {
      request: vi.fn().mockResolvedValue({
        status: "success",
        content: { policy: "allowedWithPermission" },
      }),
    } as any;
    const results = await evaluateToolPolicies(
      dispatch as any,
      ideMessenger,
      [],
      [toolCallState("read_file")],
      {},
    );

    expect(results[0]?.policy).toBe("allowedWithPermission");
    expect(ideMessenger.request).toHaveBeenCalledOnce();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("rejects an unexposed action before requesting core policy", async () => {
    const dispatch = vi.fn();
    const ideMessenger = { request: vi.fn() } as any;
    const results = await evaluateToolPolicies(
      dispatch as any,
      ideMessenger,
      [],
      [toolCallState("run_terminal_command")],
      {},
      new Set(["git_status", "read_file"]),
    );

    expect(results[0]?.policy).toBe("disabled");
    expect(results[0]?.displayValue).toContain("[ACTION_NOT_EXPOSED]");
    expect(ideMessenger.request).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it("delegates an exposed action to core policy evaluation", async () => {
    const dispatch = vi.fn();
    const ideMessenger = {
      request: vi.fn().mockResolvedValue({
        status: "success",
        content: { policy: "allowedWithoutPermission" },
      }),
    } as any;
    const results = await evaluateToolPolicies(
      dispatch as any,
      ideMessenger,
      [],
      [toolCallState("git_status")],
      {},
      new Set(["git_status"]),
    );

    expect(results[0]?.policy).toBe("allowedWithoutPermission");
    expect(ideMessenger.request).toHaveBeenCalledOnce();
    expect(dispatch).not.toHaveBeenCalled();
  });
});
