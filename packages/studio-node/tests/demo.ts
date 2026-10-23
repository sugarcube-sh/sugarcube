import { fileURLToPath } from "node:url";
import { type SugarcubeConfig, fillDefaults } from "@sugarcube-sh/core";
import { nodeFiles } from "@sugarcube-sh/studio/server";

export const demoResolver = fileURLToPath(
    new URL("../../studio/demo/tokens.resolver.json", import.meta.url),
);

export function filesAt(resolver = demoResolver, studio?: SugarcubeConfig["studio"]) {
    return nodeFiles(
        { ...fillDefaults({ resolver, ...(studio && { studio }) }), resolver },
        {
            onError: (error) => {
                throw error;
            },
        },
    );
}
