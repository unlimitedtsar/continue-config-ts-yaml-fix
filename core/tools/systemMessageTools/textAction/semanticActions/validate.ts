import { SEMANTIC_ACTION_REGISTRY } from "./registry";

export type SemanticActionValidationErrorCode =
  | "MISSING_ARGUMENT"
  | "UNKNOWN_ARGUMENT"
  | "INVALID_ARGUMENT";

export type SemanticActionValidationResult =
  | { valid: true }
  | {
      valid: false;
      code: SemanticActionValidationErrorCode;
      message: string;
    };

export function validateSemanticActionArgs(
  name: string,
  args: Record<string, unknown>,
): SemanticActionValidationResult {
  const def = SEMANTIC_ACTION_REGISTRY[name];
  if (!def) {
    return { valid: true };
  }

  const declared = new Map(def.args.map((arg) => [arg.name, arg]));

  for (const arg of def.args) {
    const value = args[arg.name];
    if (
      arg.required &&
      (value === undefined || value === null || value === "")
    ) {
      return {
        valid: false,
        code: "MISSING_ARGUMENT",
        message: `required argument "${arg.name}" is missing`,
      };
    }
  }

  for (const [key, value] of Object.entries(args)) {
    const arg = declared.get(key);
    if (!arg) {
      return {
        valid: false,
        code: "UNKNOWN_ARGUMENT",
        message: `unknown argument "${key}"`,
      };
    }
    if (value === undefined || value === null) {
      continue;
    }
    if (!matchesType(value, arg.type)) {
      return {
        valid: false,
        code: "INVALID_ARGUMENT",
        message: `argument "${key}" must be ${arg.type}`,
      };
    }
  }

  return { valid: true };
}

function matchesType(
  value: unknown,
  expected: "string" | "number" | "boolean",
): boolean {
  if (typeof value === expected) {
    return true;
  }
  // Native/system-message callers may preserve scalar text. Accept only exact
  // lossless scalar forms; adapters remain responsible for bounded semantics.
  if (typeof value !== "string") {
    return false;
  }
  if (expected === "number") {
    return value.trim() !== "" && Number.isFinite(Number(value));
  }
  if (expected === "boolean") {
    return value === "true" || value === "false";
  }
  return false;
}
