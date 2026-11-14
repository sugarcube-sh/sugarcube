import type { BuildAdapter } from "../controllers/adapter";
import type { MessageAdapter } from "../protocol";
import { createPlainAdapter } from "./plain";
import { createSugarcubeAdapter } from "./sugarcube";

export function createAdapter(sent: MessageAdapter): BuildAdapter {
    return sent.name === "sugarcube"
        ? createSugarcubeAdapter(sent.settings)
        : createPlainAdapter(sent.settings);
}
