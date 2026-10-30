import { fileURLToPath } from "node:url";
import { type SugarcubeConfig, fillDefaults } from "@sugarcube-sh/core";
import { nodeFiles } from "../../src/server/node-files";

export const demoResolver = fileURLToPath(
    new URL("../../demo/tokens.resolver.json", import.meta.url),
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
