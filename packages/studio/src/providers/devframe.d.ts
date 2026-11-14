/// <reference types="devframe" />

import type { SaveResult, StudioConnectionConfig } from "../protocol";
import type { STUDIO_RPC } from "../studio-names";

declare module "devframe" {
    interface DevframeRpcServerFunctions {
        [STUDIO_RPC.SAVE]: (sent: unknown) => Promise<SaveResult>;
    }

    interface DevframeConnectionConfigsRegistry {
        [STUDIO_RPC.CONFIG]: StudioConnectionConfig;
    }
}
