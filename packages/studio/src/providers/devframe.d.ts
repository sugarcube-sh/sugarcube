/// <reference types="devframe" />

import type { SaveOutcome, StudioConnectionConfig } from "../protocol";
import type { STUDIO_RPC } from "../studio-names";

declare module "devframe" {
    interface DevframeRpcServerFunctions {
        [STUDIO_RPC.SAVE]: (sent: unknown) => Promise<SaveOutcome>;
    }

    interface DevframeConnectionConfigsRegistry {
        [STUDIO_RPC.CONFIG]: StudioConnectionConfig;
    }
}
