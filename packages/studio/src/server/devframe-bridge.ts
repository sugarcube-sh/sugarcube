import { defineRpcFunction } from "devframe";
import type { DevframeNodeContext } from "devframe/types";
import { STUDIO_RPC } from "../protocol";
import type { StudioHostBridge } from "./types";

export function createDevframeBridge(ctx: DevframeNodeContext): StudioHostBridge {
    return {
        sharedState: (key, initialValue) => ctx.rpc.sharedState.get(key, { initialValue }),

        registerAction: (name, handler) => {
            ctx.rpc.register(
                defineRpcFunction({
                    name,
                    type: "action",
                    setup: () => ({ handler: handler as never }),
                }),
            );
        },

        warn: (message) => ctx.diagnostics.logger.warn(message),

        publishConfig: (config) => {
            ctx.staticConfig[STUDIO_RPC.CONFIG] = config;
        },
    };
}
