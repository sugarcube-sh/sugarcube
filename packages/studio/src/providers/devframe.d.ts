/// <reference types="devframe" />

import type { STUDIO_RPC, StudioConnectionConfig } from "../protocol";
import type { SaveBundle } from "../host/types";

declare module "devframe" {
    interface DevframeRpcServerFunctions {
        [STUDIO_RPC.SAVE]: (bundle: SaveBundle) => Promise<void>;
    }

    interface DevframeConnectionConfigsRegistry {
        [STUDIO_RPC.CONFIG]: StudioConnectionConfig;
    }
}
