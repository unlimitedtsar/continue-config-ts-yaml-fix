import type { AssistantChatMessage, ChatMessage, PromptLog } from "../../..";
import { beforeEach, describe, expect, it } from "vitest";
import { interceptSystemToolCalls } from "../interceptSystemToolCalls";
import { TextActionFramework } from "./TextActionFramework";

describe("interceptSystemToolCalls with TextAction", () => {
  let abortController: AbortController;
  let framework: TextActionFramework;

  beforeEach(() => {
    abortController = new AbortController();
    framework = new TextActionFramework({}, {});
  });

  const createGenerator = async function* (
    messages: ChatMessage[][],
  ): AsyncGenerator<ChatMessage[], PromptLog | undefined> {
    for (const group of messages) {
      yield group;
    }
    return undefined;
  };

  it("emits a no-argument action at end-of-response", async () => {
    const output = await collect("@action git_status\n");
    const calls = output.flatMap((group) =>
      (group as AssistantChatMessage[]).flatMap((message) => message.toolCalls ?? []),
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]?.function?.name).toBe("git_status");
    expect(calls[0]?.function?.arguments).toBe("");
  });

  it("closes argument JSON when the response ends", async () => {
    const output = await collect(
      "@action read_file\nfilepath: src/main.ts\n",
    );
    const args = output.flatMap((group) =>
      (group as AssistantChatMessage[]).flatMap((message) =>
        (message.toolCalls ?? []).map(
          (call) => call.function?.arguments ?? "",
        ),
      ),
    );
    expect(args).toContain('{"filepath":"src/main.ts"');
    expect(args.at(-1)).toBe("}");
  });

  it("does not execute inline prose mentioning @action", async () => {
    const output = await collect("Explain @action git_status syntax");
    expect(
      output.some((group) =>
        (group as AssistantChatMessage[]).some(
          (message) => (message.toolCalls?.length ?? 0) > 0,
        ),
      ),
    ).toBe(false);
  });

  it("does not execute @action examples inside code fences", async () => {
    const output = await collect("```\n@action git_status\n```");
    expect(
      output.some((group) =>
        (group as AssistantChatMessage[]).some(
          (message) => (message.toolCalls?.length ?? 0) > 0,
        ),
      ),
    ).toBe(false);
  });

  it("converts malformed syntax into a typed internal error action", async () => {
    const output = await collect("@action read_file\nfilepath src/main.ts\n");
    const calls = output.flatMap((group) =>
      (group as AssistantChatMessage[]).flatMap((message) => message.toolCalls ?? []),
    );
    const errorCall = calls.find(
      (call) => call.function?.name === "__smap_error__",
    );
    expect(errorCall).toBeDefined();
    expect(errorCall?.function?.arguments).toContain("MALFORMED_ARGUMENT");
    expect(errorCall?.function?.arguments).toContain('"retryable":true');
  });

  async function collect(content: string): Promise<ChatMessage[][]> {
    const generator = interceptSystemToolCalls(
      createGenerator([[{ role: "assistant", content }]]),
      abortController,
      framework,
    );
    const output: ChatMessage[][] = [];
    while (true) {
      const next = await generator.next();
      if (next.done) {
        return output;
      }
      output.push(next.value);
    }
  }
});
