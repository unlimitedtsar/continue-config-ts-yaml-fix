import { ModelDescription } from "../..";
import { TextActionFramework } from "./textAction/TextActionFramework";
import { SystemMessageToolCodeblocksFramework } from "./toolCodeblocks";
import { SystemMessageToolsFramework } from "./types";

/**
 * Returns the appropriate SystemMessageToolsFramework for the given model.
 *
 * Defaults to SystemMessageToolCodeblocksFramework (existing behavior).
 * Returns TextActionFramework when model.toolProtocol === "text_action".
 */
export function resolveSystemMessageToolsFramework(
  model: Pick<ModelDescription, "toolProtocol"> | undefined,
): SystemMessageToolsFramework {
  if (model?.toolProtocol === "text_action") {
    return new TextActionFramework();
  }
  return new SystemMessageToolCodeblocksFramework();
}
