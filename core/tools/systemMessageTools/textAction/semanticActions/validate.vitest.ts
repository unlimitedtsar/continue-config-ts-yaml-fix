import { describe, expect, it } from "vitest";
import { validateSemanticActionArgs } from "./validate";

describe("validateSemanticActionArgs", () => {
  it("accepts a no-argument action", () => {
    expect(validateSemanticActionArgs("git_status", {})).toEqual({ valid: true });
  });

  it("rejects a missing required argument", () => {
    expect(validateSemanticActionArgs("git_blame", {})).toEqual({
      valid: false,
      code: "MISSING_ARGUMENT",
      message: 'required argument "file" is missing',
    });
  });

  it("rejects an empty required argument", () => {
    expect(validateSemanticActionArgs("git_commit", { message: "" })).toMatchObject({
      valid: false,
      code: "MISSING_ARGUMENT",
    });
  });

  it("rejects unknown arguments", () => {
    expect(validateSemanticActionArgs("git_status", { command: "git status" })).toMatchObject({
      valid: false,
      code: "UNKNOWN_ARGUMENT",
    });
  });

  it("validates scalar types", () => {
    expect(validateSemanticActionArgs("git_log", { limit: "ten" })).toMatchObject({
      valid: false,
      code: "INVALID_ARGUMENT",
    });
    expect(validateSemanticActionArgs("git_log", { limit: "10" })).toEqual({ valid: true });
    expect(validateSemanticActionArgs("git_diff", { staged: "true" })).toEqual({ valid: true });
  });

  it("does not claim ownership of ordinary Continue tools", () => {
    expect(validateSemanticActionArgs("read_file", { filepath: "a.ts" })).toEqual({
      valid: true,
    });
  });
});
